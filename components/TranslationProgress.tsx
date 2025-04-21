import React, { useEffect, useState } from 'react';

interface ProgressProps {
  sessionId: string;
  onComplete: () => void;
}

interface ProgressData {
  totalSentences: number;
  completedSentences: number;
  totalPages: number;
  currentPage: number;
  status: 'processing' | 'completed' | 'error';
  limitedMode?: boolean;
  processedPages?: number;
  totalPdfPages?: number;
}

export default function TranslationProgress({ sessionId, onComplete }: ProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Imprimir sessionId para depuración
  console.log(`Componente TranslationProgress inicializado con sessionId: ${sessionId}`);
  
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let errorCount = 0;
    const maxErrors = 15; // Aumentamos el número máximo de errores permitidos
    
    const fetchProgress = async () => {
      if (!sessionId) {
        console.log("No hay sessionId, no se puede obtener progreso");
        return;
      }
      
      try {
        console.log(`Consultando progreso para sesión: ${sessionId}`);
        const response = await fetch(`/api/progress/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Datos de progreso recibidos:", data);
        setProgress(data);
        setError(null);
        errorCount = 0; // Reiniciar contador de errores
        
        // Si la traducción está completada, llamar al callback y detener el intervalo
        if (data.status === 'completed') {
          console.log("Traducción completada, deteniendo consultas de progreso");
          onComplete();
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Error consultando progreso:', err);
        errorCount++;
        
        // Si hay pocos errores, intentar de nuevo pero mostrar mensaje
        if (errorCount < maxErrors) {
          setError(`Error obteniendo progreso. Reintentando... (${errorCount}/${maxErrors})`);
          setRetryCount(prev => prev + 1);
        } else {
          // Demasiados errores, detener la consulta
          setError('Demasiados errores consultando el progreso. Espera a que se complete o recarga la página.');
          clearInterval(intervalId);
        }
      }
    };
    
    // Iniciar el intervalo solo si hay un sessionId
    if (sessionId) {
      // Consultar inmediatamente y luego cada segundo
      fetchProgress();
      intervalId = setInterval(fetchProgress, 1500);
    }
    
    // Limpiar el intervalo al desmontar
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sessionId, onComplete, retryCount]);
  
  if (!progress) {
    return (
      <div className="flex flex-col items-center justify-center mt-4">
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 rounded-full animate-pulse" 
            style={{ width: '5%' }} 
          />
        </div>
        <p className="mt-2 text-sm text-gray-300">
          {error ? error : "Iniciando traducción..."}
        </p>
      </div>
    );
  }
  
  // Calcular porcentajes y asegurar que estén dentro del rango 0-100
  const sentencePercentage = Math.min(100, Math.max(0, Math.round(
    (progress.completedSentences / Math.max(1, progress.totalSentences)) * 100
  )));
  
  const pagePercentage = Math.min(100, Math.max(0, Math.round(
    (progress.currentPage / Math.max(1, progress.totalPages)) * 100
  )));
  
  return (
    <div className="flex flex-col gap-3 mt-4">
      {error && (
        <div className="bg-red-500 bg-opacity-20 p-2 rounded text-sm text-red-300">
          {error}
        </div>
      )}
      
      {/* Mostrar advertencia sobre el modo limitado */}
      {progress.limitedMode && (
        <div className="bg-amber-500 bg-opacity-20 p-2 rounded text-sm text-amber-200 mb-2">
          <p>Modo de desarrollo: Solo se están procesando {process.env.NEXT_PUBLIC_MAX_PAGES} páginas 
          de un total de {progress.totalPdfPages}.</p>
        </div>
      )}
      
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>Frases</span>
          <span>{progress.completedSentences} / {progress.totalSentences}</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300" 
            style={{ width: `${sentencePercentage}%` }} 
          />
        </div>
      </div>
      
     {/*  <div>
        <div className="flex justify-between text-xs mb-1">
          <span>Páginas</span>
          <span>{progress.currentPage} / {progress.totalPages}</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-600 transition-all duration-300" 
            style={{ width: `${pagePercentage}%` }} 
          />
        </div>
      </div> */}
      
      <p className="text-sm text-center mt-1">
        {progress.status === 'completed' 
          ? '¡Traducción completada!' 
          : `Traduciendo y generando PDF... (${sentencePercentage}%)`}
      </p>
    </div>
  );
}
