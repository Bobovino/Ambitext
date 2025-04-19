import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { join, parse } from 'path'
import { getFileType, extractTextFromFile } from '../../../lib/fileProcessors'

// --- Define Progress State Interface ---
interface ProgressState {
  totalSentences: number;
  completedSentences: number;
  totalPages: number; // Keep for estimation/display if needed
  currentPage: number; // Keep for estimation/display if needed
  totalBatches: number; // Added
  completedBatches: number; // Added
  status: 'processing' | 'completed' | 'error' | 'partial_error'; // Added 'partial_error'
  limitedMode?: boolean;
  processedPages?: number;
  totalPdfPages?: number;
}
// --- End Interface ---

// --- Define Global Structure (Optional but helps TS) ---
declare global {
  var translationProgress: { [key: string]: ProgressState };
}
// --- End Global Structure ---

// Función para asegurar que existe un directorio
async function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }
}

class HeadersTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeadersTimeoutError';
    this.code = 'HEADERS_TIMEOUT'; 
  }
  code: string;
}

class EasyNMTProcessingError extends Error {
  constructor(message: string, public httpStatus?: number) { // La declaración 'public' aquí es suficiente
    super(message);
    this.name = 'EasyNMTProcessingError';
  }
}

// --- NUEVA FUNCIÓN PARA TRADUCIR CON EASYNMT ---
async function translateWithEasyNMT(texts: string[]): Promise<string[]> {
  const maxRetries = 10; // Menos reintentos para local
  const retryDelay = 1000;
  let attempt = 0;
  const apiUrl = process.env.EASYNMT_API_URL || 'http://localhost:24080';
  const targetLang = process.env.EASYNMT_TARGET_LANG || 'es'; // Idioma destino

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`Enviando solicitud a EasyNMT (Intento ${attempt}/${maxRetries}, Lote: ${texts.length})`, { apiUrl, targetLang, texts: texts.slice(0, 2) });

      const response = await fetch(`${apiUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json' // Añadido por si acaso
        },
        body: JSON.stringify({
          text: texts, 
          target_lang: targetLang,
          source_lang: 'de', // Opcional: especificar idioma origen si se sabe
          perform_sentence_splitting: false // Ya dividimos antes
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Respuesta de error de EasyNMT (Intento ${attempt}/${maxRetries}):`, response.status, response.statusText, errorText);

        // --- MODIFICACIÓN: Lanzar error 5xx INMEDIATAMENTE ---
        if (response.status === 503 || response.status >= 500) {
           // Lanzar error específico INMEDIATAMENTE para que el llamador (POST) reduzca el lote
           throw new EasyNMTProcessingError(`Error ${response.status} en la API de EasyNMT: ${errorText}`, response.status);
        }
        // --- FIN MODIFICACIÓN ---

        // Para otros errores (4xx), lanzar error genérico inmediatamente (sin reintentos internos)
        throw new Error(`Error en la API de EasyNMT: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Respuesta recibida de EasyNMT:', result);

      if (result && Array.isArray(result.translated)) {
        console.log('Traducciones extraídas de EasyNMT:', result.translated.slice(0, 2));
        // Asegurarse de que la longitud coincida con la entrada
        if (result.translated.length !== texts.length) {
            console.warn(`Advertencia: El número de traducciones (${result.translated.length}) no coincide con el número de textos enviados (${texts.length}).`);
            // Podrías intentar rellenar con placeholders o lanzar un error más específico
            // Por ahora, devolvemos lo que tenemos, podría causar problemas más adelante.
        }
        return result.translated.map((t: any) => String(t || '')); // Convertir a string y manejar null/undefined
      } else {
        console.warn('Formato de respuesta inesperado de EasyNMT:', result);
        throw new EasyNMTProcessingError(`Formato de respuesta inesperado de EasyNMT: ${JSON.stringify(result)}`);
      }

    } catch (error: any) {
      console.error(`Error durante la traducción con EasyNMT (Intento ${attempt}/${maxRetries}):`, error);

      // --- MANTENER REINTENTOS SOLO PARA ERRORES DE CONEXIÓN ---
      // Solo reintentar aquí si es un error de conexión (ej. Docker no responde)
      if ((error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) && attempt < maxRetries) {
          console.log(`Error de conexión con EasyNMT. Reintentando en ${retryDelay / 1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Reintentar solo si es error de conexión
      }
      // --- FIN REINTENTOS DE CONEXIÓN ---

      // Si no es error de conexión o se agotaron reintentos, relanzar para que POST lo maneje
      // Si era un EasyNMTProcessingError (5xx), ya se lanzó desde el try block anterior
      throw error;
    }
  }
  // Si el bucle termina sin devolver, algo fue mal
  throw new EasyNMTProcessingError(`Se agotaron los reintentos (${maxRetries}) para la traducción con EasyNMT (fin inesperado).`);
}
// --- FIN FUNCIÓN EASYNMT ---

// Función para traducir texto - CON RETRASOS DE REINTENTO y SEÑAL DE TIMEOUT
async function translateWithHuggingFace(texts: string[]): Promise<string[]> {
  const maxRetries = 15;
  const retryDelay = 2000;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const apiUrl = process.env.HF_API_URL || '';
      const apiToken = process.env.HF_API_TOKEN || '';

      if (!apiUrl) {
        throw new Error('HF_API_URL no está configurado en las variables de entorno');
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      console.log(`Enviando solicitud a Hugging Face (Intento ${attempt}/${maxRetries}, Tamaño Lote: ${texts.length})`, { apiUrl, texts: texts.slice(0, 2) });
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: texts,
          options: {
            wait_for_model: true,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Respuesta de error de Hugging Face (Intento ${attempt}/${maxRetries}):`, response.status, response.statusText, errorText);
        if ((response.status === 503 || response.status >= 500) && attempt < maxRetries) {
          console.log(`Reintentando por error ${response.status} en ${retryDelay / 1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Retry after delay
        }
        throw new Error(`Error en la API de traducción: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Respuesta recibida de Hugging Face:', result);

      if (Array.isArray(result)) {
        if (result.length > 0 && result[0].translation_text) {
          const translations = result.map((item: any) => item.translation_text);
          console.log('Traducciones extraídas:', translations.slice(0, 2));
          return translations;
        }
        console.warn('Formato de array inesperado, devolviendo array:', result);
        return result.map(item => String(item));
      } else if (result && typeof result === 'object' && 'translations' in result && Array.isArray(result.translations)) {
        console.log('Usando el array result.translations:', result.translations.slice(0, 2));
        return result.translations;
      } else if (typeof result === 'string') {
        console.log('Respuesta es string:', result);
        return [result];
      } else if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
        console.warn(`Error devuelto por la API de Hugging Face: ${result.error}`);
        if (result.error.includes("currently loading") && attempt < maxRetries) {
          const estimatedTime = result.estimated_time || (retryDelay / 1000);
          const waitTime = Math.max(retryDelay, estimatedTime * 1000);
          console.log(`Modelo cargando. Reintentando en ${waitTime / 1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry after delay
        }
        throw new Error(`Error en la API de traducción: ${result.error}`);
      } else {
        console.warn('Formato de respuesta inesperado:', result);
        throw new Error(`Formato de respuesta inesperado de la API: ${JSON.stringify(result)}`);
      }
    } catch (error: any) {
      console.error(`Error durante la traducción con Hugging Face (Intento ${attempt}/${maxRetries}):`, error);

      // --- CHECK FOR HEADERS TIMEOUT ---
      if (error.cause?.code === 'UND_ERR_HEADERS_TIMEOUT') {
        console.warn(`Headers Timeout detectado (Intento ${attempt}/${maxRetries}).`);
        // Throw specific error to signal the caller to reduce batch size
        throw new HeadersTimeoutError(`Headers timeout occurred on attempt ${attempt}`);
      }
      // --- END CHECK ---

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
  const paragraphs = text.split(/\n\s*\n/);
  const sentences: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;

    const sentenceRegex = /([^.!?]+[.!?]+\s*)/g;
    const matches = paragraph.match(sentenceRegex);

    if (matches && matches.length > 0) {
      sentences.push(...matches.map(s => s.trim()).filter(s => s.length > 0));
    } else {
      sentences.push(paragraph.trim());
    }
  }

  const result: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length > 200) {
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

  let remaining = longSentence;
  while (remaining.length > maxLength) {
    let cutPoint = maxLength;
    while (cutPoint > 0 && remaining[cutPoint] !== ' ') {
      cutPoint--;
    }

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

  sanitized = sanitized.replace(/ﬁ/g, 'fi');
  sanitized = sanitized.replace(/ﬂ/g, 'fl');
  sanitized = sanitized.replace(/[\n\r]+/g, ' ');
  sanitized = sanitized.replace(/\s+/g, ' ');
  sanitized = sanitized.replace(/[^\x00-\xFF]/g, (char) => {
    switch (char) {
      case '\u201E':
      case '\u201C':
      case '\u201D':
        return '"';
      case '\u2018':
      case '\u2019':
        return "'";
      case '\u2026':
        return '...';
      case '\u2013':
      case '\u2014':
        return '-';
      default:
        return ' ';
    }
  });

  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized.trim();
}

// Obtener configuración desde variables de entorno
const CONFIG = {
  limitedMode: process.env.LIMITED_MODE !== 'false',
  maxPages: parseInt(process.env.MAX_PAGES || '3')
};

async function addCoverPage(originalPdfBuffer: Buffer, translatedPdfBuffer: Buffer): Promise<Buffer> {
  try {
    const originalPdfDoc = await PDFDocument.load(originalPdfBuffer);
    const translatedPdfDoc = await PDFDocument.load(translatedPdfBuffer);
    const finalPdfDoc = await PDFDocument.create();

    // Copy original cover page (page 0)
    const [coverPage] = await finalPdfDoc.copyPages(originalPdfDoc, [0]);
    finalPdfDoc.addPage(coverPage);

    // Copy all pages from the translated document (which might include a warning page)
    const translatedPages = await finalPdfDoc.copyPages(translatedPdfDoc, translatedPdfDoc.getPageIndices());
    translatedPages.forEach((page) => finalPdfDoc.addPage(page));

    const finalPdfBytes = await finalPdfDoc.save();
    return Buffer.from(finalPdfBytes);
  } catch (error) {
    console.error("Error in addCoverPage:", error);
    // Fallback: return the translated buffer without the original cover page if merging fails
    return translatedPdfBuffer;
  }
}

// --- Helper function to format duration ---
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min ${seconds} seg`;
}
// --- End Helper function ---

export async function POST(req: NextRequest) {
  const processStartTime = Date.now();
  let filePath: string | null = null;
  let sessionId: string | null = null;
  let originalFileBuffer: Buffer | null = null;

  // --- OBTENER PROVEEDOR DE TRADUCCIÓN ---
  const translationProvider = process.env.TRANSLATION_PROVIDER || 'huggingface';
  console.log(`Usando proveedor de traducción: ${translationProvider}`);
  // --- FIN OBTENER PROVEEDOR ---

  try {
    // --- VALIDACIÓN INICIAL BASADA EN PROVEEDOR ---
    if (translationProvider === 'huggingface' && !process.env.HF_API_URL) {
      console.error('Error: HF_API_URL no está configurada para el proveedor Hugging Face');
      return NextResponse.json({ error: 'Error de configuración del servidor (HF)' }, { status: 500 });
    }
    if (translationProvider === 'easynmt' && !process.env.EASYNMT_API_URL) {
      console.warn('Advertencia: EASYNMT_API_URL no está configurada, usando default http://localhost:24080');
    }
    // --- FIN VALIDACIÓN ---

    const uploadsDir = join(process.cwd(), 'uploads')
    await ensureDir(uploadsDir)

    const formData = await req.formData()
    const pdfFile = formData.get('pdfFile') as File | null
    sessionId = formData.get('sessionId') as string | null

    if (!pdfFile) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 })
    }

    const bytes = await pdfFile.arrayBuffer()
    originalFileBuffer = Buffer.from(bytes); // Keep original buffer

    const timestamp = Date.now()
    const originalFilename = pdfFile.name
    filePath = join(uploadsDir, `${timestamp}_${originalFilename}`)

    await writeFile(filePath, originalFileBuffer)

    const fileType = getFileType(originalFilename);

    if (fileType === 'unknown') {
      return NextResponse.json({ error: 'Tipo de archivo no soportado. Por favor, sube un PDF, EPUB o MOBI.' }, { status: 400 })
    }

    console.log(`Procesando archivo ${fileType}: ${originalFilename}`);

    let translationErrorOccurred = false;
    let batchErrorMessage = '';

    try {
      let fullText = '';
      let totalPages = 1;

      if (fileType === 'pdf') {
        const originalPdfDoc = await PDFDocument.load(originalFileBuffer);
        totalPages = originalPdfDoc.getPageCount();

        if (CONFIG.limitedMode) {
          const pagesToProcess = Math.min(CONFIG.maxPages, totalPages);

          const limitedPdfDoc = await PDFDocument.create();
          const copiedPages = await limitedPdfDoc.copyPages(
            originalPdfDoc, 
            Array.from({length: pagesToProcess}, (_, i) => i)
          );

          copiedPages.forEach(page => limitedPdfDoc.addPage(page));
          const limitedPdfBytes = await limitedPdfDoc.save();

          const pdfjs = await import('pdf-parse');
          const pdfData = await pdfjs.default(Buffer.from(limitedPdfBytes));
          fullText = pdfData.text;
          console.log(`Procesando solo ${pagesToProcess} de ${totalPages} páginas totales (modo limitado)`);
        } else {
          const pdfjs = await import('pdf-parse');
          const pdfData = await pdfjs.default(originalFileBuffer);
          fullText = pdfData.text;
          console.log(`Procesando todas las ${totalPages} páginas (modo completo)`);
        }
      } else {
        console.log(`Extrayendo texto de ${fileType}...`);
        try {
          fullText = await extractTextFromFile(filePath, fileType);

          const estimatedCharsPerPage = 2000;
          totalPages = Math.ceil(fullText.length / estimatedCharsPerPage) || 1;

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

      const sentences = splitIntoSentences(fullText);

      console.log('--- Sentences BEFORE sanitization ---');
      console.log(JSON.stringify(sentences.slice(0, 10), null, 2));

      const cleanedSentences = sentences.map(sentence => sanitizeText(sentence));

      console.log('--- Sentences AFTER sanitization ---');
      console.log(JSON.stringify(cleanedSentences.slice(0, 10), null, 2));

      const originalSentenceCount = cleanedSentences.length;

      const pagesToProcess = CONFIG.limitedMode ? Math.min(CONFIG.maxPages, totalPages) : totalPages;
      console.log(`Se procesarán ${originalSentenceCount} frases de las primeras ${pagesToProcess} páginas`);

      const estimatedPagesCount = Math.ceil(sentences.length / 10);

      if (sessionId) {
        if (typeof global.translationProgress === 'undefined') {
          global.translationProgress = {};
        }

        global.translationProgress[sessionId] = {
          totalSentences: cleanedSentences.length,
          completedSentences: 0,
          totalPages: estimatedPagesCount || 1,
          currentPage: 0,
          status: 'processing',
          limitedMode: CONFIG.limitedMode,
          processedPages: CONFIG.limitedMode ? Math.min(CONFIG.maxPages, totalPages) : totalPages,
          totalPdfPages: totalPages,
          totalBatches: Math.ceil(originalSentenceCount / 25),
          completedBatches: 0
        };

        console.log(`Progreso inicializado para sesión ${sessionId}:`, global.translationProgress[sessionId]);
      }

      const translatedSentences: Array<{ original: string; translation: string }> = [];
      const initialBatchSize = translationProvider === 'easynmt' ? 50 : 25; // EasyNMT podría manejar lotes más grandes
      const minBatchSize = 5;
      let currentBatchSize = initialBatchSize;
      let i = 0;
      let batchCounter = 0;

      while (i < cleanedSentences.length) {
        batchCounter++;
        const batch = cleanedSentences.slice(i, i + currentBatchSize);
        console.log(`Procesando Lote #${batchCounter} (Índice ${i}, Tamaño ${batch.length}) con ${translationProvider}...`);

        try {
          // --- LLAMADA CONDICIONAL A LA FUNCIÓN DE TRADUCCIÓN ---
          let results: string[];
          if (translationProvider === 'easynmt') {
            results = await translateWithEasyNMT(batch);
          } else { // Por defecto o si es 'huggingface'
            results = await translateWithHuggingFace(batch);
          }
          // --- FIN LLAMADA CONDICIONAL ---

          // Asegurarse de que results tenga la misma longitud que batch
          if (results.length !== batch.length) {
             console.warn(`Discrepancia en tamaño de lote: entrada=${batch.length}, salida=${results.length}. Rellenando con placeholders.`);
             // Rellenar 'results' si es más corto, o truncar si es más largo
             const correctedResults = new Array(batch.length).fill('(Error de tamaño de lote)');
             for(let k=0; k < Math.min(results.length, batch.length); k++) {
                 correctedResults[k] = results[k];
             }
             results = correctedResults;
          }


          for (let j = 0; j < batch.length; j++) {
            const translationText = results[j] || '(No translation)'; // Usar placeholder si falta
            const sanitizedTranslation = sanitizeText(translationText);
            
            translatedSentences.push({ 
              original: batch[j], 
              translation: sanitizedTranslation 
            });
            
            if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
              const newCompletedCount = i + j + 1;
              global.translationProgress[sessionId].completedSentences = newCompletedCount;

              if (newCompletedCount % 10 === 0 || newCompletedCount === cleanedSentences.length) {
                console.log(`Progreso de traducción: ${newCompletedCount}/${cleanedSentences.length} frases`);
              }
            }
          }

          if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
            global.translationProgress[sessionId].completedBatches = batchCounter;
          }

          i += batch.length;
          // Resetear tamaño de lote si fue exitoso (especialmente si se redujo por error)
          currentBatchSize = initialBatchSize; 

        } catch (batchError: any) {
          // --- MANEJO DE ERRORES ESPECIALIZADO ---
          if (translationProvider === 'huggingface' && (batchError instanceof HeadersTimeoutError || batchError.code === 'HEADERS_TIMEOUT')) {
            // Lógica específica de Hugging Face para HeadersTimeout
            console.warn(`Headers Timeout Error (HF) recibido para el lote en índice ${i}. Reduciendo tamaño de lote.`);
            const oldBatchSize = currentBatchSize;
            currentBatchSize = Math.max(minBatchSize, Math.floor(currentBatchSize / 2));
            console.log(`Tamaño de lote reducido de ${oldBatchSize} a ${currentBatchSize}. Reintentando el mismo lote...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa antes de reintentar
            // No incrementar 'i', reintentar el mismo lote con tamaño reducido
          
          // --- NUEVA LÓGICA PARA EASYNMT 5xx ---
          } else if (translationProvider === 'easynmt' && batchError instanceof EasyNMTProcessingError && batchError.httpStatus && batchError.httpStatus >= 500) { // Usar httpStatus
             console.warn(`Error ${batchError.httpStatus} (EasyNMT) recibido para el lote en índice ${i}. Reduciendo tamaño de lote.`); // Usar httpStatus
             const oldBatchSize = currentBatchSize;
             currentBatchSize = Math.max(minBatchSize, Math.floor(currentBatchSize / 2));
             console.log(`Tamaño de lote reducido de ${oldBatchSize} a ${currentBatchSize}. Reintentando el mismo lote...`);
             if (currentBatchSize === oldBatchSize && oldBatchSize === minBatchSize) {
                // Si ya estamos en el tamaño mínimo y sigue fallando, es irrecuperable
                console.error(`Error ${batchError.httpStatus} persistente en EasyNMT incluso con tamaño de lote mínimo (${minBatchSize}). Abortando.`); // Usar httpStatus
                translationErrorOccurred = true;
                batchErrorMessage = `Error ${batchError.httpStatus} persistente en EasyNMT: ${batchError.message}`; // Usar httpStatus
                if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
                  global.translationProgress[sessionId].status = 'partial_error';
                }
                break; // Detener el bucle
             }
             await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa
             // No incrementar 'i', reintentar el mismo lote con tamaño reducido
          // --- FIN NUEVA LÓGICA ---

          } else if (translationProvider === 'easynmt' && batchError.code === 'ECONNREFUSED') {
             // Error específico de EasyNMT si no se puede conectar (sin reducción de lote)
             console.error(`Error de conexión con EasyNMT en el lote ${i}. Asegúrate de que el contenedor Docker está en ejecución y accesible en ${process.env.EASYNMT_API_URL}.`);
             translationErrorOccurred = true;
             batchErrorMessage = `No se pudo conectar al servicio local EasyNMT. (${batchError.message})`;
             if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
               global.translationProgress[sessionId].status = 'error'; // Error irrecuperable
             }
             break; // Detener el proceso
          }
          else {
            // Error genérico o irrecuperable para cualquier proveedor
            console.error(`Error definitivo al traducir el lote en índice ${i} con ${translationProvider}:`, batchError);
            translationErrorOccurred = true;
            batchErrorMessage = batchError instanceof Error ? batchError.message : String(batchError);
            console.log("Deteniendo el bucle de traducción debido a un error definitivo. Se generará un PDF parcial.");
            if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
              global.translationProgress[sessionId].status = 'partial_error';
            }
            break; // Detener el bucle
          }
          // --- FIN MANEJO DE ERRORES ---
        }
      }

      console.log(`Generando PDF ${translationErrorOccurred ? 'parcial' : 'completo'} con contenido traducido...`);
      
      const translatedPdfDoc = await PDFDocument.create();
      const helvetica = await translatedPdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaOblique = await translatedPdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const helveticaBold = await translatedPdfDoc.embedFont(StandardFonts.HelveticaBold);

      // --- Create and Draw Metadata Page (as the first page) ---
      const metadataPage = translatedPdfDoc.addPage([595, 842]);
      let metaY = metadataPage.getHeight() - 70; // Start Y position for metadata
      const metaX = 50;
      const metaLineHeight = 18;
      const metaTitleSize = 18;
      const metaInfoSize = 11;
      const metaLegendSize = 10;

      metadataPage.drawText("Documento Traducido", {
        x: metaX, y: metaY, size: metaTitleSize, font: helveticaBold
      });
      metaY -= metaLineHeight * 2;

      metadataPage.drawText(`Nombre original: ${originalFilename}`, {
        x: metaX, y: metaY, size: metaInfoSize, font: helvetica
      });
      metaY -= metaLineHeight;

      metadataPage.drawText(`Formato original: ${fileType.toUpperCase()}`, {
        x: metaX, y: metaY, size: metaInfoSize, font: helvetica
      });
      metaY -= metaLineHeight;

      metadataPage.drawText(`Fecha: ${new Date().toLocaleDateString()}`, {
        x: metaX, y: metaY, size: metaInfoSize, font: helvetica
      });
      metaY -= metaLineHeight * 1.5;

      // Status Message
      let statusMessage = '';
      if (translationErrorOccurred) {
        statusMessage = `Parcial - La traducción se interrumpió.`;
      } else if (CONFIG.limitedMode) {
        statusMessage = `Parcial (Modo Limitado) - Se han procesado las primeras ${pagesToProcess} páginas.`;
      } else {
        statusMessage = `Completo - Se han procesado las ${totalPages} páginas.`;
      }
      metadataPage.drawText(statusMessage, {
        x: metaX, y: metaY, size: metaInfoSize, font: helveticaBold
      });
      metaY -= metaLineHeight;

      // Add error details if applicable
      if (translationErrorOccurred) {
         metadataPage.drawText(`Error: ${batchErrorMessage.substring(0, 100)}${batchErrorMessage.length > 100 ? '...' : ''}`, {
           x: metaX, y: metaY, size: metaInfoSize - 1, font: helvetica, color: rgb(0.8, 0.1, 0.1)
         });
         metaY -= metaLineHeight * 1.5;
      } else {
         metaY -= metaLineHeight * 0.5; // Smaller gap if no error
      }

      metadataPage.drawText(`Traducido con: ${translationProvider === 'easynmt' ? 'EasyNMT (Local)' : 'Hugging Face API'}`, {
        x: metaX, y: metaY, size: metaInfoSize, font: helvetica
      });
      metaY -= metaLineHeight * 2;

      // Legend
      const germanColor = rgb(0.1, 0.3, 0.6);
      const spanishColor = rgb(0, 0, 0);
      metadataPage.drawText("DE: texto en alemán (azul)", {
        x: metaX, y: metaY, size: metaLegendSize, font: helveticaBold, color: germanColor
      });
      metaY -= metaLineHeight * 0.8;
      metadataPage.drawText("ES: traducción al español (negro)", {
        x: metaX, y: metaY, size: metaLegendSize, font: helveticaOblique, color: spanishColor
      });
      // --- End Metadata Page ---

      // --- Add Pages for Translated Content ---
      let contentCurrentPage = translatedPdfDoc.addPage([595, 842]); // First page for actual content
      let contentPageCount = 2; // Start counting from 2 (metadata is page 1)
      const { width, height } = contentCurrentPage.getSize();
      const fontSize = 11;
      const lineHeight = fontSize * 1.2;
      let y = height - 50;

      const germanTextOptions = { size: fontSize, color: germanColor, font: helveticaBold };
      const spanishTextOptions = { size: fontSize, color: spanishColor, font: helveticaOblique };

      // --- Define drawWrappedText for translatedPdfDoc ---
      const drawWrappedText = (text: string, options: any): number => {
        const safeText = sanitizeText(text);
        const maxWidth = width - 100;
        const textLineHeight = options.size * 1.2;
        const words = safeText.split(' ');
        let line = '';
        let yPos = options.y;

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = line + (line ? ' ' : '') + word;
          try {
            const textWidth = options.font.widthOfTextAtSize(testLine, options.size);
            if (textWidth > maxWidth && line !== '') {
              contentCurrentPage.drawText(line, { ...options, y: yPos });
              line = word;
              yPos -= textLineHeight;
              if (yPos < 50) {
                contentCurrentPage = translatedPdfDoc.addPage([595, 842]);
                contentPageCount++;
                yPos = contentCurrentPage.getHeight() - 50;
                if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
                   global.translationProgress[sessionId].totalPages =
                     Math.max(global.translationProgress[sessionId].totalPages, contentPageCount + (translationErrorOccurred ? 1 : 0));
                }
              }
            } else {
              line = testLine;
            }
          } catch (error: unknown) {
            console.warn(`Error al procesar palabra "${word}": ${error instanceof Error ? error.message : String(error)}`);
            line = line || '';
          }
        }
        if (line) {
          try {
            contentCurrentPage.drawText(line, { ...options, y: yPos });
          } catch (error: unknown) {
            console.warn(`Error al añadir la última línea "${line}": ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        return yPos - textLineHeight;
      };
      // --- End drawWrappedText definition ---

      // --- Draw the translated sentences into translatedPdfDoc ---
      for (const { original, translation } of translatedSentences) {
        try {
          const minimumHeightNeeded = lineHeight * 2 + 20;
          
          if (y - minimumHeightNeeded < 50) {
            contentCurrentPage = translatedPdfDoc.addPage([595, 842]);
            contentPageCount++;
            y = contentCurrentPage.getHeight() - 50;
            
            if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
              global.translationProgress[sessionId].currentPage = contentPageCount;
              global.translationProgress[sessionId].totalPages = 
                Math.max(global.translationProgress[sessionId].totalPages, contentPageCount);
            }
          }
          
          y = drawWrappedText(original, {
            x: 50,
            y,
            ...germanTextOptions
          });
          
          y -= 10;
          
          y = drawWrappedText(translation, {
            x: 50,
            y,
            ...spanishTextOptions
          });
          
          y -= 25;
        } catch (error: unknown) {
          console.error(`Error procesando par de frases: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      // --- End drawing translated sentences ---

      // --- Draw Page Numbers on translatedPdfDoc (excluding metadata page) ---
      const pageIndicesToNumber = translatedPdfDoc.getPageIndices();
      pageIndicesToNumber.shift(); // Don't number the metadata page
      pageIndicesToNumber.forEach((pageIndex, i) => {
         const p = translatedPdfDoc.getPage(pageIndex);
         const pageSize = p.getSize();
         p.drawText(`Página ${i + 1}`, { // Number content pages sequentially from 1
            x: pageSize.width / 2 - 20, y: 30, size: 10, color: rgb(0.5, 0.5, 0.5), font: helvetica
         });
      });
      // --- End Draw Page Numbers ---

      // --- Calculate Duration and Add to Last Content Page ---
      const processEndTime = Date.now();
      const durationMs = processEndTime - processStartTime;
      const durationString = formatDuration(durationMs);
      const durationText = `Tiempo total de procesamiento: ${durationString}${translationErrorOccurred ? ' (Interrumpido)' : ''}`;

      try {
        const lastPageIndex = translatedPdfDoc.getPageCount() - 1; // Index of the last page (which is a content page)
        if (lastPageIndex >= 1) { // Ensure there's at least one content page besides metadata
          const lastPage = translatedPdfDoc.getPage(lastPageIndex);
          lastPage.drawText(durationText, {
            x: 50, y: 15, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5),
          });
        }
      } catch (drawError) {
         console.warn("No se pudo añadir el tiempo de procesamiento al PDF:", drawError);
      }
      // --- End Add Duration ---

      // Update final status
      if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        if (!translationErrorOccurred) {
           global.translationProgress[sessionId].status = 'completed';
           global.translationProgress[sessionId].completedBatches = batchCounter;
        }
        global.translationProgress[sessionId].totalPages = translatedPdfDoc.getPageCount();
      }

      // Save the translated content PDF (metadata + content + duration)
      const translatedPdfBytes: Uint8Array = await translatedPdfDoc.save();
      const translatedPdfBuffer = Buffer.from(translatedPdfBytes);

      // --- Use addCoverPage to prepend the original cover ---
      console.log("Añadiendo portada original al PDF traducido...");
      if (!originalFileBuffer) {
         throw new Error("No se encontró el buffer del archivo original para añadir la portada.");
      }
      const finalPdfBuffer = await addCoverPage(originalFileBuffer, translatedPdfBuffer);
      // --- End using addCoverPage ---

      const parsedOriginalFilename = parse(originalFilename);
      const outputFilenameBase = parsedOriginalFilename.name;
      const outputFilenameSuffix = translationErrorOccurred ? '_partial_translated.pdf' : '_translated.pdf';
      const outputFilename = `${outputFilenameBase}${outputFilenameSuffix}`;

      if (filePath && existsSync(filePath)) {
        await unlink(filePath).catch(err => console.error('Error eliminando archivo original temporal:', err));
      }

      console.log(`Devolviendo PDF ${translationErrorOccurred ? 'parcial' : 'completo'}: ${outputFilename}`);
      return new NextResponse(finalPdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${outputFilename}"`,
        },
      });

    } catch (error) {
      console.error(`Error durante el proceso de traducción o creación de PDF:`, error);
      if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        global.translationProgress[sessionId].status = 'error';
      }
      if (filePath && existsSync(filePath)) {
        await unlink(filePath).catch(err => console.error('Error eliminando archivo original temporal tras error:', err));
      }
      return NextResponse.json({ 
        error: `Error durante el procesamiento del archivo.`,
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error('Error procesando la solicitud inicial:', error instanceof Error ? error.message : String(error));
    if (filePath && existsSync(filePath)) {
        await unlink(filePath).catch(err => console.error('Error eliminando archivo original temporal tras error inicial:', err));
    }
    if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        delete global.translationProgress[sessionId];
    }
    return NextResponse.json({ 
      error: 'Error procesando la solicitud', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}