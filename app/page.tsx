import Link from 'next/link';
import { availableBooks, getLanguagePairName, Book } from '@/lib/bookData'; // Import data and helper

export default function HomePage() {
  // Get unique language pairs from the available books
  const uniqueLanguagePairs = Array.from(new Set(availableBooks.map(book => book.languagePair)));

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 bg-gradient-to-b from-stone-900 to-black text-foreground">
      <div className="w-full max-w-4xl text-center"> {/* Centered content */}
        <h1 className="text-5xl font-bold mb-6 text-stone-100">
          Bienvenido a la Biblioteca Bilingüe
        </h1>
        <p className="text-xl text-gray-300 mb-12">
          Explora nuestra colección de libros clásicos con traducciones bilingües frase a frase, organizados por idioma y nivel (A1-C2).
        </p>

        {uniqueLanguagePairs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto"> {/* Grid for language links */}
            {uniqueLanguagePairs.map((langPair) => (
              <Link
                key={langPair}
                href={`/library/${langPair.toLowerCase()}`}
                className="block bg-emerald-700/80 hover:bg-emerald-600/90 text-white font-semibold py-6 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out text-center text-xl"
              >
                {getLanguagePairName(langPair)}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground mt-10">
            No hay bibliotecas de idiomas disponibles en este momento.
          </p>
        )}

        {/* Optional: Link to the general translation tool */}
        <div className="mt-16 border-t border-stone-700/50 pt-8">
          <h2 className="text-2xl font-semibold mb-4 text-stone-200">¿Necesitas traducir tu propio documento?</h2>
          <Link 
            href="/translate"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition duration-150 ease-in-out"
          >
            Ir al Traductor
          </Link>
        </div>

      </div>
    </main>
  );
}

// Update metadata if needed
export const metadata = {
  title: 'Biblioteca Bilingüe - Inicio',
  description: 'Explora libros bilingües por idioma (Alemán-Español, Inglés-Español) y nivel.',
};