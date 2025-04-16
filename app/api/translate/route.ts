import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { join } from 'path'
import { getFileType, extractTextFromFile } from '../../../lib/fileProcessors'

// Función para asegurar que existe un directorio
async function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }
}

// Nueva función para traducir texto usando la API personalizada de Hugging Face Inference
async function translateWithHuggingFace(texts: string[]): Promise<string[]> {
  const maxRetries = 3; // Número máximo de reintentos
  const retryDelay = 2000; // Retraso entre reintentos en milisegundos (2 segundos)
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const apiUrl = process.env.HF_API_URL || '';
      const apiToken = process.env.HF_API_TOKEN || '';

      if (!apiUrl) {
        // Este error es de configuración, no tiene sentido reintentar
        throw new Error('HF_API_URL no está configurado en las variables de entorno');
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      console.log(`Enviando solicitud a Hugging Face (Intento ${attempt}/${maxRetries})`, { apiUrl, texts: texts.slice(0, 2) }); // Log solo las primeras 2 frases
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: texts,
          options: {
            wait_for_model: true, // Esperar a que el modelo esté listo
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Respuesta de error de Hugging Face (Intento ${attempt}/${maxRetries}):`, response.status, response.statusText, errorText);
        // Si es un error 503 (Service Unavailable) o similar, reintentar
        if ((response.status === 503 || response.status >= 500) && attempt < maxRetries) {
          console.log(`Reintentando por error ${response.status} en ${retryDelay / 1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Pasar al siguiente intento
        }
        // Si no es un error retriable o se agotaron los intentos, lanzar error
        throw new Error(`Error en la API de traducción: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Si la respuesta es OK, procesarla
      const result = await response.json();
      console.log('Respuesta recibida de Hugging Face:', result);

      if (Array.isArray(result)) {
        if (result.length > 0 && result[0].translation_text) {
          const translations = result.map((item: any) => item.translation_text);
          console.log('Traducciones extraídas:', translations.slice(0, 2)); // Log primeras 2
          return translations; // Éxito, retornar traducciones
        }
        console.warn('Formato de array inesperado, devolviendo array:', result);
        return result.map(item => String(item));
      } else if (result.translations && Array.isArray(result.translations)) {
        console.log('Usando el array result.translations:', result.translations.slice(0, 2)); // Log primeras 2
        return result.translations; // Éxito, retornar traducciones
      } else if (typeof result === 'string') {
        console.log('Respuesta es string:', result);
        return [result]; // Éxito, retornar traducción como array
      } else if (result && result.error && typeof result.error === 'string') {
        console.warn(`Error devuelto por la API de Hugging Face: ${result.error}`);
        if (result.error.includes("currently loading") && attempt < maxRetries) {
          const estimatedTime = result.estimated_time || (retryDelay / 1000);
          const waitTime = Math.max(retryDelay, estimatedTime * 1000);
          console.log(`Modelo cargando. Reintentando en ${waitTime / 1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Pasar al siguiente intento
        }
        throw new Error(`Error en la API de traducción: ${result.error}`);
      } else {
        console.warn('Formato de respuesta inesperado:', result);
        throw new Error(`Formato de respuesta inesperado de la API: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error(`Error durante la traducción con Hugging Face (Intento ${attempt}/${maxRetries}):`, error);

      if (attempt >= maxRetries) {
        console.error('Se agotaron los reintentos para la traducción después de un error.');
        throw new Error(`Fallo definitivo al traducir después de ${maxRetries} intentos: ${error instanceof Error ? error.message : String(error)}`);
      }

      console.log(`Reintentando tras error en ${retryDelay / 1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  console.error('Se agotaron los reintentos para la traducción (fin inesperado del bucle).');
  throw new Error(`Se agotaron los reintentos (${maxRetries}) para la traducción.`);
}

// Función mejorada para dividir el texto en frases más pequeñas
function splitIntoSentences(text: string): string[] {
  // Primero dividimos por párrafos para mantener la estructura del documento
  const paragraphs = text.split(/\n\s*\n/);
  
  const sentences: string[] = [];
  
  // Para cada párrafo, encontramos frases
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    // Usamos una expresión regular mejorada para detectar finales de frases
    const sentenceRegex = /([^.!?]+[.!?]+\s*)/g;
    const matches = paragraph.match(sentenceRegex);
    
    if (matches && matches.length > 0) {
      // Si el párrafo tiene frases claras, las añadimos
      sentences.push(...matches.map(s => s.trim()).filter(s => s.length > 0));
    } else {
      // Si no detectamos frases (quizás por puntuación inusual), usamos el párrafo completo
      sentences.push(paragraph.trim());
    }
  }
  
  // Dividir frases muy largas (más de 200 caracteres) que podrían ser difíciles de procesar
  const result: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length > 200) {
      // Dividir en chunks de tamaño manejable, intentando en comas o espacios naturales
      const chunks = splitLongSentence(sentence);
      result.push(...chunks);
    } else {
      result.push(sentence);
    }
  }
  
  return result;
}

// Función para dividir frases muy largas en chunks más manejables
function splitLongSentence(longSentence: string): string[] {
  const maxLength = 200;
  const result: string[] = [];
  
  // Si la frase tiene comas, intentamos dividir por ellas
  if (longSentence.includes(',')) {
    let currentChunk = '';
    const parts = longSentence.split(',');
    
    for (const part of parts) {
      const potentialChunk = currentChunk ? `${currentChunk},${part}` : part;
      
      if (potentialChunk.length <= maxLength) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) result.push(currentChunk + ',');
        currentChunk = part;
      }
    }
    
    if (currentChunk) result.push(currentChunk);
    return result;
  }
  
  // Si no hay comas, dividir por longitud (intentando en espacios)
  let remaining = longSentence;
  while (remaining.length > maxLength) {
    // Buscar el último espacio antes del límite
    let cutPoint = maxLength;
    while (cutPoint > 0 && remaining[cutPoint] !== ' ') {
      cutPoint--;
    }
    
    // Si no encontramos un espacio, cortar en el límite
    if (cutPoint === 0) cutPoint = maxLength;
    
    result.push(remaining.substring(0, cutPoint).trim());
    remaining = remaining.substring(cutPoint).trim();
  }
  
  if (remaining.length > 0) {
    result.push(remaining);
  }
  
  return result;
}

// Función auxiliar para limpiar texto de caracteres problemáticos
function sanitizeText(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // --- NUEVO: Intentar separar ligaduras comunes ---
  sanitized = sanitized.replace(/ﬁ/g, 'fi'); // ff ligature
  sanitized = sanitized.replace(/ﬂ/g, 'fl'); // fl ligature
  // Añadir otras ligaduras si se identifican más (e.g., ffi, ffl)
  // --- FIN NUEVO ---

  // Reemplazar saltos de línea por espacios
  sanitized = sanitized.replace(/[\n\r]+/g, ' ');

  // Reemplazar múltiples espacios por uno solo
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Eliminar caracteres que causan problemas con WinAnsi o son no estándar
  sanitized = sanitized.replace(/[^\x00-\xFF]/g, (char) => {
    // Reemplazar caracteres no-ASCII con sustitutos seguros o espacios
    switch (char) {
      case '\u201E': // „
      case '\u201C': // "
      case '\u201D': // "
        return '"';
      case '\u2018': // '
      case '\u2019': // '
        return "'";
      case '\u2026': // …
        return '...';
      case '\u2013': // –
      case '\u2014': // —
        return '-';
      // Podríamos añadir más reemplazos específicos si fuera necesario
      default:
        // Para otros caracteres Unicode que no queremos específicamente,
        // usar un espacio podría ser más seguro que eliminarlos,
        // para evitar unir palabras accidentalmente si el carácter estaba solo.
        return ' ';
    }
  });

  // Volver a colapsar espacios por si los reemplazos introdujeron múltiples
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized.trim();
}

// Obtener configuración desde variables de entorno
const CONFIG = {
  limitedMode: process.env.LIMITED_MODE !== 'false', // true por defecto a menos que se establezca explícitamente como "false"
  maxPages: parseInt(process.env.MAX_PAGES || '5')
};

async function addCoverPage(originalPdfBuffer: Buffer, translatedPdfBuffer: Buffer): Promise<Buffer> {
  // Cargar el documento original y el traducido
  const originalPdfDoc = await PDFDocument.load(originalPdfBuffer);
  const translatedPdfDoc = await PDFDocument.load(translatedPdfBuffer);

  // Crear un nuevo documento PDF
  const finalPdfDoc = await PDFDocument.create();

  // Copiar la portada (primera página) del documento original
  const [coverPage] = await finalPdfDoc.copyPages(originalPdfDoc, [0]);
  finalPdfDoc.addPage(coverPage);

  // Copiar todas las páginas del documento traducido
  const translatedPages = await finalPdfDoc.copyPages(translatedPdfDoc, translatedPdfDoc.getPageIndices());
  translatedPages.forEach((page) => finalPdfDoc.addPage(page));

  // Guardar el nuevo documento con la portada incluida
  const finalPdfBytes = await finalPdfDoc.save();
  return Buffer.from(finalPdfBytes); // Convertir Uint8Array a Buffer
}

export async function POST(req: NextRequest) {
  try {
    // Verificar que la URL de API está configurada
    const apiUrl = process.env.HF_API_URL;
    if (!apiUrl) {
      console.error('Error: HF_API_URL no está configurada en las variables de entorno');
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 });
    }
    
    // Preparar directorios para los archivos
    const uploadsDir = join(process.cwd(), 'uploads')
    await ensureDir(uploadsDir)
    
    // Obtener el archivo desde la solicitud
    const formData = await req.formData()
    const pdfFile = formData.get('pdfFile') as File | null
    const sessionId = formData.get('sessionId') as string | null
    
    if (!pdfFile) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 })
    }
    
    // Guardar el archivo temporalmente
    const bytes = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const timestamp = Date.now()
    const originalFilename = pdfFile.name
    const filePath = join(uploadsDir, `${timestamp}_${originalFilename}`)
    
    await writeFile(filePath, buffer)
    
    // Determinar el tipo de archivo
    const fileType = getFileType(originalFilename);
    
    if (fileType === 'unknown') {
      return NextResponse.json({ error: 'Tipo de archivo no soportado. Por favor, sube un PDF, EPUB o MOBI.' }, { status: 400 })
    }
    
    console.log(`Procesando archivo ${fileType}: ${originalFilename}`);
    
    try {
      // Extraer texto según el tipo de archivo
      let fullText = '';
      let totalPages = 1; // Valor predeterminado
      
      if (fileType === 'pdf') {
        // Para PDF, utilizamos la lógica existente
        const originalPdfDoc = await PDFDocument.load(buffer);
        totalPages = originalPdfDoc.getPageCount();
        
        if (CONFIG.limitedMode) {
          // Modo de prueba - procesar solo un número limitado de páginas
          const pagesToProcess = Math.min(CONFIG.maxPages, totalPages);
          
          // Crear un nuevo documento con las primeras N páginas
          const limitedPdfDoc = await PDFDocument.create();
          const copiedPages = await limitedPdfDoc.copyPages(
            originalPdfDoc, 
            Array.from({length: pagesToProcess}, (_, i) => i)
          );
          
          copiedPages.forEach(page => limitedPdfDoc.addPage(page));
          const limitedPdfBytes = await limitedPdfDoc.save();
          
          // Leer el PDF con límite de páginas
          const pdfjs = await import('pdf-parse');
          const pdfData = await pdfjs.default(Buffer.from(limitedPdfBytes));
          fullText = pdfData.text;
          console.log(`Procesando solo ${pagesToProcess} de ${totalPages} páginas totales (modo limitado)`);
        } else {
          // Modo normal - procesar el documento completo
          const pdfjs = await import('pdf-parse');
          const pdfData = await pdfjs.default(buffer);
          fullText = pdfData.text;
          console.log(`Procesando todas las ${totalPages} páginas (modo completo)`);
        }
      } else {
        // Para EPUB y MOBI, extraemos todo el texto usando nuestra función simplificada
        console.log(`Extrayendo texto de ${fileType}...`);
        try {
          fullText = await extractTextFromFile(filePath, fileType);
          
          // Para EPUB y MOBI no tenemos un concepto de "páginas" como en PDF,
          // pero podemos estimar basándonos en la cantidad de texto
          const estimatedCharsPerPage = 2000; // Aproximadamente 2000 caracteres por página
          totalPages = Math.ceil(fullText.length / estimatedCharsPerPage) || 1;
          
          // Si está en modo limitado, recortamos el texto
          if (CONFIG.limitedMode && totalPages > CONFIG.maxPages) {
            const charsToKeep = CONFIG.maxPages * estimatedCharsPerPage;
            fullText = fullText.substring(0, charsToKeep);
            console.log(`Procesando aproximadamente ${CONFIG.maxPages} de ${totalPages} páginas estimadas (modo limitado)`);
          } else {
            console.log(`Procesando todo el contenido del archivo ${fileType}`);
          }
        } catch (error) {
          console.error(`Error al extraer texto de ${fileType}:`, error);
          return NextResponse.json({ 
            error: `No se pudo extraer texto del archivo ${fileType}. ${error instanceof Error ? error.message : 'Error desconocido'}` 
          }, { status: 500 });
        }
      }
      
      // Dividir el contenido en frases con la función mejorada
      const sentences = splitIntoSentences(fullText);
      
      // Log ANTES de limpiar
      console.log('--- Sentences BEFORE sanitization ---');
      console.log(JSON.stringify(sentences.slice(0, 10), null, 2)); // Loguear las primeras 10 para no saturar

      // Limpiar las frases de caracteres problemáticos
      const cleanedSentences = sentences.map(sentence => sanitizeText(sentence));

      // Log DESPUÉS de limpiar
      console.log('--- Sentences AFTER sanitization ---');
      console.log(JSON.stringify(cleanedSentences.slice(0, 10), null, 2)); // Loguear las primeras 10 limpias

      // Informar al usuario sobre la limitación
      const originalSentenceCount = cleanedSentences.length;
      
      // Informar al usuario sobre la limitación
      const pagesToProcess = CONFIG.limitedMode ? Math.min(CONFIG.maxPages, totalPages) : totalPages;
      console.log(`Se procesarán ${originalSentenceCount} frases de las primeras ${pagesToProcess} páginas`);
      
      // Calcular el número estimado de páginas
      const estimatedPagesCount = Math.ceil(sentences.length / 10); // Estimación simple: 10 frases por página
      
      // Almacenar el progreso en el objeto global
      if (sessionId) {
        // Asegurarse de que la variable global exista
        if (typeof global.translationProgress === 'undefined') {
          global.translationProgress = {};
        }
        
        // Inicializar datos de progreso con valores predeterminados
        global.translationProgress[sessionId] = {
          totalSentences: sentences.length,
          completedSentences: 0,
          totalPages: estimatedPagesCount || 1, // Evitar división por cero
          currentPage: 0,
          status: 'processing',
          limitedMode: CONFIG.limitedMode,
          processedPages: CONFIG.limitedMode ? Math.min(CONFIG.maxPages, totalPages) : totalPages,
          totalPdfPages: totalPages
        };
        
        // Log para debug
        console.log(`Progreso inicializado para sesión ${sessionId}:`, global.translationProgress[sessionId]);
      }
      
      // Traducir las frases limpias
      const translatedSentences: Array<{ original: string; translation: string }> = [];
      
      // Procesamos en lotes más pequeños para mejorar la precisión y evitar problemas de límite
      const batchSize = 25;
      const retryDelay = 1000; // Espera en milisegundos antes de reintentar
      const retryTimeout = 60000; // 1 minuto en milisegundos

      for (let i = 0; i < cleanedSentences.length; i += batchSize) {
        // Tomar el lote actual
        const batch = cleanedSentences.slice(i, i + batchSize);
        let results: string[] = [];
        let success = false;
        let attempts = 0;
        let firstErrorTime: number | null = null; // Para rastrear el tiempo del primer error en este lote

        while (!success) { 
          try {
            // Traducir este lote usando nuestra nueva función
            console.log(`Intentando traducir lote ${Math.floor(i / batchSize) + 1}, intento ${attempts + 1}`);
            results = await translateWithHuggingFace(batch);
            success = true; // Marcar como éxito si la llamada no lanza error
            firstErrorTime = null; // Resetear el timer si la traducción tiene éxito

            // Procesar los resultados, asociando cada traducción con su frase original
            for (let j = 0; j < batch.length; j++) {
              // Sanitizar también la traducción
              const translationText = results[j] || '(No translation)'; 
              const sanitizedTranslation = sanitizeText(translationText);
              
              translatedSentences.push({ 
                original: batch[j], 
                translation: sanitizedTranslation 
              });
              
              // Actualizar progreso de forma más robusta
              if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
                const newCompletedCount = i + j + 1;
                global.translationProgress[sessionId].completedSentences = newCompletedCount;
                global.translationProgress[sessionId].currentPage = Math.ceil(newCompletedCount / 10);
                
                // Log más frecuente para ver el progreso
                if (newCompletedCount % 10 === 0 || newCompletedCount === sentences.length) {
                  console.log(`Progreso de traducción: ${newCompletedCount}/${sentences.length} frases`);
                }
              }
            }
          } catch (error: unknown) {
            attempts++;
            console.error(`Error traduciendo lote (intento ${attempts}):`, error instanceof Error ? error.message : String(error));

            // Registrar la hora del primer error para este lote
            if (firstErrorTime === null) {
              firstErrorTime = Date.now();
            }

            // Comprobar si ha pasado el tiempo límite desde el primer error
            if (Date.now() - firstErrorTime > retryTimeout) {
              console.error(`Timeout: Se superó el límite de ${retryTimeout / 1000} segundos reintentando el lote que empieza en el índice ${i}. Abortando traducción.`);
              // Lanzar un error para detener el proceso completo, ya que no se deben añadir frases sin traducir
              throw new Error(`Timeout de traducción para el lote ${Math.floor(i / batchSize) + 1}. No se pudo traducir después de ${retryTimeout / 1000} segundos.`);
            }
            
            // Esperar antes del siguiente intento
            console.log(`Esperando ${retryDelay}ms antes de reintentar...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
        
        // Pequeña pausa después de procesar un lote exitoso
        await new Promise(resolve => setTimeout(resolve, 200)); 
      }
      
      // Crear un nuevo PDF con las frases intercaladas
      const pdfDoc = await PDFDocument.create();
      
      // Usamos Helvetica que tiene mejor soporte para caracteres
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const page = pdfDoc.addPage([595, 842]); // Tamaño A4 estándar
      const { width, height } = page.getSize();
      const fontSize = 11;
      const lineHeight = fontSize * 1.2; // Más espacio entre líneas para mejor legibilidad
      let y = height - 50;
      
      // Colores para los textos
      const germanColor = rgb(0.1, 0.3, 0.6); // Azul para alemán
      const spanishColor = rgb(0.7, 0.1, 0.1); // Rojo para español
      
      // Añadir las frases al PDF
      const germanTextOptions = { 
        size: fontSize,
        color: germanColor,
        font: helveticaBold
      };
      
      const spanishTextOptions = {
        size: fontSize,
        color: spanishColor,
        font: helveticaOblique // Usar cursiva para la traducción
      };
      
      let currentPage = page;
      let pageCount = 1;
      
      // Función mejorada para añadir texto con saltos de línea automáticos
      const drawWrappedText = (text: string, options: any): number => {
        // Asegurarse de que el texto no tenga caracteres problemáticos
        const safeText = sanitizeText(text);
        
        const maxWidth = width - 100; // 50 píxels de margen en cada lado
        const textLineHeight = options.size * 1.2;
        
        // Dividir todo el texto en palabras
        const words = safeText.split(' ');
        let line = '';
        let yPos = options.y;
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = line + (line ? ' ' : '') + word;
          
          try {
            // Usar la fuente para medir el texto con más seguridad
            const textWidth = options.font.widthOfTextAtSize(testLine, options.size);
            
            if (textWidth > maxWidth && line !== '') {
              // Si la línea actual ya es demasiado ancha, añadirla y empezar una nueva
              currentPage.drawText(line, {
                ...options,
                y: yPos
              });
              
              line = word;
              yPos -= textLineHeight;
              
              // Si ya no hay espacio en la página actual, crear una nueva
              if (yPos < 50) {
                currentPage = pdfDoc.addPage([595, 842]);
                pageCount++;
                yPos = currentPage.getHeight() - 50;
                
                // Actualizar el progreso (páginas reales)
                if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
                  global.translationProgress[sessionId].currentPage = pageCount;
                  global.translationProgress[sessionId].totalPages = 
                    Math.max(global.translationProgress[sessionId].totalPages, pageCount);
                }
              }
            } else {
              line = testLine;
            }
          } catch (error: unknown) {
            console.warn(`Error al procesar palabra "${word}": ${error instanceof Error ? error.message : String(error)}`);
            // Si hay un error con esta palabra, la omitimos y continuamos
            line = line || '';
          }
        }
        
        // Añadir la última línea si queda algo
        if (line) {
          try {
            currentPage.drawText(line, {
              ...options,
              y: yPos
            });
          } catch (error: unknown) {
            console.warn(`Error al añadir la última línea "${line}": ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Devolver la nueva posición Y
        return yPos - textLineHeight;
      };
      
      // Añadir una página de título al principio
      currentPage.drawText("Documento Traducido", {
        x: 50,
        y: height - 100,
        size: 24,
        font: helvetica
      });
      
      currentPage.drawText(`Nombre original: ${originalFilename}`, {
        x: 50,
        y: height - 150,
        size: 12,
        font: helvetica
      });
      
      currentPage.drawText(`Formato original: ${fileType.toUpperCase()}`, {
        x: 50,
        y: height - 180,
        size: 12,
        font: helvetica
      });
      
      currentPage.drawText(`Fecha: ${new Date().toLocaleDateString()}`, {
        x: 50,
        y: height - 210,
        size: 12,
        font: helvetica
      });
      
      // Añadir texto que indique si es modo limitado o completo
      if (CONFIG.limitedMode) {
        currentPage.drawText(`VERSIÓN DE PRUEBA - Solo se han procesado las primeras ${Math.min(CONFIG.maxPages, totalPages)} páginas de ${totalPages}`, {
          x: 50,
          y: height - 240,
          size: 12,
          font: helvetica,
          color: rgb(0.8, 0.4, 0.0) // Color naranja para destacar
        });
      } else {
        currentPage.drawText(`Documento completo - Se han procesado las ${totalPages} páginas`, {
          x: 50,
          y: height - 240,
          size: 12,
          font: helvetica,
          color: rgb(0.0, 0.5, 0.0) // Color verde para modo completo
        });
      }
      
      currentPage.drawText("Traducido con Hugging Face Inference API", {
        x: 50,
        y: height - 270,
        size: 12,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4)
      });
      
      currentPage.drawText("DE: texto en alemán (azul)", {
        x: 50,
        y: height - 290,
        size: 12,
        font: helveticaBold,
        color: germanColor
      });
      
      currentPage.drawText("ES: traducción al español (rojo)", {
        x: 50,
        y: height - 310,
        size: 12,
        font: helvetica,
        color: spanishColor
      });
      
      // Añadir nueva página para empezar el contenido
      currentPage = pdfDoc.addPage([595, 842]);
      pageCount++;
      y = currentPage.getHeight() - 50;
      
      // Añadir las frases al PDF con mejor gestión del espacio
      for (const { original, translation } of translatedSentences) {
        try {
          // Verificar si hay suficiente espacio para al menos una línea de cada texto
          const minimumHeightNeeded = lineHeight * 2 + 20; // 1 línea alemán + 1 línea español + margen
          
          if (y - minimumHeightNeeded < 50) {
            currentPage = pdfDoc.addPage([595, 842]);
            pageCount++;
            y = currentPage.getHeight() - 50;
            
            // Actualizar el progreso (páginas reales)
            if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
              global.translationProgress[sessionId].currentPage = pageCount;
              global.translationProgress[sessionId].totalPages = 
                Math.max(global.translationProgress[sessionId].totalPages, pageCount);
            }
          }
          
          // Añadir un separador visual entre pares de frases
          if (y !== currentPage.getHeight() - 50) { // No en la primera frase de la página
            currentPage.drawLine({
              start: { x: 50, y: y + 10 },
              end: { x: width - 50, y: y + 10 },
              thickness: 0.5,
              color: rgb(0.8, 0.8, 0.8),
            });
            y -= 15; // Espacio después del separador
          }
          
          // Añadir prefijo al texto alemán
          currentPage.drawText('DE: ', {
            x: 50,
            y,
            ...germanTextOptions
          });
          
          // Dibujar el texto alemán con saltos de línea mejorados
          y = drawWrappedText(original, {
            x: 75,
            y,
            ...germanTextOptions
          });
          
          // Espacio entre alemán y español
          y -= 10;
          
          // Añadir prefijo al texto español
          currentPage.drawText('ES: ', {
            x: 50,
            y,
            ...spanishTextOptions
          });
          
          // Dibujar el texto español con saltos de línea mejorados
          y = drawWrappedText(translation, {
            x: 75,
            y,
            ...spanishTextOptions
          });
          
          // Espacio adicional entre pares de frases
          y -= 25;
        } catch (error: unknown) {
          console.error(`Error procesando par de frases: ${error instanceof Error ? error.message : String(error)}`);
          // Continuar con el siguiente par de frases si hay un error
        }
      }
      
      // Añadir numeración de páginas al pie de cada página
      for (let i = 0; i < pageCount; i++) {
        const p = pdfDoc.getPage(i);
        const pageSize = p.getSize();
        
        p.drawText(`Página ${i+1} de ${pageCount}`, {
          x: pageSize.width / 2 - 40, // Centrado aproximado
          y: 30,
          size: 10,
          color: rgb(0.5, 0.5, 0.5),
          font: helvetica
        });
      }
      
      // Actualizar estado a completado
      if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        global.translationProgress[sessionId].status = 'completed';
        global.translationProgress[sessionId].totalPages = pageCount;
      }
      
      // Guardar el PDF
      const translatedPdfBytes: Uint8Array = await pdfDoc.save();

      // Convertir el Uint8Array traducido a Buffer ANTES de llamar a addCoverPage
      const translatedPdfBuffer = Buffer.from(translatedPdfBytes);

      // Agregar la portada al PDF traducido
      const finalPdfBuffer = await addCoverPage(buffer, translatedPdfBuffer);

      const outputFilename = `translated_${originalFilename}`;
      const outputPath = join(uploadsDir, outputFilename);
      await writeFile(outputPath, finalPdfBuffer);
      
      // Leer el archivo para enviarlo como respuesta
      const fileContent = await readFile(outputPath);
      
      // Limpiar archivos temporales (de forma asíncrona para no retrasar la respuesta)
      Promise.all([
        unlink(filePath).catch(err => console.error('Error eliminando archivo original:', err)),
        unlink(outputPath).catch(err => console.error('Error eliminando archivo traducido:', err))
      ]);
      
      // Devolver el PDF como respuesta
      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="translated_document.pdf"`,
        },
      });
      
    } catch (error) { // Este catch manejará el error de timeout lanzado desde el bucle while
      console.error(`Error durante el proceso de traducción o creación de PDF:`, error);
      // Actualizar estado a error si existe la sesión
      if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        global.translationProgress[sessionId].status = 'error';
      }
      // Devolver un error genérico al cliente
      return NextResponse.json({ 
        error: `Error durante el procesamiento del archivo.`,
        details: error instanceof Error ? error.message : String(error) // Incluir el mensaje de timeout si es el caso
      }, { status: 500 });
    }
    
  } catch (error: unknown) {
    console.error('Error procesando el PDF:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ 
      error: 'Error procesando el PDF', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}