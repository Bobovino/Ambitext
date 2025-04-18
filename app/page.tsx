import Link from 'next/link';

// Define la estructura de datos para un libro
interface Book {
  id: string; // Identificador único (puede ser el nombre base del archivo)
  title: string;
  author: string;
  filename: string; // Nombre completo del archivo PDF en /public/books/
  languagePair: string; // Ej: "DE-ES"
  description?: string; // Opcional
}

// Lista de los libros traducidos disponibles
// ¡¡RELLENA ESTO CON TUS 10 LIBROS!!
const availableBooks: Book[] = [
  {
    id: 'goethe_werther', // ID único
    title: 'Las penas del joven Werther', // Título en español
    author: 'Johann Wolfgang von Goethe', // Autor
    filename: 'Goethe_die_leiden_des_jungen_werther.pdf', // Nombre exacto del archivo en public/books
    languagePair: 'DE-ES',
    description: 'Un clásico del movimiento Sturm und Drang.'
  },
  {
    id: 'durrenmatt_physiker', // ID único
    title: 'Los Físicos', 
    author: 'Friedrich Dürrenmatt', // Autor (supuesto)
    filename: 'Die Physiker traducido.pdf', // Nombre exacto del archivo en public/books
    languagePair: 'DE-ES',
    description: 'Una comedia grotesca sobre ciencia y responsabilidad.' // Descripción (supuesta)
  },
  {
    id: 'kastner_emil', // ID único
    title: 'Emilio y los detectives', // Título en español (supuesto)
    author: 'Erich Kästner', // Autor (supuesto)
    filename: 'Emil und die Detektive traducido.pdf', // Nombre exacto del archivo en public/books
    languagePair: 'DE-ES',
    description: 'Un clásico de la literatura infantil alemana.' // Descripción (supuesta)
  },
  // --- Añade aquí los otros 7 libros cuando los tengas ---
  // Ejemplo:
  // {
  //   id: 'kafka_verwandlung',
  //   title: 'La Metamorfosis',
  //   author: 'Franz Kafka',
  //   filename: 'Kafka_die_verwandlung_translated.pdf', // Asegúrate que el nombre del archivo es correcto
  //   languagePair: 'DE-ES',
  //   description: 'La inquietante historia de Gregorio Samsa.'
  // },
  // ... (otros 6 libros)
];

export default function BooksPage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 bg-background text-foreground">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-4 text-center text-stone-200">
          Biblioteca Bilingüe
        </h1>
        <p className="text-lg text-gray-300 mb-8 text-center">
          Descarga libros clásicos con traducción Alemán-Español frase a frase.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-[#333333] p-6 rounded-lg shadow-lg min-h-[80dvh] ">
          {availableBooks.length > 0 ? (
            availableBooks.map((book) => (
              <div
                key={book.id}
                className="bg-stone-800 rounded-lg shadow-lg p-6 flex flex-col justify-between border border-stone-900 h-[25dvh]"
              >
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-stone-100">{book.title}</h2>
                  <p className="text-sm text-stone-400 mb-3">{book.author}</p>
                  <p className="text-sm text-stone-300 mb-4">{book.description || 'Traducción bilingüe frase a frase.'}</p>
                </div>
                <a
                  href={`/books/${book.filename}`}
                  download={book.filename}
                  className="bg-stone-600 hover:bg-stone-700 text-stone-100 font-bold py-2 px-4 rounded mt-4 text-center transition duration-150 ease-in-out"
                  aria-label={`Descargar ${book.title}`}
                >
                  Descargar {/* ({book.languagePair}) */}
                </a>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground md:col-span-2 lg:col-span-3">
              No hay libros disponibles en este momento.
            </p>
          )}
        </div>

{/*         <div className="mt-12 text-center">
          <Link href="/translate" className="text-accent hover:underline">
            ¿Quieres traducir tu propio documento? Prueba el traductor.
          </Link>
        </div> */}
      </div>
    </main>
  );
}

// Opcional: Añadir metadatos para SEO
export const metadata = {
  title: 'Biblioteca Bilingüe - Libros Traducidos',
  description: 'Descarga libros clásicos traducidos frase a frase del alemán al español.',
};