import Link from 'next/link';

// Define la estructura de datos para un libro
interface Book {
  id: string; 
  title: string;
  author: string;
  filename: string; 
  languagePair: string; 
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; // Added CEFR level
  description?: string; 
}

// Lista de los libros traducidos disponibles
// Levels are estimations - please adjust as needed!
const availableBooks: Book[] = [
  {
    id: 'goethe_werther',
    title: 'Las penas del joven Werther',
    author: 'Johann Wolfgang von Goethe',
    filename: 'Goethe_die_leiden_des_jungen_werther.pdf',
    languagePair: 'DE-ES',
    level: 'C1', // Estimated level
    description: 'Un clásico del movimiento Sturm und Drang.'
  },
  {
    id: 'durrenmatt_physiker',
    title: 'Los Físicos', 
    author: 'Friedrich Dürrenmatt',
    filename: 'Die Physiker traducido.pdf',
    languagePair: 'DE-ES',
    level: 'B2', // Estimated level
    description: 'Una comedia grotesca sobre ciencia y responsabilidad.'
  },
  {
    id: 'kastner_emil',
    title: 'Emilio y los detectives',
    author: 'Erich Kästner',
    filename: 'Emil und die Detektive traducido.pdf',
    languagePair: 'DE-ES',
    level: 'A2', // Estimated level
    description: 'Un clásico de la literatura infantil alemana.'
  },
  // --- Añade aquí los otros libros con su nivel estimado ---
  // Ejemplo:
  // {
  //   id: 'kafka_verwandlung',
  //   title: 'La Metamorfosis',
  //   author: 'Franz Kafka',
  //   filename: 'Kafka_die_verwandlung_translated.pdf',
  //   languagePair: 'DE-ES',
  //   level: 'B2', // Estimated level
  //   description: 'La inquietante historia de Gregorio Samsa.'
  // },
];

// Define the order of levels
const cefrLevels: Book['level'][] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function BooksPage() {
  // Group books by level
  const booksByLevel = availableBooks.reduce((acc, book) => {
    if (!acc[book.level]) {
      acc[book.level] = [];
    }
    acc[book.level].push(book);
    return acc;
  }, {} as Record<Book['level'], Book[]>);

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 bg-gradient-to-b from-stone-900 to-black text-foreground">
      <div className="w-full max-w-6xl"> {/* Increased max-width for potentially wider rows */}
        <h1 className="text-5xl font-bold mb-4 text-center text-stone-100">
          Biblioteca Bilingüe
        </h1>
        <p className="text-xl text-gray-300 mb-12 text-center"> {/* Increased margin */}
          Descarga libros clásicos por nivel (A1-C2) con traducción Alemán-Español frase a frase.
        </p>

        {/* Iterate through levels and render sections */}
        <div className="space-y-12"> {/* Add space between level sections */}
          {cefrLevels.map((level) => {
            const books = booksByLevel[level];
            if (!books || books.length === 0) {
              // Optionally render something if a level has no books, or just skip
              // return (
              //   <div key={level}>
              //     <h2 className="text-3xl font-semibold mb-4 text-stone-300 border-b border-stone-700 pb-2">Nivel {level}</h2>
              //     <p className="text-stone-400 italic">No hay libros disponibles para este nivel todavía.</p>
              //   </div>
              // );
              return null; // Skip rendering if no books for this level
            }

            return (
              <section key={level} aria-labelledby={`level-${level}-heading`}>
                <h2 id={`level-${level}-heading`} className="text-3xl font-semibold mb-5 text-stone-200 border-b border-stone-700 pb-2">
                  Nivel {level}
                </h2>
                {/* Use a grid for the books within the level row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      className="bg-stone-800/60 rounded-lg shadow-lg overflow-hidden flex flex-col p-5 border border-stone-700/50 transition duration-300 ease-in-out hover:bg-stone-700/70 hover:shadow-xl"
                    >
                      <div className="flex flex-col flex-grow">
                        <h3 className="text-lg font-semibold mb-1 text-stone-100">{book.title}</h3>
                        <p className="text-sm text-stone-400 mb-2">{book.author}</p>
                        <p className="text-xs text-stone-300 mb-3 flex-grow">{book.description || 'Traducción bilingüe frase a frase.'}</p>
                        <a
                          href={`/books/${book.filename}`}
                          download={book.filename}
                          className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded mt-auto text-center text-sm transition duration-150 ease-in-out self-end"
                          aria-label={`Descargar ${book.title}`}
                        >
                          Descargar
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {availableBooks.length === 0 && (
           <p className="text-center text-muted-foreground mt-10">
              No hay libros disponibles en este momento.
            </p>
        )}
      </div>
    </main>
  );
}

// Opcional: Añadir metadatos para SEO
export const metadata = {
  title: 'Biblioteca Bilingüe - Libros Traducidos',
  description: 'Descarga libros clásicos traducidos frase a frase del alemán al español.',
};