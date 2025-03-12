import React from 'react';

export default function DeeplInfo() {
  return (
    <div className="mt-8 text-sm text-gray-400 text-center">
      <p>Traducción alimentada por <a href="https://www.deepl.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">DeepL API</a></p>
      <p className="mt-1">Esta aplicación utiliza la capa gratuita de DeepL que ofrece 500.000 caracteres por mes</p>
    </div>
  );
}
