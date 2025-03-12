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
  
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/progress/${sessionId}`);
        
        if (!response.ok) {
          throw new Error('Error al obtener el progreso');
        }
        
        const data = await response.json();
        setProgress(data);
        
        // Si la traducción está completada, llamar al callback y detener el intervalo
        if (data.status === 'completed') {
          onComplete();
          clearInterval(intervalId);
        }
        
      } catch (err) {
        console.error('Error consultando progreso:', err);
        setError('Hubo un problema al obtener el progreso');
        clearInterval(intervalId);
      }
    };
    
    // Iniciar el intervalo solo si hay un sessionId
    if (sessionId) {
      // Consultar inmediatamente y luego cada segundo
      fetchProgress();
      intervalId = setInterval(fetchProgress, 1000);
    }
    
    // Limpiar el intervalo al desmontar
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sessionId, onComplete]);
  
  if (!progress) {
    return (
      <div className="flex flex-col items-center justify-center mt-4">
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 rounded-full animate-pulse" 
            style={{ width: '5%' }} 
          />
        </div>
        <p className="mt-2 text-sm text-gray-300">Iniciando traducción...</p>
      </div>
    );
  }
  
  const sentencePercentage = Math.round(
    (progress.completedSentences / Math.max(1, progress.totalSentences)) * 100
  );
  
  const pagePercentage = Math.round(
    (progress.currentPage / Math.max(1, progress.totalPages)) * 100
  );
  
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
          <p>Modo de prueba: Solo se están procesando las primeras {progress.processedPages} páginas 
          de un total de {progress.totalPdfPages} (limitado para ahorrar caracteres DeepL).</p>
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
      
      <div>
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
      </div>
      
      <p className="text-sm text-center mt-1">
        {progress.status === 'completed' 
          ? '¡Traducción completada!' 
          : 'Traduciendo y generando PDF...'}
      </p>
    </div>
  );
}
