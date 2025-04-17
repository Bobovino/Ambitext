'use client'

import { useState, FormEvent, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import TranslationProgress from '../../components/TranslationProgress'
import FileDropZone from '../../components/FileDropZone'

export default function Translate() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState<boolean>(false)
  const [isLimitedMode, setIsLimitedMode] = useState<boolean>(true)

  const handleFileDrop = useCallback((newFile: File) => {
    setFile(newFile)
    setDownloadUrl(null)
    setSessionId(null)
    setShowProgress(false)
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return

    // Generar un ID único para esta sesión de traducción
    const newSessionId = uuidv4()
    console.log(`Iniciando traducción con sessionId: ${newSessionId}`);
    setSessionId(newSessionId)
    setShowProgress(true)
    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('pdfFile', file)
      formData.append('sessionId', newSessionId)
      
      // Iniciar la petición de traducción
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
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        console.error("Error en respuesta:", errorData);
        alert(`Error al traducir el PDF: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error de conexión:', error)
      alert('Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }
  
  // Callback que se ejecuta cuando la traducción está completa
  const handleTranslationComplete = useCallback(() => {
    console.log("Traducción completada, ocultando barra de progreso");
    setShowProgress(false)
  }, [])

  // Verificar la configuración al cargar la página
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

  // --- CONSTRUIR NOMBRE DE ARCHIVO PARA DESCARGA ---
  const getDownloadFilename = () => {
    if (!file) {
      return 'documento_traducido.pdf'; // Fallback por si acaso
    }
    const originalName = file.name;
    const nameWithoutExtension = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    return `${nameWithoutExtension}_translated.pdf`;
  };
  // --- FIN CONSTRUCCIÓN NOMBRE ---

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full px-6 py-8 bg-white bg-opacity-5 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-2 text-center">Traductor Alemán-Español</h1>
        <p className="text-gray-300 mb-6 text-center">
          Sube un archivo en alemán y recibe un PDF con cada frase traducida al español
        </p>
        
        {/* Mostrar banner según el modo configurado */}
        {isLimitedMode ? (
          <div className="mb-6 p-3 bg-amber-500 bg-opacity-20 rounded-md text-sm">
            <p className="font-medium">⚠️ Modo de desarrollo</p>
            <p className="mt-1">
              La aplicación está procesando solo las primeras páginas del PDF
              para conservar el límite gratuito de DeepL.
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
            <li>Traducción mejorada con Opusmt de Hugging Face</li>
            <li>Procesamiento por frases</li>
            <li>Textos en colores diferentes para mejor lectura</li>
            <li>Seguimiento del progreso de la traducción en tiempo real</li>
          </ul>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium">Selecciona un archivo:</label>
            <FileDropZone 
              onFileDrop={handleFileDrop}
              accept=".pdf,.epub,.mobi"
              file={file}
            />
            <p className="text-xs text-gray-400 mt-1 text-center">Formatos soportados: PDF</p>
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
              'Traducir PDF'
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
        
        {downloadUrl && (
          <div className="mt-8 text-center">
            <p className="text-green-400 mb-3">¡Traducción completada!</p>
            <a 
              href={downloadUrl} 
              download={getDownloadFilename()} 
              className="btn-secondary inline-block"
            >
              Descargar PDF Traducido
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
