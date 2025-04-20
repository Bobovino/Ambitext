import React, { useState, useCallback, useRef, DragEvent } from 'react';

interface FileDropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string;
  file: File | null;
}

export default function FileDropZone({ onFileDrop, accept = '.pdf,.epub,.mobi', file }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const fileName = droppedFile.name.toLowerCase();
      const isValidFile = 
        droppedFile.type === 'application/pdf' || 
        fileName.endsWith('.pdf') ||
        fileName.endsWith('.epub') || 
        fileName.endsWith('.mobi');
      
      if (isValidFile) {
        onFileDrop(droppedFile);
      } else {
        alert('Por favor, arrastra solo archivos PDF, EPUB o MOBI.');
      }
    }
  }, [onFileDrop]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files[0]);
    }
  };

  // Determinar el icono según el tipo de archivo
  const getFileIcon = () => {
    if (!file) return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
    
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.epub') || fileName.endsWith('.mobi')) {
      // Icono de libro para EPUB/MOBI
      return "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253";
    } else {
      // Icono por defecto para PDF
      return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
    }
  };

  return (
    <div
      className={`
        relative w-full h-40 border-2 border-dashed rounded-lg p-4
        flex flex-col items-center justify-center cursor-pointer
        transition-colors duration-200
        ${isDragging ? 'border-primary bg-primary bg-opacity-10' : 'border-gray-400'}
        ${file ? 'bg-opacity-5 bg-green-500' : ''}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
      />

      <svg 
        className={`w-12 h-12 mb-3 ${file ? 'text-green-400' : 'text-gray-400'}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d={getFileIcon()}
        />
      </svg>

      <div className="text-center">
        {file ? (
          <>
            <p className="font-medium text-green-400">Archivo seleccionado:</p>
            <p className="text-sm text-gray-300 mt-1 truncate max-w-xs">{file.name}</p>
          </>
        ) : (
          <>
            <p className="font-medium">Arrastra un archivo aquí o haz clic para seleccionarlo</p>
            <p className="text-sm text-gray-400 mt-1">Archivos PDF</p>
          </>
        )}
      </div>
    </div>
  );
}
