import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
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
  status: 'processing' | 'completed' | 'error' | 'partial_error'; 
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
async function translateWithEasyNMT(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
  const maxRetries = 10; // Menos reintentos para local
  const retryDelay = 1000;
  let attempt = 0;
  const apiUrl = process.env.EASYNMT_API_URL || 'http://localhost:24080';

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
          source_lang: sourceLang, // Usar idioma origen del formData
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
async function translateWithHuggingFace(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
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
          },
          source_lang: sourceLang, // Usar idioma origen del formData
          target_lang: targetLang, // Usar idioma destino del formData
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

// --- Helper function to sanitize text for PDF rendering ---
function sanitizeText(text: string): string {
  // Replace newlines/returns with a single space
  const cleanedText = text.replace(/[\r\n]+/g, ' ');
  // Remove other control characters
  // eslint-disable-next-line no-control-regex
  const noControlChars = cleanedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Collapse multiple spaces into one and trim
  return noControlChars.replace(/\s{2,}/g, ' ').trim();
}
// --- End sanitizeText ---

// --- Updated Interfaces for Structured Text ---
interface SentenceInfo {
  text: string;
  translation?: string; // Store translation here
}

interface BlockInfo {
  type: 'paragraph' | 'heading' | 'footer' | 'whitespace';
  originalText: string; // Raw text for the block
  sentences?: SentenceInfo[]; // For paragraphs, split into sentences
  translation?: string; // For headings if translated directly (optional)
}
// --- END Updated Interfaces ---

// --- Helper to split actual paragraphs into sentences ---
function splitLongSentence(longSentence: string): string[] {
  const maxLength = 250;
  const result: string[] = [];
  const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  if (urlRegex.test(longSentence)) {
    return [longSentence.trim()];
  }

  if (longSentence.includes(',')) {
    let currentChunk = '';
    const parts = longSentence.split(',');
    let needsCommaSuffix = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partWithCommaPrefix = needsCommaSuffix ? `,${part}` : part;
      const potentialChunk = currentChunk ? `${currentChunk}${partWithCommaPrefix}` : part.trim();

      if (potentialChunk.length <= maxLength) {
        currentChunk = potentialChunk;
        needsCommaSuffix = true;
      } else {
        if (currentChunk) {
          result.push(currentChunk.trim());
        }
        if (part.trim().length > maxLength) {
          const subChunks = splitBySpace(part.trim(), maxLength);
          result.push(...subChunks);
          currentChunk = '';
          needsCommaSuffix = false;
        } else {
          currentChunk = part.trim();
          needsCommaSuffix = true;
        }
      }
      if (i === parts.length - 1) {
        needsCommaSuffix = false;
      }
    }
    if (currentChunk) result.push(currentChunk.trim());

    if (result.some(chunk => chunk.length < 10) && result.length > 1) {
      return splitBySpace(longSentence, maxLength);
    }
    return result.filter(c => c.length > 0);
  } else {
    return splitBySpace(longSentence, maxLength);
  }
}

function splitBySpace(sentence: string, maxLength: number): string[] {
  const result: string[] = [];
  let remaining = sentence.trim();
  while (remaining.length > maxLength) {
    let cutPoint = maxLength;
    while (cutPoint > 0 && remaining[cutPoint] !== ' ') {
      cutPoint--;
    }
    if (cutPoint === 0) {
      cutPoint = maxLength;
    }
    result.push(remaining.substring(0, cutPoint).trim());
    remaining = remaining.substring(cutPoint).trim();
  }
  if (remaining.length > 0) {
    result.push(remaining);
  }
  return result.filter(c => c.length > 0);
}

function splitParagraphIntoSentences(paragraphText: string): SentenceInfo[] {
  const sentenceInfos: SentenceInfo[] = [];
  // Trim initially to handle leading/trailing whitespace in the paragraph itself
  const trimmedParagraph = paragraphText.trim();
  if (trimmedParagraph.length === 0) return [];

  const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  // Regex adjusted slightly - less aggressive lookahead might help
  const sentenceRegex = /[^.!?…]+(?:[.!?…](?![.?!"”’']?\s*[a-zäöüß0-9])|\r?\n|$)+/g;
  const matchResult = trimmedParagraph.match(sentenceRegex);
  let potentialSentences: string[] = matchResult ?? [trimmedParagraph];

  // Post-process to merge fragments
  const mergedSentences: string[] = [];
  if (potentialSentences.length > 0) {
    // Sanitize and add the first sentence if not empty
    const firstSentence = sanitizeText(potentialSentences[0]);
    if (firstSentence.length > 0) mergedSentences.push(firstSentence);

    for (let i = 1; i < potentialSentences.length; i++) {
      // Sanitize the current potential sentence fragment
      const currentSentence = sanitizeText(potentialSentences[i]);
      if (currentSentence.length === 0) continue; // Skip empty strings after sanitizing

      const prevSentence = mergedSentences.length > 0 ? mergedSentences[mergedSentences.length - 1] : null;
      const startsWithContinuationPunct = currentSentence.match(/^[,;:](?=\s|$)/);
      // Check if starts lowercase AND previous sentence exists and does NOT end with strong punctuation
      const startsLowercaseAndPrevIncomplete = currentSentence.match(/^[a-zäöüß]/) && prevSentence && !prevSentence.match(/[.!?…]$/);

      if (prevSentence && (startsWithContinuationPunct || startsLowercaseAndPrevIncomplete)) {
        // --- MODIFICATION: Remove leading punctuation if present before merging ---
        const textToAppend = startsWithContinuationPunct
          ? currentSentence.substring(1).trim() // Remove leading punctuation and trim again
          : currentSentence; // Already sanitized and trimmed

        if (textToAppend.length > 0) { // Ensure there's something left to append
            mergedSentences[mergedSentences.length - 1] += ` ${textToAppend}`;
        }
        // --- END MODIFICATION ---
      } else {
        // Otherwise, add it as a new sentence (already sanitized)
        mergedSentences.push(currentSentence);
      }
    }
  }
  // Sentences are now sanitized and merged
  potentialSentences = mergedSentences.filter(s => s.length > 0);

  // Split long sentences (Input sentences are already sanitized)
  for (const sentence of potentialSentences) {
    // No need to sanitize again here
    if (sentence.length > 250 && !urlRegex.test(sentence)) {
      const chunks = splitLongSentence(sentence); // splitLongSentence should handle trimming
      chunks.forEach(chunk => sentenceInfos.push({ text: chunk }));
    } else if (sentence.length > 0) {
      sentenceInfos.push({ text: sentence });
    }
  }
  return sentenceInfos;
}
// --- END Paragraph Splitting ---

function structurePageText(pageText: string): BlockInfo[] {
  const blocks: BlockInfo[] = [];
  const lines = pageText.split('\n');
  let currentParagraph = '';

  const headingRegex = /^(?:[A-ZÄÖÜẞ0-9\s.,'-]+|[A-ZÄÖÜẞ0-9]{2,})$/;
  const dateHeadingRegex = /^(AM\s+\d{1,2}\.\s+[A-ZÄÖÜẞ]+(?:\s+\d{4})?)$/i;
  const footerRegex = /^(?:Seite|Page|Página)\s+\d+|[A-ZÄÖÜẞ\s]+\d+$/i;
  const goetheFooterRegex = /^(JOHANN\s+WOLFGANG\s+VON\s+GOETHE\s+Die\s+Leiden\s+des\s+jungen\s+Werther\s+\d+)$/i;

  function flushParagraph() {
    const trimmedParagraph = currentParagraph.trim();
    if (trimmedParagraph.length > 0) {
      blocks.push({
        type: 'paragraph',
        originalText: trimmedParagraph,
        sentences: splitParagraphIntoSentences(trimmedParagraph)
      });
    }
    currentParagraph = '';
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const originalLine = lines[i];

    if (line.length === 0) {
      flushParagraph();
      if (blocks.length === 0 || blocks[blocks.length - 1].type !== 'whitespace') {
        blocks.push({ type: 'whitespace', originalText: '' });
      }
    } else if (headingRegex.test(line) || dateHeadingRegex.test(line)) {
      if (line.length < 80) {
        flushParagraph();
        blocks.push({ type: 'heading', originalText: line });
      } else {
        currentParagraph += originalLine + '\n';
      }
    } else if ((footerRegex.test(line) || goetheFooterRegex.test(line)) && i > lines.length - 5) {
      flushParagraph();
      if (blocks.length === 0 || blocks[blocks.length - 1].type !== 'footer') {
        blocks.push({ type: 'footer', originalText: line });
      }
    } else {
      currentParagraph += originalLine + '\n';
    }
  }
  flushParagraph();

  const finalBlocks: BlockInfo[] = [];
  for (const block of blocks) {
    if (block.type === 'whitespace' && finalBlocks.length > 0 && finalBlocks[finalBlocks.length - 1].type === 'whitespace') {
      continue;
    }
    if (block.type === 'footer' && block.originalText.trim().length === 0) {
      continue;
    }
    finalBlocks.push(block);
  }
  if (finalBlocks.length > 0 && finalBlocks[0].type === 'whitespace') finalBlocks.shift();
  if (finalBlocks.length > 0 && finalBlocks[finalBlocks.length - 1].type === 'whitespace') finalBlocks.pop();

  return finalBlocks;
}

async function extractTextFromPdfPage(pdfDoc: PDFDocument, pageIndex: number): Promise<string> {
  const singlePageDoc = await PDFDocument.create();
  const [page] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
  singlePageDoc.addPage(page);
  const pdfBytes = await singlePageDoc.save();
  const pdfjs = await import('pdf-parse');
  const data = await pdfjs.default(Buffer.from(pdfBytes));
  return data.text;
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

// --- Helper function to fetch and validate font (Moved outside POST) ---
async function fetchAndEmbedFont(
  pdfDoc: PDFDocument,
  fallbackFont: PDFFont,
  url: string,
  fontName: string
): Promise<PDFFont> { // Using PDFFont type
  try {
    console.log(`Fetching font: ${fontName} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${fontName}: ${response.status} ${response.statusText}`);
    }
    const fontBytes = await response.arrayBuffer();
    console.log(`Fetched ${fontName}, size: ${fontBytes.byteLength} bytes. Embedding...`);
    if (fontBytes.byteLength < 1000) { // Basic sanity check for font size
       console.warn(`Warning: Fetched font ${fontName} seems too small (${fontBytes.byteLength} bytes).`);
    }
    // --- MODIFICATION: Use pdfDoc passed as argument ---
    const embeddedFont = await pdfDoc.embedFont(fontBytes);
    console.log(`Embedded ${fontName} successfully.`);
    return embeddedFont;
  } catch (error) {
    console.error(`Error processing font ${fontName}:`, error);
    console.warn(`Falling back to fallback font for ${fontName}.`);
    // --- MODIFICATION: Use fallbackFont passed as argument ---
    return fallbackFont; // Fallback to the provided standard font
  }
}
// --- End Helper function ---

// Obtener configuración desde variables de entorno
const CONFIG = {
  limitedMode: process.env.LIMITED_MODE !== 'false',
  maxPages: parseInt(process.env.MAX_PAGES || '3')
};

export async function POST(req: NextRequest) {
  const processStartTime = Date.now();
  let filePath: string | null = null;
  let sessionId: string | null = null;
  let originalFileBuffer: Buffer | null = null;
  const translationProvider = process.env.TRANSLATION_PROVIDER || 'huggingface';
  console.log(`Usando proveedor de traducción: ${translationProvider}`);

  try {
    const uploadsDir = join(process.cwd(), 'uploads')
    await ensureDir(uploadsDir)

    const formData = await req.formData()
    const pdfFile = formData.get('pdfFile') as File | null
    sessionId = formData.get('sessionId') as string | null
    const sourceLang = formData.get('sourceLang') as string | null;
    const targetLang = formData.get('targetLang') as string | null;

    if (sessionId) {
      if (!global.translationProgress) global.translationProgress = {};
      global.translationProgress[sessionId] = {
        totalSentences: 0, // Will be calculated more accurately later
        completedSentences: 0,
        totalPages: 0,
        currentPage: 0,
        totalBatches: 0, // Consider removing or calculating differently
        completedBatches: 0, // Consider removing or calculating differently
        status: 'processing',
        limitedMode: CONFIG.limitedMode,
        processedPages: 0,
        totalPdfPages: 0,
      };
    }

    if (!pdfFile) return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 })
    if (!sourceLang || !targetLang) return NextResponse.json({ error: 'Faltan los idiomas de origen o destino' }, { status: 400 });

    const bytes = await pdfFile.arrayBuffer()
    originalFileBuffer = Buffer.from(bytes);
    const timestamp = Date.now()
    const originalFilename = pdfFile.name
    filePath = join(uploadsDir, `${timestamp}_${originalFilename}`)
    await writeFile(filePath, originalFileBuffer)
    const fileType = getFileType(originalFilename);

    if (fileType !== 'pdf') { // Simplified: only handle PDF for now
        if (filePath && existsSync(filePath)) await unlink(filePath);
        return NextResponse.json({ error: 'Tipo de archivo no soportado. Por favor, sube un PDF' }, { status: 400 })
    }

    console.log(`Procesando archivo PDF: ${originalFilename}`);

    const originalPdfDoc = await PDFDocument.load(originalFileBuffer);
    const totalPages = originalPdfDoc.getPageCount();
    const pagesToProcess = CONFIG.limitedMode ? Math.min(CONFIG.maxPages, totalPages) : totalPages;

    // --- Pre-calculate total sentences more accurately ---
    let totalSentencesEstimate = 0;
    console.log("Estimating total sentences...");
    for (let pageIndex = 1; pageIndex < pagesToProcess; pageIndex++) { // Skip cover page (index 0)
        try {
            const pageText = await extractTextFromPdfPage(originalPdfDoc, pageIndex);
            const blocks = structurePageText(pageText);
            blocks.forEach(block => {
                if (block.type === 'paragraph' && block.sentences) {
                    totalSentencesEstimate += block.sentences.length;
                }
            });
        } catch (extractError) {
            console.warn(`Error extracting text from page ${pageIndex} for estimation:`, extractError);
        }
    }
    console.log(`Estimated total sentences: ${totalSentencesEstimate}`);
    if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        global.translationProgress[sessionId].totalPages = totalPages; // Actual PDF pages
        global.translationProgress[sessionId].totalPdfPages = totalPages;
        global.translationProgress[sessionId].processedPages = 0;
        global.translationProgress[sessionId].totalSentences = totalSentencesEstimate; // Use estimate
        global.translationProgress[sessionId].completedSentences = 0;
    }
    // --- End pre-calculation ---


    const finalPdfDoc = await PDFDocument.create();
    // @ts-ignore - Suppress TS error as registerFontkit should exist at runtime
    finalPdfDoc.registerFontkit(fontkit);

    // 1. Portada original
    const [coverPage] = await finalPdfDoc.copyPages(originalPdfDoc, [0]);
    finalPdfDoc.addPage(coverPage);

    // 2. Página de metadatos (remains the same)
    const metadataPage = finalPdfDoc.addPage([595, 842]);
    // ... (metadata drawing logic - same as before) ...
    let metaY = metadataPage.getHeight() - 70;
    const metaX = 50;
    const metaLineHeight = 18;
    const metaTitleSize = 18;
    const metaInfoSize = 11;
    const metaLegendSize = 10;
    const helvetica = await finalPdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaOblique = await finalPdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const helveticaBold = await finalPdfDoc.embedFont(StandardFonts.HelveticaBold);
    const ebGaramondFont = await fetchAndEmbedFont(finalPdfDoc, helvetica, 'https://fonts.gstatic.com/s/ebgaramond/v27/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-6_RkC49_S6w.ttf', 'EB Garamond');
    const ebGaramondItalicFont = await fetchAndEmbedFont(finalPdfDoc, helveticaOblique, 'https://fonts.gstatic.com/s/ebgaramond/v27/SlGFmQSNjdsmc35JDF1K5GRwSDw_OMg-6_RkC49_S6wNkQ.ttf', 'EB Garamond Italic');
    const openSansFont = await fetchAndEmbedFont(finalPdfDoc, helvetica, 'https://fonts.gstatic.com/s/opensans/v34/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVc.ttf', 'Open Sans');
    const originalFontName = 'EB Garamond Italic';
    const translatedFontName = 'Open Sans';
    const originalTextFont = ebGaramondItalicFont;
    const translatedTextFont = openSansFont;
    const sourceColor = rgb(0, 0, 0);
    const targetColor = rgb(0.427, 0.427, 0.427); // #6D6D6D
    // ... (actual drawing calls for metadata - same as before) ...
    metadataPage.drawText("Documento Traducido", { x: metaX, y: metaY, size: metaTitleSize, font: helveticaBold });
    metaY -= metaLineHeight * 2.5;
    metadataPage.drawText(`Nombre original: ${originalFilename}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
    metaY -= metaLineHeight * 1.2;
    metadataPage.drawText(`Formato original: PDF`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
    metaY -= metaLineHeight * 1.2;
    metadataPage.drawText(`Fecha: ${new Date().toLocaleDateString()}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
    metaY -= metaLineHeight * 1.2;
    metaY -= metaLineHeight * 2;
    let statusMessage = '';
    if (CONFIG.limitedMode && pagesToProcess < totalPages) {
      statusMessage = `Parcial (Modo Limitado) - Se procesarán las primeras ${pagesToProcess} páginas (de ${totalPages}).`;
    } else {
      statusMessage = `Completo - Se procesarán las ${pagesToProcess} páginas.`;
    }
    metadataPage.drawText(statusMessage, { x: metaX, y: metaY, size: metaInfoSize, font: helveticaBold });
    metaY -= metaLineHeight * 1.5;
    metadataPage.drawText(`Traducido con: ${translationProvider === 'easynmt' ? 'EasyNMT (Local)' : 'Hugging Face API'}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
    metaY -= metaLineHeight * 1.2;
    metadataPage.drawText(`Traducción: ${sourceLang.toUpperCase()} -> ${targetLang.toUpperCase()}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
    metaY -= metaLineHeight * 1.2;
    metadataPage.drawText(`Fuente Original: ${originalFontName}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
    metaY -= metaLineHeight * 1.2;
    metadataPage.drawText(`Fuente Traducción: ${translatedFontName}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
    metaY -= metaLineHeight * 2;
    metadataPage.drawText(`${sourceLang.toUpperCase()}: texto original (${originalFontName})`, { x: metaX, y: metaY, size: metaLegendSize, font: helveticaBold, color: targetColor });
    metaY -= metaLineHeight;
    metadataPage.drawText(`${targetLang.toUpperCase()}: traducción (${translatedFontName})`, { x: metaX, y: metaY, size: metaLegendSize, font: helvetica, color: targetColor });


    const translatedPdfDir = join(process.cwd(), 'tests', 'batch_pipeline', 'pdfs_traducidos');
    await ensureDir(translatedPdfDir);
    let partialError = false;

    // 3. Process each page
    for (let pageIndex = 1; pageIndex < pagesToProcess; pageIndex++) { // Start from 1 (skip cover)
      console.log(`Procesando página ${pageIndex + 1} de ${totalPages}...`);
      try {
        if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
          global.translationProgress[sessionId].currentPage = pageIndex + 1; // User-facing page number
          global.translationProgress[sessionId].processedPages = pageIndex; // 0-based count of processed content pages
        }

        // 1. Add original page to the final PDF
        const [origPage] = await finalPdfDoc.copyPages(originalPdfDoc, [pageIndex]);
        finalPdfDoc.addPage(origPage);

        // 2. Extract text and structure it
        const pageText = await extractTextFromPdfPage(originalPdfDoc, pageIndex);
        const blocks = structurePageText(pageText); // Use the new structuring function

        // 3. Collect sentences for translation and map them back
        const sentencesToTranslate: string[] = [];
        const sentenceMap: { blockIndex: number; sentenceIndex: number }[] = [];
        blocks.forEach((block, bIndex) => {
          if (block.type === 'paragraph' && block.sentences) {
            block.sentences.forEach((sentence, sIndex) => {
              // No need to sanitize here, splitParagraphIntoSentences already did
              sentencesToTranslate.push(sentence.text);
              sentenceMap.push({ blockIndex: bIndex, sentenceIndex: sIndex });
            });
          }
          // Optional: Translate headings?
          // if (block.type === 'heading') { sentencesToTranslate.push(block.originalText); ... }
        });

        if (sentencesToTranslate.length === 0) {
             console.log(`Página ${pageIndex + 1} no contiene texto de párrafo para traducir.`);
             continue; // Skip to next page if no translatable text
        }

        // 4. Translate in batches (using existing robust logic)
        let translations: string[] = [];
        const initialBatchSize = translationProvider === 'easynmt' ? 50 : 25;
        const minBatchSize = 3;
        let currentBatchSize = initialBatchSize;
        let i_translate = 0;
        let batchRetryCount = 0;
        const maxBatchRetries = 3;

        while (i_translate < sentencesToTranslate.length) {
          const batchTexts = sentencesToTranslate.slice(i_translate, i_translate + currentBatchSize);
          if (batchTexts.length === 0) break;

          try {
            console.log(`  Traduc. lote ${Math.floor(i_translate / currentBatchSize) + 1}, Tamaño: ${batchTexts.length}, BatchSize: ${currentBatchSize}`);
            let results: string[];
            if (translationProvider === 'easynmt') {
              results = await translateWithEasyNMT(batchTexts, sourceLang, targetLang);
            } else {
              results = await translateWithHuggingFace(batchTexts, sourceLang, targetLang);
            }

            if (results.length !== batchTexts.length) {
                console.warn(`  Mismatch! Esperado ${batchTexts.length}, recibido ${results.length}. Rellenando.`);
                while (results.length < batchTexts.length) results.push("[Traducción faltante]");
                if (results.length > batchTexts.length) results = results.slice(0, batchTexts.length);
            }

            translations.push(...results);
            i_translate += batchTexts.length;
            currentBatchSize = initialBatchSize; // Reset batch size
            batchRetryCount = 0; // Reset retries

          } catch (batchError: any) {
            console.error(`  Error en lote (índice ${i_translate}): ${batchError.message}. Reduciendo tamaño.`);
            partialError = true;
            const oldBatchSize = currentBatchSize;
            currentBatchSize = Math.max(minBatchSize, Math.floor(currentBatchSize / 2));

            if (currentBatchSize === oldBatchSize && oldBatchSize === minBatchSize) {
                batchRetryCount++;
                if (batchRetryCount >= maxBatchRetries) {
                    console.error(`  Tamaño mínimo (${minBatchSize}) falló ${maxBatchRetries} veces. Saltando resto de frases en esta página.`);
                    const remainingCount = sentencesToTranslate.length - i_translate;
                    for (let k = 0; k < remainingCount; k++) translations.push("[Error de traducción]");
                    i_translate = sentencesToTranslate.length; // Force exit
                    break;
                } else {
                     console.warn(`  Reintentando tamaño mínimo (${batchRetryCount}/${maxBatchRetries})...`);
                     await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                batchRetryCount = 0;
                console.log(`  Tamaño de lote reducido a ${currentBatchSize}. Reintentando.`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } // End while translation batches

        // 5. Distribute translations back to the blocks structure
        translations.forEach((translation, index) => {
          if (index < sentenceMap.length) {
            const { blockIndex, sentenceIndex } = sentenceMap[index];
            if (blocks[blockIndex]?.type === 'paragraph' && blocks[blockIndex].sentences?.[sentenceIndex]) {
              blocks[blockIndex].sentences![sentenceIndex].translation = translation;
            }
          } else {
              console.warn(`  Índice de traducción ${index} fuera de límites (mapa: ${sentenceMap.length})`);
          }
        });

        // 6. Render the structured, translated content onto new PDF page(s)
        let translationPage = finalPdfDoc.addPage([595, 842]);
        let y = 792; // Top margin
        const width = 595;
        const fontSize = 12;
        const headingFontSize = 15;
        const lineHeight = fontSize * 1.4;
        const headingLineHeight = headingFontSize * 1.4;
        const pageMargin = 50;
        const footerY = 35;
        let currentPageNumber = 1; // Page number for the *translated* section of this original page

        const addPageNumber = (page: any, number: number, originalPageNum: number) => {
          page.drawText(`Página Trad. ${number} (Original ${originalPageNum})`, { // Clarify page number
            x: pageMargin,
            y: footerY,
            size: 9,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        };
        addPageNumber(translationPage, currentPageNumber, pageIndex + 1);

        const checkAddPage = (neededHeight: number): boolean => {
            if (y - neededHeight < (footerY + 30)) { // Check against footer + buffer
                translationPage = finalPdfDoc.addPage([595, 842]);
                currentPageNumber++;
                addPageNumber(translationPage, currentPageNumber, pageIndex + 1);
                y = 792; // Reset Y
                return true;
            }
            return false;
        };

        // --- Updated drawWrappedText to use checkAddPage ---
        const drawWrappedText = (text: string, options: any): { y: number } => {
            const safeText = text.replace(/\s+/g, ' ').trim();
            if (!safeText || safeText.length === 0) return { y: options.y }; // Skip empty

            const maxWidth = width - (pageMargin * 2);
            const textLineHeight = options.size * (options.lineHeightFactor || 1.4);
            const words = safeText.split(' ');
            let line = '';
            let yPos = options.y;
            const currentFont = options.font;

            for (let n = 0; n < words.length; n++) {
                const word = words[n];
                if (word.length === 0) continue;
                const testLine = line + (line ? ' ' : '') + word;
                let textWidth = 0;
                try { textWidth = currentFont.widthOfTextAtSize(testLine, options.size); }
                catch (e) { textWidth = line ? currentFont.widthOfTextAtSize(line, options.size) : 0; }

                if (textWidth > maxWidth && line !== '') {
                    if (checkAddPage(textLineHeight)) yPos = y;
                    translationPage.drawText(line, { ...options, y: yPos, font: currentFont, x: pageMargin });
                    line = word;
                    yPos -= textLineHeight;
                } else {
                    line = testLine;
                }
            }
            if (line) {
                 if (checkAddPage(textLineHeight)) yPos = y;
                translationPage.drawText(line, { ...options, y: yPos, font: currentFont, x: pageMargin });
            }
             y = yPos - textLineHeight;
            return { y: y };
        };
        // --- End Updated drawWrappedText ---


        // --- Loop through blocks and render ---
        for (const block of blocks) {
            if (block.type === 'heading') {
                const headingText = sanitizeText(block.originalText); // Sanitize just in case
                const neededHeight = headingLineHeight * 1.5; // Height + spacing below
                checkAddPage(neededHeight);
                translationPage.drawText(headingText, {
                    x: pageMargin, y: y, size: headingFontSize, font: helveticaBold, color: targetColor
                });
                y -= neededHeight;
            } else if (block.type === 'whitespace') {
                const neededHeight = lineHeight * 0.75;
                checkAddPage(neededHeight);
                y -= neededHeight;
            } else if (block.type === 'footer') {
                // console.log("Skipping footer block:", block.originalText);
            } else if (block.type === 'paragraph' && block.sentences) {
                const spacingBetweenTexts = 8;
                const spacingAfterPair = 15;
                const paragraphEndSpacing = 10; // Added AFTER the loop for the block

                for (let k = 0; k < block.sentences.length; k++) {
                    const sentence = block.sentences[k];
                    const cleanOriginal = sentence.text;
                    const cleanTranslation = sentence.translation || "[Traducción no disponible]";

                    const originalLinesEst = Math.ceil(originalTextFont.widthOfTextAtSize(cleanOriginal, fontSize) / (width - (pageMargin * 2))) || 1;
                    const translationLinesEst = Math.ceil(translatedTextFont.widthOfTextAtSize(cleanTranslation, fontSize) / (width - (pageMargin * 2))) || 1;
                    const neededHeightEst = (originalLinesEst + translationLinesEst) * lineHeight + spacingBetweenTexts + spacingAfterPair;
                    checkAddPage(neededHeightEst);

                    drawWrappedText(cleanOriginal, {
                        x: pageMargin, y, size: fontSize, font: originalTextFont, color: sourceColor
                    });

                    y -= spacingBetweenTexts;

                    drawWrappedText(cleanTranslation, {
                        x: pageMargin, y, size: fontSize, font: translatedTextFont, color: targetColor
                    });

                    y -= spacingAfterPair;

                    if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
                       global.translationProgress[sessionId].completedSentences += 1;
                    }
                }
                const paraEndNeeded = paragraphEndSpacing;
                checkAddPage(paraEndNeeded);
                y -= paraEndNeeded;
            }
        } // --- End loop through blocks ---

      } catch (pageError) {
        console.error(`Error procesando página ${pageIndex + 1}:`, pageError);
        partialError = true;
      }
    } // --- End loop through pages ---

    // --- Finalize PDF ---
    if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
      global.translationProgress[sessionId].status = partialError ? 'partial_error' : 'completed';
      global.translationProgress[sessionId].processedPages = pagesToProcess;
    }

    const processEndTime = Date.now();
    const durationMs = processEndTime - processStartTime;
    const startTimeStr = new Date(processStartTime).toLocaleTimeString();
    const endTimeStr = new Date(processEndTime).toLocaleTimeString();
    const durationStr = formatDuration(durationMs);

    try {
      const lastPageIndex = finalPdfDoc.getPageCount() - 1;
      if (lastPageIndex >= 0) {
        const lastPage = finalPdfDoc.getPage(lastPageIndex);
        lastPage.drawText(
          `Procesado: ${startTimeStr} - ${endTimeStr} (${durationStr})${partialError ? ' (Errores encontrados)' : ''}`,
          { x: 50, y: 20, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) }
        );
      }
    } catch (drawError) {
      console.warn("No se pudo añadir el tiempo de procesamiento al PDF:", drawError);
    }

    const finalPdfBytes: Uint8Array = await finalPdfDoc.save();
    const finalPdfBuffer = Buffer.from(finalPdfBytes);

    const parsedOriginalFilename = parse(originalFilename);
    const outputFilenameBase = parsedOriginalFilename.name.replace(/\s+/g, '_');
    const outputFilename = `${outputFilenameBase}${partialError ? '_partial' : ''}_translated.pdf`;
    const outputPath = join(translatedPdfDir, outputFilename);
    await writeFile(outputPath, finalPdfBuffer);

    if (filePath && existsSync(filePath)) {
      await unlink(filePath).catch(err => console.error('Error eliminando archivo original temporal:', err));
    }

    console.log(`Devolviendo PDF traducido: ${outputFilename}`);
    return new NextResponse(finalPdfBuffer, {
      status: partialError ? 206 : 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outputFilename}"`,
      },
    });

  } catch (error) {
    console.error(`Error fatal durante el proceso:`, error);
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
}