'use client'

import { useState, FormEvent, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import TranslationProgress from '../../components/TranslationProgress'
import FileDropZone from '../../components/FileDropZone'

// Lista de idiomas disponibles
const availableLanguages = [
  "aav", "aed", "af", "alv", "am", "ar", "art", "ase", "az", "bat", "bcl", "be", "bem", "ber", "bg", "bi", "bn", "bnt", "bzs", "ca", "cau", "ccs", "ceb", "cel", "chk", "cpf", "crs", "cs", "csg", "csn", "cus", "cy", "da", "de", "dra", "ee", "efi", "el", "en", "eo", "es", "et", "eu", "euq", "fi", "fj", "fr", "fse", "ga", "gaa", "gil", "gl", "grk", "guw", "gv", "ha", "he", "hi", "hil", "ho", "hr", "ht", "hu", "hy", "id", "ig", "ilo", "is", "iso", "it", "ja", "jap", "ka", "kab", "kg", "kj", "kl", "ko", "kqn", "kwn", "kwy", "lg", "ln", "loz", "lt", "lu", "lua", "lue", "lun", "luo", "lus", "lv", "map", "mfe", "mfs", "mg", "mh", "mk", "mkh", "ml", "mos", "mr", "ms", "mt", "mul", "ng", "nic", "niu", "nl", "no", "nso", "ny", "nyk", "om", "pa", "pag", "pap", "phi", "pis", "pl", "pon", "poz", "pqe", "pqw", "prl", "pt", "rn", "rnd", "ro", "roa", "ru", "run", "rw", "sal", "sg", "sh", "sit", "sk", "sl", "sm", "sn", "sq", "srn", "ss", "ssp", "st", "sv", "sw", "swc", "taw", "tdt", "th", "ti", "tiv", "tl", "tll", "tn", "to", "toi", "tpi", "tr", "trk", "ts", "tum", "tut", "tvl", "tw", "ty", "tzo", "uk", "umb", "ur", "ve", "vi", "vsl", "wa", "wal", "war", "wls", "xh", "yap", "yo", "yua", "zai", "zh", "zne"
];

const languageLabels: Record<string, { native: string; en: string }> = {
  aav: { native: "Austroasiatic languages", en: "Austroasiatic languages" },
  aed: { native: "Argentine Sign Language", en: "Argentine Sign Language" },
  af: { native: "Afrikaans", en: "Afrikaans" },
  alv: { native: "Atlantic-Congo languages", en: "Atlantic-Congo languages" },
  am: { native: "አማርኛ", en: "Amharic" },
  ar: { native: "العربية", en: "Arabic" },
  art: { native: "Artificial languages", en: "Artificial languages" },
  ase: { native: "American Sign Language", en: "American Sign Language" },
  az: { native: "Azərbaycanca", en: "Azerbaijani" },
  bat: { native: "Baltic languages", en: "Baltic languages" },
  bcl: { native: "Bikol", en: "Bikol" },
  be: { native: "Беларуская", en: "Belarusian" },
  bem: { native: "Ichibemba", en: "Bemba" },
  ber: { native: "ⴰⵎⴰⵣⵉⵖ", en: "Berber languages" },
  bg: { native: "Български", en: "Bulgarian" },
  bi: { native: "Bislama", en: "Bislama" },
  bn: { native: "বাংলা", en: "Bengali" },
  bnt: { native: "Bantu languages", en: "Bantu languages" },
  bzs: { native: "Brazilian Sign Language", en: "Brazilian Sign Language" },
  ca: { native: "Català", en: "Catalan" },
  cau: { native: "Caucasian languages", en: "Caucasian languages" },
  ccs: { native: "South Caucasian languages", en: "South Caucasian languages" },
  ceb: { native: "Cebuano", en: "Cebuano" },
  cel: { native: "Celtic languages", en: "Celtic languages" },
  chk: { native: "Chuukese", en: "Chuukese" },
  cpf: { native: "French-based creoles and pidgins", en: "French-based creoles and pidgins" },
  crs: { native: "Seselwa", en: "Seselwa Creole French" },
  cs: { native: "Čeština", en: "Czech" },
  csg: { native: "Chilean Sign Language", en: "Chilean Sign Language" },
  csn: { native: "Colombian Sign Language", en: "Colombian Sign Language" },
  cus: { native: "Cushitic languages", en: "Cushitic languages" },
  cy: { native: "Cymraeg", en: "Welsh" },
  da: { native: "Dansk", en: "Danish" },
  de: { native: "Deutsch", en: "German" },
  dra: { native: "Dravidian languages", en: "Dravidian languages" },
  ee: { native: "Eʋegbe", en: "Ewe" },
  efi: { native: "Efik", en: "Efik" },
  el: { native: "Ελληνικά", en: "Greek" },
  en: { native: "English", en: "English" },
  eo: { native: "Esperanto", en: "Esperanto" },
  es: { native: "Español", en: "Spanish" },
  et: { native: "Eesti", en: "Estonian" },
  eu: { native: "Euskara", en: "Basque" },
  euq: { native: "Basque (family)", en: "Basque (family)" },
  fi: { native: "Suomi", en: "Finnish" },
  fj: { native: "Vosa Vakaviti", en: "Fijian" },
  fr: { native: "Français", en: "French" },
  fse: { native: "Finnish Sign Language", en: "Finnish Sign Language" },
  ga: { native: "Gaeilge", en: "Irish" },
  gaa: { native: "Gã", en: "Ga" },
  gil: { native: "Taetae ni Kiribati", en: "Gilbertese" },
  gl: { native: "Galego", en: "Galician" },
  grk: { native: "Greek languages", en: "Greek languages" },
  guw: { native: "Gun", en: "Gun" },
  gv: { native: "Gaelg", en: "Manx" },
  ha: { native: "هَوُسَ", en: "Hausa" },
  he: { native: "עברית", en: "Hebrew" },
  hi: { native: "हिन्दी", en: "Hindi" },
  hil: { native: "Ilonggo", en: "Hiligaynon" },
  ho: { native: "Hiri Motu", en: "Hiri Motu" },
  hr: { native: "Hrvatski", en: "Croatian" },
  ht: { native: "Kreyòl ayisyen", en: "Haitian Creole" },
  hu: { native: "Magyar", en: "Hungarian" },
  hy: { native: "Հայերեն", en: "Armenian" },
  id: { native: "Bahasa Indonesia", en: "Indonesian" },
  ig: { native: "Asụsụ Igbo", en: "Igbo" },
  ilo: { native: "Ilokano", en: "Iloko" },
  is: { native: "Íslenska", en: "Icelandic" },
  iso: { native: "Isoko", en: "Isoko" },
  it: { native: "Italiano", en: "Italian" },
  ja: { native: "日本語", en: "Japanese" },
  jap: { native: "Japanese (family)", en: "Japanese (family)" },
  ka: { native: "ქართული", en: "Georgian" },
  kab: { native: "Taqbaylit", en: "Kabyle" },
  kg: { native: "Kikongo", en: "Kongo" },
  kj: { native: "Kuanyama", en: "Kuanyama" },
  kl: { native: "Kalaallisut", en: "Greenlandic" },
  ko: { native: "한국어", en: "Korean" },
  kqn: { native: "Kaonde", en: "Kaonde" },
  kwn: { native: "Kwangali", en: "Kwangali" },
  kwy: { native: "San Salvador Kongo", en: "San Salvador Kongo" },
  lg: { native: "Luganda", en: "Ganda" },
  ln: { native: "Lingála", en: "Lingala" },
  loz: { native: "Silozi", en: "Lozi" },
  lt: { native: "Lietuvių", en: "Lithuanian" },
  lu: { native: "Tshiluba", en: "Luba-Katanga" },
  lua: { native: "Tshiluba", en: "Luba-Lulua" },
  lue: { native: "Luvale", en: "Luvale" },
  lun: { native: "Chilunda", en: "Lunda" },
  luo: { native: "Dholuo", en: "Luo" },
  lus: { native: "Mizo ṭawng", en: "Lushai" },
  lv: { native: "Latviešu", en: "Latvian" },
  map: { native: "Austronesian languages", en: "Austronesian languages" },
  mfe: { native: "Morisyen", en: "Morisyen" },
  mfs: { native: "Mexican Sign Language", en: "Mexican Sign Language" },
  mg: { native: "Malagasy", en: "Malagasy" },
  mh: { native: "Kajin M̧ajeļ", en: "Marshallese" },
  mk: { native: "Македонски", en: "Macedonian" },
  mkh: { native: "Mon-Khmer languages", en: "Mon-Khmer languages" },
  ml: { native: "മലയാളം", en: "Malayalam" },
  mos: { native: "Mossi", en: "Mossi" },
  mr: { native: "मराठी", en: "Marathi" },
  ms: { native: "Bahasa Melayu", en: "Malay" },
  mt: { native: "Malti", en: "Maltese" },
  mul: { native: "Multiple languages", en: "Multiple languages" },
  ng: { native: "Oshiwambo", en: "Ndonga" },
  nic: { native: "Niger-Kordofanian languages", en: "Niger-Kordofanian languages" },
  niu: { native: "Niuē", en: "Niuean" },
  nl: { native: "Nederlands", en: "Dutch" },
  no: { native: "Norsk", en: "Norwegian" },
  nso: { native: "Sesotho sa Leboa", en: "Northern Sotho" },
  ny: { native: "ChiCheŵa", en: "Nyanja" },
  nyk: { native: "Nyaneka", en: "Nyaneka" },
  om: { native: "Afaan Oromoo", en: "Oromo" },
  pa: { native: "ਪੰਜਾਬੀ", en: "Punjabi" },
  pag: { native: "Pangasinan", en: "Pangasinan" },
  pap: { native: "Papiamentu", en: "Papiamento" },
  phi: { native: "Philippine languages", en: "Philippine languages" },
  pis: { native: "Pijin", en: "Pijin" },
  pl: { native: "Polski", en: "Polish" },
  pon: { native: "Pohnpeian", en: "Pohnpeian" },
  poz: { native: "Malayo-Polynesian languages", en: "Malayo-Polynesian languages" },
  pqe: { native: "Eastern Malayo-Polynesian languages", en: "Eastern Malayo-Polynesian languages" },
  pqw: { native: "Western Malayo-Polynesian languages", en: "Western Malayo-Polynesian languages" },
  prl: { native: "Peruvian Sign Language", en: "Peruvian Sign Language" },
  pt: { native: "Português", en: "Portuguese" },
  rn: { native: "Ikirundi", en: "Rundi" },
  rnd: { native: "Ruund", en: "Ruund" },
  ro: { native: "Română", en: "Romanian" },
  roa: { native: "Romance languages", en: "Romance languages" },
  ru: { native: "Русский", en: "Russian" },
  run: { native: "Kirundi", en: "Kirundi" },
  rw: { native: "Kinyarwanda", en: "Kinyarwanda" },
  sal: { native: "Salishan languages", en: "Salishan languages" },
  sg: { native: "Sängö", en: "Sango" },
  sh: { native: "Srpskohrvatski / Српскохрватски", en: "Serbo-Croatian" },
  sit: { native: "Sino-Tibetan languages", en: "Sino-Tibetan languages" },
  sk: { native: "Slovenčina", en: "Slovak" },
  sl: { native: "Slovenščina", en: "Slovenian" },
  sm: { native: "Gagana Samoa", en: "Samoan" },
  sn: { native: "ChiShona", en: "Shona" },
  sq: { native: "Shqip", en: "Albanian" },
  srn: { native: "Sranantongo", en: "Sranan Tongo" },
  ss: { native: "SiSwati", en: "Swati" },
  ssp: { native: "Spanish Sign Language", en: "Spanish Sign Language" },
  st: { native: "Sesotho", en: "Southern Sotho" },
  sv: { native: "Svenska", en: "Swedish" },
  sw: { native: "Kiswahili", en: "Swahili" },
  swc: { native: "Congo Swahili", en: "Congo Swahili" },
  taw: { native: "Tai", en: "Tai" },
  tdt: { native: "Tetun Dili", en: "Tetun Dili" },
  th: { native: "ไทย", en: "Thai" },
  ti: { native: "ትግርኛ", en: "Tigrinya" },
  tiv: { native: "Tiv", en: "Tiv" },
  tl: { native: "Tagalog", en: "Tagalog" },
  tll: { native: "Tetela", en: "Tetela" },
  tn: { native: "Setswana", en: "Tswana" },
  to: { native: "Lea Faka-Tonga", en: "Tonga (Tonga Islands)" },
  toi: { native: "Tonga (Zambia)", en: "Tonga (Zambia)" },
  tpi: { native: "Tok Pisin", en: "Tok Pisin" },
  tr: { native: "Türkçe", en: "Turkish" },
  trk: { native: "Turkic languages", en: "Turkic languages" },
  ts: { native: "Xitsonga", en: "Tsonga" },
  tum: { native: "Chitumbuka", en: "Tumbuka" },
  tut: { native: "Altaic languages", en: "Altaic languages" },
  tvl: { native: "Te Ggana Tuvalu", en: "Tuvaluan" },
  tw: { native: "Twi", en: "Twi" },
  ty: { native: "Reo Tahiti", en: "Tahitian" },
  tzo: { native: "Tzotzil", en: "Tzotzil" },
  uk: { native: "Українська", en: "Ukrainian" },
  umb: { native: "Umbundu", en: "Umbundu" },
  ur: { native: "اردو", en: "Urdu" },
  ve: { native: "Tshivenda", en: "Venda" },
  vi: { native: "Tiếng Việt", en: "Vietnamese" },
  vsl: { native: "Venezuelan Sign Language", en: "Venezuelan Sign Language" },
  wa: { native: "Walon", en: "Walloon" },
  wal: { native: "Wolaytta", en: "Wolaytta" },
  war: { native: "Winaray", en: "Waray" },
  wls: { native: "Fakaʻuvea", en: "Wallisian" },
  xh: { native: "isiXhosa", en: "Xhosa" },
  yap: { native: "Waqab", en: "Yapese" },
  yo: { native: "Yorùbá", en: "Yoruba" },
  yua: { native: "Màaya T'àan", en: "Yucatec Maya" },
  zai: { native: "Zapoteco", en: "Zapotec" },
  zh: { native: "中文", en: "Chinese" },
  zne: { native: "Zande", en: "Zande" },
};

export default function Translate() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState<boolean>(false)
  const [isLimitedMode, setIsLimitedMode] = useState<boolean>(true)
  const [sourceLang, setSourceLang] = useState<string>('de') // Default source: German
  const [targetLang, setTargetLang] = useState<string>('es') // Default target: Spanish

  const handleFileDrop = useCallback((newFile: File) => {
    setFile(newFile)
    setDownloadUrl(null)
    setSessionId(null)
    setShowProgress(false)
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return

    const newSessionId = uuidv4()
    console.log(`Iniciando traducción con sessionId: ${newSessionId}, ${sourceLang} -> ${targetLang}`);
    setSessionId(newSessionId)
    setShowProgress(true)
    setLoading(true)
    setDownloadUrl(null); // Reset download URL on new submission

    try {
      const formData = new FormData()
      formData.append('pdfFile', file)
      formData.append('sessionId', newSessionId)
      formData.append('sourceLang', sourceLang) // Add source language
      formData.append('targetLang', targetLang) // Add target language

      console.log("Enviando solicitud de traducción al servidor");
      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
      })

      console.log(`Respuesta recibida - status: ${response.status}`);

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        setDownloadUrl(url)
        // Keep progress bar until download link is ready
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido al procesar la respuesta del servidor.' }));
        console.error("Error en respuesta:", errorData);
        alert(`Error al traducir el PDF: ${errorData.error || response.statusText}`);
        setShowProgress(false); // Hide progress on error
        setSessionId(null); // Clear session ID on error
      }
    } catch (error) {
      console.error('Error de conexión:', error)
      alert('Error al conectar con el servidor')
      setShowProgress(false); // Hide progress on connection error
      setSessionId(null); // Clear session ID on error
    } finally {
      setLoading(false)
      // Don't hide progress here, let onComplete handle it or error handling
    }
  }

  const handleTranslationComplete = useCallback(() => {
    console.log("Traducción completada (detectado por TranslationProgress), ocultando barra si hay URL");
    // Only hide progress if download URL is ready
    if (downloadUrl) {
        setShowProgress(false);
    }
    // If downloadUrl is not yet ready, the progress bar will stay
    // until the fetch completes and sets the downloadUrl.
  }, [downloadUrl]); // Depend on downloadUrl

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          setIsLimitedMode(data.limitedMode);
        }
      } catch (error) {
        console.error('Error al verificar configuración:', error);
      }
    };
    checkConfig();
  }, []);

  const getDownloadFilename = () => {
    if (!file) {
      return `documento_${sourceLang}_a_${targetLang}.pdf`;
    }
    const originalName = file.name;
    const nameWithoutExtension = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    return `${nameWithoutExtension}_${sourceLang}_a_${targetLang}.pdf`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-lg w-full px-6 py-8 bg-white bg-opacity-5 rounded-xl shadow-xl"> {/* Increased max-width */}
        <h1 className="text-3xl font-bold mb-2 text-center">Traductor de Documentos</h1>
        <p className="text-gray-300 mb-6 text-center">
          Sube un archivo y recibe un PDF con el texto original y su traducción
        </p>

        {/* Mostrar banner según el modo configurado */}
        {isLimitedMode ? (
          <div className="mb-6 p-3 bg-amber-500 bg-opacity-20 rounded-md text-sm">
            <p className="font-medium">⚠️ Modo de desarrollo</p>
            <p className="mt-1">
              La aplicación está procesando solo las primeras páginas del PDF
            </p>
          </div>
        ) : (
          <div className="mb-6 p-3 bg-green-500 bg-opacity-20 rounded-md text-sm">
            <p className="font-medium">✅ Modo de producción</p>
            <p className="mt-1">
              La aplicación procesará el documento PDF completo.
            </p>
          </div>
        )}

        <div className="mb-6 p-3 bg-blue-500 bg-opacity-20 rounded-md text-sm">
          <p className="font-medium">✨ Novedades:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Selección de idioma origen y destino</li>
            <li>Traducción mejorada con Opusmt de Hugging Face / EasyNMT</li>
            <li>Procesamiento por frases</li>
            <li>Textos en colores diferentes para mejor lectura</li>
            <li>Seguimiento del progreso de la traducción en tiempo real</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Language Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sourceLang" className="block mb-1 text-sm font-medium">Idioma Origen:</label>
              <select
                id="sourceLang"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
              >
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>
                    {languageLabels[lang]
                      ? `${languageLabels[lang].native} / ${languageLabels[lang].en} / ${lang.toUpperCase()}`
                      : lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="targetLang" className="block mb-1 text-sm font-medium">Idioma Destino:</label>
              <select
                id="targetLang"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
              >
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>
                    {languageLabels[lang]
                      ? `${languageLabels[lang].native} / ${languageLabels[lang].en} / ${lang.toUpperCase()}`
                      : lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* File Selection */}
          <div>
            <label className="block mb-2 text-sm font-medium">Selecciona un archivo:</label>
            <FileDropZone
              onFileDrop={handleFileDrop}
              accept=".pdf,.epub,.mobi" // Keep supported types if backend handles them
              file={file}
            />
            <p className="text-xs text-gray-400 mt-1 text-center">Formatos soportados: PDF</p> {/* Update if more are supported */}
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className="btn-primary mt-2"
          >
            {loading && !showProgress ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                Iniciando...
              </div>
            ) : (
              `Traducir (${sourceLang.toUpperCase()} -> ${targetLang.toUpperCase()})`
            )}
          </button>
        </form>

        {showProgress && sessionId && (
          <div className="w-full mt-4">
            <TranslationProgress
              sessionId={sessionId}
              onComplete={handleTranslationComplete}
            />
          </div>
        )}

        {downloadUrl && !loading && ( // Show download only when not loading and URL is ready
          <div className="mt-8 text-center">
            <p className="text-green-400 mb-3">¡Traducción completada!</p>
            <a
              href={downloadUrl}
              download={getDownloadFilename()}
              className="btn-secondary inline-block"
              onClick={() => {
                // Optional: Revoke URL after a delay to allow download start
                setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);
              }}
            >
              Descargar PDF Traducido
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
