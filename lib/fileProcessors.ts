import { readFile } from 'fs/promises';
import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFile = promisify(execFileCallback);

// Función para determinar el tipo de archivo por extensión
export function getFileType(fileName: string): 'pdf' | 'epub' | 'mobi' | 'unknown' {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'epub':
      return 'epub';
    case 'mobi':
      return 'mobi';
    default:
      return 'unknown';
  }
}

// Función genérica para extraer texto según el tipo de archivo
export async function extractTextFromFile(filePath: string, fileType: 'pdf' | 'epub' | 'mobi'): Promise<string> {
  switch (fileType) {
    case 'pdf':
      const pdfjs = await import('pdf-parse');
      const dataBuffer = await readFile(filePath);
      const pdfData = await pdfjs.default(dataBuffer);
      return pdfData.text;
      
    case 'epub':
    case 'mobi':
      // Para EPUB y MOBI usamos un enfoque más simple
      return await extractEbookText(filePath, fileType);
      
    default:
      throw new Error(`Tipo de archivo no soportado: ${fileType}`);
  }
}

// Función simplificada para extraer texto de archivos EPUB y MOBI sin dependencias problemáticas
async function extractEbookText(filePath: string, fileType: 'epub' | 'mobi'): Promise<string> {
  try {
    // Primero intentamos usar herramientas de línea de comandos si están disponibles
    const hasCalibre = await checkCommand('ebook-convert');
    
    if (hasCalibre) {
      console.log(`Utilizando Calibre para convertir ${fileType}`);
      return await extractWithCalibre(filePath);
    }
    
    // Si no hay herramientas externas, intentamos un enfoque rudimentario
    console.log(`No se encontró Calibre, intentando extracción básica de ${fileType}`);
    return await basicTextExtraction(filePath, fileType);
    
  } catch (error) {
    console.error(`Error al procesar archivo ${fileType}:`, error);
    return `No se pudo extraer el contenido del archivo ${fileType.toUpperCase()}. 
            Se recomienda instalar Calibre (ebook-convert) para mejor soporte.
            
            El texto extraído puede estar incompleto o incorrecto.`;
  }
}

// Verificar si un comando existe en el sistema
async function checkCommand(command: string): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // En Windows, verificamos si el comando existe de manera diferente
      await execFile('where', [command]);
    } else {
      // En Unix/Linux/Mac
      await execFile('which', [command]);
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Extraer texto usando Calibre
async function extractWithCalibre(filePath: string): Promise<string> {
  const tempDir = path.join(path.dirname(filePath), 'temp_extract');
  const outputFile = path.join(tempDir, 'output.txt');
  
  // Crear directorio temporal si no existe
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  try {
    // Convertir ebook a texto plano usando Calibre
    await execFile('ebook-convert', [filePath, outputFile]);
    
    // Leer el archivo resultante
    const textContent = await readFile(outputFile, 'utf-8');
    
    // Limpiar archivos temporales
    try {
      fs.unlinkSync(outputFile);
      fs.rmdirSync(tempDir);
    } catch (err) {
      console.warn('No se pudieron eliminar archivos temporales:', err);
    }
    
    return textContent;
  } catch (error) {
    console.error('Error usando Calibre:', error);
    throw error;
  }
}

// Extracción rudimentaria de texto para EPUB y MOBI
async function basicTextExtraction(filePath: string, fileType: 'epub' | 'mobi'): Promise<string> {
  const buffer = await readFile(filePath);
  let extracted = '';
  
  // Para EPUB (que es esencialmente un ZIP con archivos HTML)
  if (fileType === 'epub') {
    try {
      // Intentamos encontrar bloques de texto dentro del archivo binario
      const content = buffer.toString('utf8');
      
      // Buscar etiquetas HTML comunes en EPUB
      const htmlBlocks = content.match(/<p>(.+?)<\/p>/g) || [];
      if (htmlBlocks.length > 0) {
        // Extraer el texto de las etiquetas HTML
        extracted = htmlBlocks
          .map(block => block.replace(/<[^>]+>/g, ' ').trim())
          .filter(text => text.length > 20) // Filtrar textos muy cortos
          .join('\n\n');
      } else {
        // Extracción más básica si no encontramos etiquetas HTML
        extracted = simpleTextExtraction(content);
      }
    } catch (err) {
      console.error('Error al procesar EPUB básico:', err);
      extracted = simpleTextExtraction(buffer.toString('utf8', 0, 500000)); // Limitar tamaño
    }
  }
  // Para MOBI (formato propietario, extracción muy limitada)
  else if (fileType === 'mobi') {
    try {
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1000000));
      extracted = simpleTextExtraction(content);
    } catch (err) {
      console.error('Error al procesar MOBI básico:', err);
      extracted = 'No se pudo extraer texto del formato MOBI sin herramientas externas.';
    }
  }
  
  if (!extracted || extracted.length < 100) {
    extracted = `La extracción de texto de ${fileType.toUpperCase()} sin herramientas externas es limitada.
                Para mejores resultados, instala Calibre (ebook-convert).`;
  }
  
  return extracted;
}

// Extracción muy simple de texto
function simpleTextExtraction(content: string): string {
  // Eliminar caracteres no imprimibles
  const cleaned = content.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, ' ');
  
  // Encontrar bloques de texto con sentido (al menos 20 caracteres)
  const textBlocks = cleaned.match(/[A-Za-z0-9\u00C0-\u00FF \.,\?!:;'"()-]{20,}/g) || [];
  
  // Eliminar duplicados y unir
  return Array.from(new Set(textBlocks)).join('\n\n');
}
