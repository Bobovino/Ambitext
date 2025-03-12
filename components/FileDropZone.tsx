import React, { useState, useCallback, useRef, DragEvent } from 'react';

interface FileDropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string;
  file: File | null;
}

export default function FileDropZone({ onFileDrop, accept = '.pdf', file }: FileDropZoneProps) {
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
      const isPdf = droppedFile.type === 'application/pdf' || droppedFile.name.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        onFileDrop(droppedFile);
      } else {
        alert('Por favor, arrastra solo archivos PDF.');
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
            <p className="font-medium">Arrastra un PDF aquí o haz clic para seleccionarlo</p>
            <p className="text-sm text-gray-400 mt-1">Solo archivos PDF</p>
          </>
        )}
      </div>
    </div>
  );
}
