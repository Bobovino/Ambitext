export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getLanguagePairName } from '@/lib/bookData'; // Keep the helper

export default function HomePage() {
  // Define the available language pairs directly for now
  // TODO: Consider fetching this dynamically from Supabase if pairs change often
  // Explicitly type the array to match the expected type of getLanguagePairName
  const uniqueLanguagePairs: ("DE-ES" | "EN-ES")[] = ['DE-ES', 'EN-ES']; // Add 'EN-ES' back

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 bg-gradient-to-b from-stone-900 to-black text-foreground">
      <div className="w-full max-w-4xl text-center"> {/* Centered content */}
        <h1 className="text-5xl font-bold mb-6 text-stone-100">
          Herramientas para Aprender Idiomas
        </h1>
        {/* Enhanced Introduction */}
        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          Bienvenido a nuestro sitio, diseñado para ayudarte en tu viaje de aprendizaje de idiomas. Explora la <span className="font-semibold text-emerald-400">Biblioteca Bilingüe</span>, donde encontrarás obras clásicas de dominio público con traducciones paralelas generadas por IA, frase a frase, ideales para la lectura comparativa y la mejora de la comprensión. Los libros están organizados por par de idiomas y nivel de dificultad (CEFR A1-C2).
        </p>
        <p className="text-xl text-gray-300 mb-12 leading-relaxed">
          Además, utiliza nuestro <span className="font-semibold text-blue-400">Traductor de Documentos</span> para traducir tus propios archivos PDF o EPUB, manteniendo el formato original tanto como sea posible.
        </p>

        {/* Library Links Section */}
        <h2 className="text-3xl font-semibold mb-6 text-stone-200">Explora la Biblioteca</h2>
        {uniqueLanguagePairs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16"> {/* Grid for language links */}
            {uniqueLanguagePairs.map((langPair) => (
              <Link
                key={langPair}
                href={`/library/${langPair.toLowerCase()}`}
                className="block bg-emerald-700/80 hover:bg-emerald-600/90 text-white font-semibold py-6 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out text-center text-xl"
              >
                {getLanguagePairName(langPair)} {/* Use the helper function */}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground mt-10 mb-16">
            No hay bibliotecas de idiomas disponibles en este momento.
          </p>
        )}

        {/* Translator Link Section */}
        {/* <div className="border-t border-stone-700/50 pt-10">
          <h2 className="text-3xl font-semibold mb-6 text-stone-200">Traduce tus Documentos</h2>
          <p className="text-lg text-gray-400 mb-6">Sube un archivo PDF o EPUB para obtener una traducción.</p>
          <Link
            href="/translate"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition duration-150 ease-in-out text-lg"
          >
            Ir al Traductor
          </Link>
        </div>
 */}
      </div>
    </main>
  );
}

// Update metadata if needed
export const metadata = {
  title: 'Biblioteca Bilingüe y Traductor de Documentos',
  description: 'Explora libros bilingües (Alemán-Español, etc.) por nivel y traduce tus propios documentos PDF/EPUB.',
};