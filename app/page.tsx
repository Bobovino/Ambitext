'use client'

import { useState, FormEvent, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import DeeplInfo from '../components/DeeplInfo'
import TranslationProgress from '../components/TranslationProgress'
import FileDropZone from '../components/FileDropZone'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState<boolean>(false)

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
    setSessionId(newSessionId)
    setShowProgress(true)
    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('pdfFile', file)
      formData.append('sessionId', newSessionId)
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        setDownloadUrl(url)
      } else {
        alert('Error al traducir el PDF')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }
  
  // Callback que se ejecuta cuando la traducción está completa
  const handleTranslationComplete = useCallback(() => {
    setShowProgress(false)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full px-6 py-8 bg-white bg-opacity-5 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-2 text-center">PDF Traductor Alemán-Español</h1>
        <p className="text-gray-300 mb-6 text-center">
          Sube un PDF en alemán y recibe otro con cada frase traducida al español
        </p>
        
        {/* Aviso de modo de prueba */}
        <div className="mb-6 p-3 bg-amber-500 bg-opacity-20 rounded-md text-sm">
          <p className="font-medium">⚠️ Modo de prueba activo</p>
          <p className="mt-1">
            La aplicación está configurada para procesar solo las primeras 5 páginas del PDF
            para conservar el límite gratuito de DeepL. En producción, se traduciría el documento completo.
          </p>
        </div>
        
        <div className="mb-6 p-3 bg-blue-500 bg-opacity-20 rounded-md text-sm">
          <p className="font-medium">✨ Novedades:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Traducción mejorada con DeepL API</li>
            <li>Procesamiento por frases en lugar de líneas</li>
            <li>Textos en colores diferentes para mejor lectura</li>
            <li>Seguimiento del progreso de la traducción en tiempo real</li>
            <li>Ahora puedes arrastrar y soltar archivos PDF</li>
          </ul>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium">Selecciona un archivo PDF:</label>
            <FileDropZone 
              onFileDrop={handleFileDrop}
              accept=".pdf"
              file={file}
            />
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
          <TranslationProgress 
            sessionId={sessionId}
            onComplete={handleTranslationComplete}
          />
        )}
        
        {downloadUrl && (
          <div className="mt-8 text-center">
            <p className="text-green-400 mb-3">¡Traducción completada!</p>
            <a 
              href={downloadUrl} 
              download="documento_traducido.pdf" 
              className="btn-secondary inline-block"
            >
              Descargar PDF Traducido
            </a>
          </div>
        )}
        
        <DeeplInfo />
      </div>
    </main>
  )
}
