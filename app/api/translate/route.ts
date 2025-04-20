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

// Interfaz para el resultado de splitIntoSentences
interface SentenceInfo {
  text: string;
  isEndOfParagraph: boolean;
}

// Función mejorada para dividir el texto y marcar fines de párrafo
function splitIntoSentences(text: string): SentenceInfo[] {
  const paragraphs = text.split(/\n\s*\n/); // Dividir en párrafos primero
  const sentenceInfos: SentenceInfo[] = [];
  // Regex para URLs (simplificada, ajusta si es necesario)
  const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (trimmedParagraph.length === 0) continue;

    // Usar regex para dividir el párrafo en frases
    // Regex mejorada para capturar mejor finales de frase y evitar divisiones incorrectas
    const sentenceRegex = /[^.!?…]+(?:[.!?…](?![.?!"”’']?\s*[a-zäöüß])|\n|$)+/g;
    // --- CORRECCIÓN: Asegurar tipo string[] ---
    const matchResult = trimmedParagraph.match(sentenceRegex);
    let potentialSentences: string[] = matchResult ?? [trimmedParagraph]; // Si no hay match, el párrafo es una "frase"
    // --- FIN CORRECCIÓN ---

    // Limpiar y filtrar frases vacías
    potentialSentences = potentialSentences.map(s => s.trim()).filter(s => s.length > 0);

    if (potentialSentences.length > 0) {
      for (let i = 0; i < potentialSentences.length; i++) {
        const sentence = potentialSentences[i];
        const isLastInParagraph = (i === potentialSentences.length - 1);

        // Sub-dividir frases muy largas si es necesario, intentando no romper URLs
        if (sentence.length > 250 && !urlRegex.test(sentence)) { // No dividir si parece una URL larga
          const chunks = splitLongSentence(sentence);
          for (let j = 0; j < chunks.length; j++) {
            sentenceInfos.push({
              text: chunks[j],
              // Solo la última parte de la frase larga dividida hereda el fin de párrafo
              isEndOfParagraph: isLastInParagraph && (j === chunks.length - 1)
            });
          }
        } else {
          sentenceInfos.push({
            text: sentence,
            isEndOfParagraph: isLastInParagraph
          });
        }
      }
    }
  }
  return sentenceInfos;
}

// Función para dividir frases muy largas
function splitLongSentence(longSentence: string): string[] {
  const maxLength = 250; // Coincidir con el límite superior
  const result: string[] = [];

  // Intenta dividir por comas primero si preserva mejor la estructura
  if (longSentence.includes(',')) {
    let currentChunk = '';
    const parts = longSentence.split(',');
    let needsCommaSuffix = false; // Para añadir la coma al final del chunk si se dividió ahí

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Añadir la coma si el chunk anterior terminó justo antes de esta parte
        const partWithCommaPrefix = needsCommaSuffix ? `,${part}` : part;
        const potentialChunk = currentChunk ? `${currentChunk}${partWithCommaPrefix}` : part.trim(); // Trim inicial

        if (potentialChunk.length <= maxLength) {
            currentChunk = potentialChunk;
            needsCommaSuffix = true; // La siguiente parte necesitará una coma delante si esta no es la última
        } else {
            // Si el chunk actual ya es demasiado largo por sí solo
            if (currentChunk) {
                 result.push(currentChunk.trim()); // Añadir el chunk anterior válido
            }
            // Manejar la parte actual que excedió el límite
            if (part.trim().length > maxLength) {
                // Si la parte en sí es demasiado larga, usar división por espacio
                const subChunks = splitBySpace(part.trim(), maxLength);
                result.push(...subChunks);
                currentChunk = ''; // Resetear chunk
                needsCommaSuffix = false;
            } else {
                currentChunk = part.trim(); // Empezar nuevo chunk con la parte actual
                needsCommaSuffix = true;
            }
        }
        // Si es la última parte, no necesitará coma después
        if (i === parts.length - 1) {
            needsCommaSuffix = false;
        }
    }
     // Añadir el último chunk si existe
    if (currentChunk) result.push(currentChunk.trim());

    // Si la división por comas generó chunks vacíos o muy pequeños, revertir a espacio
    if (result.some(chunk => chunk.length < 10) && result.length > 1) {
        console.warn("División por comas generó chunks pequeños, revirtiendo a división por espacio para:", longSentence.substring(0, 50) + "...");
        return splitBySpace(longSentence, maxLength);
    }

    return result.filter(c => c.length > 0); // Filtrar chunks vacíos

  } else {
     // Si no hay comas, dividir por espacios
     return splitBySpace(longSentence, maxLength);
  }
}

// Función auxiliar para dividir por espacios
function splitBySpace(sentence: string, maxLength: number): string[] {
    const result: string[] = [];
    let remaining = sentence.trim();
    while (remaining.length > maxLength) {
        let cutPoint = maxLength;
        // Buscar el último espacio antes del límite
        while (cutPoint > 0 && remaining[cutPoint] !== ' ') {
            cutPoint--;
        }
        // Si no se encontró espacio, cortar en maxLength (puede romper una palabra)
        if (cutPoint === 0) {
            cutPoint = maxLength;
            console.warn("Forzando corte en medio de palabra para frase larga sin espacios:", remaining.substring(0, 30) + "...");
        }
        result.push(remaining.substring(0, cutPoint).trim());
        remaining = remaining.substring(cutPoint).trim();
    }
    if (remaining.length > 0) {
        result.push(remaining);
    }
    return result.filter(c => c.length > 0);
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

async function extractTextFromPdfPage(pdfDoc: PDFDocument, pageIndex: number): Promise<string> {
  const singlePageDoc = await PDFDocument.create();
  const [page] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
  singlePageDoc.addPage(page);
  const pdfBytes = await singlePageDoc.save();
  const pdfjs = await import('pdf-parse');
  const data = await pdfjs.default(Buffer.from(pdfBytes));
  return data.text;
}

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
    // --- NUEVO: Leer idiomas del formData ---
    const sourceLang = formData.get('sourceLang') as string | null;
    const targetLang = formData.get('targetLang') as string | null;
    // ----------------------------------------

    // --- NUEVO: Inicializar progreso de traducción ---
    if (sessionId) {
      if (!global.translationProgress) global.translationProgress = {};
      global.translationProgress[sessionId] = {
        totalSentences: 0,
        completedSentences: 0,
        totalPages: 0,
        currentPage: 0,
        totalBatches: 0,
        completedBatches: 0,
        status: 'processing',
        limitedMode: CONFIG.limitedMode,
        processedPages: 0,
        totalPdfPages: 0,
      };
    }
    // -------------------------------------------------

    if (!pdfFile) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 })
    }
    // --- NUEVO: Validar idiomas ---
    if (!sourceLang || !targetLang) {
      return NextResponse.json({ error: 'Faltan los idiomas de origen o destino' }, { status: 400 });
    }
    // ------------------------------

    const bytes = await pdfFile.arrayBuffer()
    originalFileBuffer = Buffer.from(bytes); // Keep original buffer

    const timestamp = Date.now()
    const originalFilename = pdfFile.name
    filePath = join(uploadsDir, `${timestamp}_${originalFilename}`)

    await writeFile(filePath, originalFileBuffer)

    const fileType = getFileType(originalFilename);

    if (fileType === 'unknown') {
      return NextResponse.json({ error: 'Tipo de archivo no soportado. Por favor, sube un PDF' }, { status: 400 })
    }

    console.log(`Procesando archivo ${fileType}: ${originalFilename}`);

    let fullText = '';
    let totalPages = 1;
    let pagesToProcess = 1;

    if (fileType === 'pdf') {
      const originalPdfDoc = await PDFDocument.load(originalFileBuffer);
      totalPages = originalPdfDoc.getPageCount();
      pagesToProcess = CONFIG.limitedMode ? Math.min(CONFIG.maxPages, totalPages) : totalPages;

      if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        global.translationProgress[sessionId].totalPages = totalPages;
        global.translationProgress[sessionId].totalPdfPages = totalPages;
        global.translationProgress[sessionId].processedPages = 0;
        global.translationProgress[sessionId].totalSentences = 0; // Se sumará después
        global.translationProgress[sessionId].completedSentences = 0;
      }

      // Justo después de cargar originalPdfDoc y antes del bucle de traducción:
      let totalSentences = 0;
      for (let pageIndex = 1; pageIndex < pagesToProcess; pageIndex++) {
        const pageText = await extractTextFromPdfPage(originalPdfDoc, pageIndex);
        const sentenceInfos = splitIntoSentences(pageText);
        totalSentences += sentenceInfos.length;
      }
      if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        global.translationProgress[sessionId].totalSentences = totalSentences;
      }

      const finalPdfDoc = await PDFDocument.create();

      // 1. Portada original
      const [coverPage] = await finalPdfDoc.copyPages(originalPdfDoc, [0]);
      finalPdfDoc.addPage(coverPage);

      // 2. Página de metadatos
      const metadataPage = finalPdfDoc.addPage([595, 842]);
      let metaY = metadataPage.getHeight() - 70;
      const metaX = 50;
      const metaLineHeight = 18;
      const metaTitleSize = 18;
      const metaInfoSize = 11;
      const metaLegendSize = 10;

      const helvetica = await finalPdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaOblique = await finalPdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const helveticaBold = await finalPdfDoc.embedFont(StandardFonts.HelveticaBold);

      const sourceColor = rgb(0.1, 0.3, 0.6); // azul para el idioma origen
      const targetColor = rgb(0, 0, 0);       // negro para el idioma destino

      metadataPage.drawText("Documento Traducido", { x: metaX, y: metaY, size: metaTitleSize, font: helveticaBold });
      metaY -= metaLineHeight * 2;
      metadataPage.drawText(`Nombre original: ${originalFilename}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
      metaY -= metaLineHeight;
      metadataPage.drawText(`Formato original: ${fileType.toUpperCase()}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
      metaY -= metaLineHeight;
      metadataPage.drawText(`Fecha: ${new Date().toLocaleDateString()}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
      metaY -= metaLineHeight;

      metaY -= metaLineHeight * 1.5;

      let statusMessage = '';
      if (CONFIG.limitedMode && pagesToProcess < totalPages) {
        statusMessage = `Parcial (Modo Limitado) - Se han procesado las primeras ${pagesToProcess} páginas.`;
      } else {
        statusMessage = `Completo - Se han procesado las ${pagesToProcess} páginas.`;
      }
      metadataPage.drawText(statusMessage, { x: metaX, y: metaY, size: metaInfoSize, font: helveticaBold });
      metaY -= metaLineHeight;

      metaY -= metaLineHeight * 0.5;
      metadataPage.drawText(`Traducido con: ${translationProvider === 'easynmt' ? 'EasyNMT (Local)' : 'Hugging Face API'}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
      metaY -= metaLineHeight;
      metadataPage.drawText(`Traducción: ${sourceLang.toUpperCase()} -> ${targetLang.toUpperCase()}`, { x: metaX, y: metaY, size: metaInfoSize, font: helvetica });
      metaY -= metaLineHeight;
      metadataPage.drawText(`${sourceLang.toUpperCase()}: texto original (azul)`, { x: metaX, y: metaY, size: metaLegendSize, font: helveticaBold, color: sourceColor });
      metaY -= metaLineHeight * 0.8;
      metadataPage.drawText(`${targetLang.toUpperCase()}: traducción (negro)`, { x: metaX, y: metaY, size: metaLegendSize, font: helveticaOblique, color: targetColor });

      // 3. Por cada página original:
      for (let pageIndex = 1; pageIndex < pagesToProcess; pageIndex++) {
        if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
          global.translationProgress[sessionId].currentPage = pageIndex + 1;
          global.translationProgress[sessionId].processedPages = pageIndex;
        }

        // 1. Añadir página original
        const [origPage] = await finalPdfDoc.copyPages(originalPdfDoc, [pageIndex]);
        finalPdfDoc.addPage(origPage);

        // 2. Extraer texto y traducir
        const pageText = await extractTextFromPdfPage(originalPdfDoc, pageIndex);
        const sentenceInfos = splitIntoSentences(pageText);

        if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
          global.translationProgress[sessionId].totalSentences += sentenceInfos.length;
        }

        const sentencesToTranslate = sentenceInfos.map(info => sanitizeText(info.text));
        let translations: string[];
        if (translationProvider === 'easynmt') {
          translations = await translateWithEasyNMT(sentencesToTranslate, sourceLang, targetLang);
        } else {
          translations = await translateWithHuggingFace(sentencesToTranslate, sourceLang, targetLang);
        }

        // 3. Añadir tantas páginas de traducción como sean necesarias
        let translationPage = finalPdfDoc.addPage([595, 842]);
        let y = 792;
        const width = 595;
        const fontSize = 11;
        const lineHeight = fontSize * 1.2;

        const drawWrappedText = (text: string, options: any): { y: number, pageAdvanced: boolean } => {
          const safeText = sanitizeText(text);
          const maxWidth = width - 100;
          const textLineHeight = options.size * 1.2;
          const words = safeText.split(' ');
          let line = '';
          let yPos = options.y;
          let pageAdvanced = false;

          for (let n = 0; n < words.length; n++) {
            const word = words[n];
            const testLine = line + (line ? ' ' : '') + word;
            let textWidth = 0;
            try {
              textWidth = options.font.widthOfTextAtSize(testLine, options.size);
            } catch (e) {
              textWidth = line ? options.font.widthOfTextAtSize(line, options.size) : 0;
            }

            if (textWidth > maxWidth && line !== '') {
              translationPage.drawText(line, { ...options, y: yPos });
              line = word;
              yPos -= textLineHeight;
              if (yPos < 60) {
                translationPage = finalPdfDoc.addPage([595, 842]);
                yPos = 792;
                pageAdvanced = true;
              }
            } else {
              line = testLine;
            }
          }
          if (line) {
            translationPage.drawText(line, { ...options, y: yPos });
          }
          return { y: yPos - textLineHeight, pageAdvanced };
        };

        for (let i = 0; i < sentenceInfos.length; i++) {
          // Frase original
          let drawResult = drawWrappedText(sentenceInfos[i].text, { x: 50, y, size: 11, font: helveticaBold, color: sourceColor });
          y = drawResult.y;
          if (drawResult.pageAdvanced) y = 792 - (792 - drawResult.y);

          y -= 5;

          // Traducción
          drawResult = drawWrappedText(translations[i], { x: 50, y, size: 11, font: helveticaOblique, color: targetColor });
          y = drawResult.y;
          if (drawResult.pageAdvanced) y = 792 - (792 - drawResult.y);

          y -= 15;

          if (sentenceInfos[i].isEndOfParagraph) y -= 10;

          if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
            global.translationProgress[sessionId].completedSentences += 1;
          }
        }
      }

      if (sessionId && global.translationProgress && global.translationProgress[sessionId]) {
        global.translationProgress[sessionId].status = 'completed';
        global.translationProgress[sessionId].processedPages = pagesToProcess;
      }

      const finalPdfBytes: Uint8Array = await finalPdfDoc.save();
      const finalPdfBuffer = Buffer.from(finalPdfBytes);

      const parsedOriginalFilename = parse(originalFilename);
      const outputFilenameBase = parsedOriginalFilename.name;
      const outputFilename = `${outputFilenameBase}_translated.pdf`;

      if (filePath && existsSync(filePath)) {
        await unlink(filePath).catch(err => console.error('Error eliminando archivo original temporal:', err));
      }

      console.log(`Devolviendo PDF traducido: ${outputFilename}`);
      return new NextResponse(finalPdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${outputFilename}"`,
        },
      });
    } else {
      fullText = await extractTextFromFile(filePath, fileType);
      const estimatedCharsPerPage = 2000;
      totalPages = Math.ceil(fullText.length / estimatedCharsPerPage) || 1;
      pagesToProcess = CONFIG.limitedMode ? Math.min(CONFIG.maxPages, totalPages) : totalPages;
      if (CONFIG.limitedMode && totalPages > CONFIG.maxPages) {
        const charsToKeep = pagesToProcess * estimatedCharsPerPage;
        fullText = fullText.substring(0, charsToKeep);
        console.log(`Procesando aprox. ${pagesToProcess} de ${totalPages} páginas estimadas (${fileType}).`);
      } else {
        console.log(`Procesando todo el contenido (${fileType}).`);
      }
    }
  } catch (error) {
    console.error(`Error durante el proceso:`, error);
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