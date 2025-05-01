// app/library/[langPair]/page.tsx
import Link from 'next/link';
import { cefrLevels, Book, getLanguagePairName } from '@/lib/bookData';
import { notFound } from 'next/navigation';
import BookCarousel from '@/components/BookCarousel';
import { getSupabaseClient } from '@/lib/supabaseClient';

// Define valid language pairs for routing (can be fetched from DB later if needed)
const validLangPairs = ['de-es', 'en-es'];

// Define props for the page component
interface LanguageLibraryProps {
  params: {
    langPair: string;
  };
}

// Generate metadata dynamically based on language pair
export async function generateMetadata({ params }: LanguageLibraryProps) {
  const langPair = params.langPair.toLowerCase();
  if (!validLangPairs.includes(langPair)) {
    return { title: 'Idioma no encontrado' };
  }
  // Fetch language pair name dynamically if needed, or use helper
  const pairName = getLanguagePairName(langPair.toUpperCase() as Book['languagePair']); // Use uppercase for consistency
  return {
    title: `Biblioteca Bilingüe: ${pairName}`,
    description: `Libros bilingües (${pairName}) por nivel (A1-C2) con traducción frase a frase.`,
  };
}

// Make the page component async
export default async function LanguageLibraryPage({ params }: { params: { langPair: string } }) {
  // Get the Supabase client instance
  const supabase = getSupabaseClient();

  const langPair = params.langPair.toLowerCase();
  const langPairUpper = langPair.toUpperCase() as Book['languagePair'];

  // Validate the language pair from the URL
  if (!validLangPairs.includes(langPair)) {
    notFound();
  }

  const pairName = getLanguagePairName(langPairUpper);

  console.log(`[Library Page] Fetching books for languagePair: ${langPairUpper}`);

  // --- Explicitly select columns ---
  const { data: rawBooksData, error } = await supabase
    .from('books')
    // Select specific columns instead of '*'
    .select('id, title, author, filename, languagePair, level, description, created_at')
    .eq('languagePair', langPairUpper);
  // --- End explicit select ---

  console.log('[Library Page] RAW data received from Supabase:', JSON.stringify(rawBooksData, null, 2));

  if (error) {
    console.error('[Library Page] Error fetching books:', error);
    // Render error state
    return (
      <main className="flex min-h-screen flex-col items-center pt-6 md:pt-12 bg-gradient-to-b from-stone-900 to-black text-foreground">
        <div className="w-full">
          <div className="max-w-6xl mx-auto px-6 md:px-12">
            <h1 className="text-5xl font-bold mb-4 text-center text-stone-100">
              Biblioteca Bilingüe
            </h1>
            <h2 className="text-3xl font-semibold mb-12 text-center text-emerald-400">
              {pairName}
            </h2>
            <p className="text-center text-red-500">
              {`Error al cargar libros: ${error.message}`}
            </p>
            <div className="text-center mt-16 mb-8">
              <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition duration-150 ease-in-out">
                Volver a la página principal
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Ensure rawBooksData is treated as an array of Book or null/undefined
  const booksForPair: Book[] | null = rawBooksData;
  const safeBooksForPair = booksForPair || [];

  console.log('[Library Page] Processed books data (safeBooksForPair):', JSON.stringify(safeBooksForPair, null, 2));

  // Group fetched books by level
  const booksByLevel = safeBooksForPair.reduce((acc, book) => {
    const level = book.level || 'Unknown'; // Handle potential missing level
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(book);
    return acc;
  }, {} as Record<Book['level'], Book[]>); // Use Book['level'] for key type

  if (safeBooksForPair.length === 0) {
    // Render "no books found" state
    return (
      <main className="flex min-h-screen flex-col items-center pt-6 md:pt-12 bg-gradient-to-b from-stone-900 to-black text-foreground">
        <div className="w-full">
          <div className="max-w-6xl mx-auto px-6 md:px-12">
            <h1 className="text-5xl font-bold mb-4 text-center text-stone-100">
              Biblioteca Bilingüe
            </h1>
            <h2 className="text-3xl font-semibold mb-12 text-center text-emerald-400">
              {pairName}
            </h2>
            <p className="text-center text-stone-400">
              No se encontraron libros para este par de idiomas y nivel.
            </p>
            <div className="text-center mt-16 mb-8">
              <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition duration-150 ease-in-out">
                Volver a la página principal
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center pt-6 md:pt-12 bg-gradient-to-b from-stone-900 to-black text-foreground">
      <div className="w-full">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <h1 className="text-5xl font-bold mb-4 text-center text-stone-100">
            Biblioteca Bilingüe
          </h1>
          <h2 className="text-3xl font-semibold mb-12 text-center text-emerald-400">
            {pairName}
          </h2>

          {/* Iterate through levels and render carousels */}
          <div className="space-y-16">
            {cefrLevels.map((level) => {
              const books = booksByLevel[level];
              // Only render carousel if there are books for this level
              if (books && books.length > 0) {
                return (
                  <BookCarousel
                    key={level}
                    books={books} // Pass the grouped books
                    title={`Nivel ${level}`}
                    languagePairName={pairName}
                  />
                );
              }
              return null; // Don't render anything if no books for this level
            })}
          </div>

          {/* Back link */}
          <div className="text-center mt-16 mb-8">
            <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition duration-150 ease-in-out">
              Volver a la página principal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
