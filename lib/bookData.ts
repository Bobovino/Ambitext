// lib/bookData.ts

// Define la estructura de datos para un libro
export interface Book {
  id: string;
  title: string;
  author: string;
  filename: string;
  languagePair: 'DE-ES' | 'EN-ES'; // Add more language pairs as needed
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  description?: string;
}

// Function to generate mock books for a specific language pair and level
const generateMockBooks = (langPair: Book['languagePair'], level: Book['level'], count: number): Book[] => {
  const books: Book[] = [];
  const langPrefix = langPair.split('-')[0].toLowerCase();
  for (let i = 1; i <= count; i++) {
    books.push({
      id: `${langPrefix}_${level.toLowerCase()}_book_${i}`,
      title: `${level} Book ${i} (${langPair})`,
      author: `Author ${String.fromCharCode(65 + i % 26)} ${level}`,
      filename: `${langPrefix}_${level.toLowerCase()}_book_${i}_${langPair.toLowerCase()}.pdf`,
      languagePair: langPair,
      level: level,
      description: `A mock description for ${level} book number ${i} in ${langPair}.`
    });
  }
  return books;
};

// Define the order of levels 
export const cefrLevels: Book['level'][] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Generate mock books for each level and language pair
let generatedBooks: Book[] = [];
const booksPerLevel = 10;

(['DE-ES', 'EN-ES'] as Book['languagePair'][]).forEach(langPair => {
  cefrLevels.forEach(level => {
    generatedBooks = generatedBooks.concat(generateMockBooks(langPair, level, booksPerLevel));
  });
});

// Combine with any existing real books (optional, if you want to keep them)
const realBooks: Book[] = [
  {
    id: 'goethe_werther',
    title: 'Las penas del joven Werther',
    author: 'Johann Wolfgang von Goethe',
    filename: 'Goethe_die_leiden_des_jungen_werther.pdf',
    languagePair: 'DE-ES',
    level: 'C1',
    description: 'Un clásico del movimiento Sturm und Drang.'
  },
  {
    id: 'durrenmatt_physiker',
    title: 'Los Físicos',
    author: 'Friedrich Dürrenmatt',
    filename: 'Die Physiker traducido.pdf',
    languagePair: 'DE-ES',
    level: 'B2',
    description: 'Una comedia grotesca sobre ciencia y responsabilidad.'
  },
  {
    id: 'kastner_emil',
    title: 'Emilio y los detectives',
    author: 'Erich Kästner',
    filename: 'Emil und die Detektive traducido.pdf',
    languagePair: 'DE-ES',
    level: 'A2',
    description: 'Un clásico de la literatura infantil alemana.'
  },
  {
    id: 'wells_time_machine',
    title: 'La Máquina del Tiempo',
    author: 'H.G. Wells',
    filename: 'wells_time_machine_en_es.pdf', 
    languagePair: 'EN-ES',
    level: 'B1',
    description: 'Un viaje pionero a través del tiempo.'
  },
   {
    id: 'wilde_dorian_gray',
    title: 'El Retrato de Dorian Gray',
    author: 'Oscar Wilde',
    filename: 'wilde_dorian_gray_en_es.pdf', 
    languagePair: 'EN-ES',
    level: 'B2',
    description: 'Una novela filosófica sobre la belleza, la moralidad y la vanidad.'
  },
   {
    id: 'simple_english_story',
    title: 'A Simple Story',
    author: 'Jane Doe',
    filename: 'simple_english_story_en_es.pdf', 
    languagePair: 'EN-ES',
    level: 'A1',
    description: 'Una historia sencilla para principiantes.'
  },
];

// Export the final list of books (generated + real)
// Ensure unique IDs if combining real and generated
const allBooksMap = new Map<string, Book>();
realBooks.forEach(book => allBooksMap.set(book.id, book));
generatedBooks.forEach(book => {
  if (!allBooksMap.has(book.id)) { // Avoid overwriting real books if IDs clash
    allBooksMap.set(book.id, book);
  }
});

export const availableBooks: Book[] = Array.from(allBooksMap.values());

// Helper to get display name for language pair
export const getLanguagePairName = (pair: Book['languagePair']): string => {
  switch (pair) {
    case 'DE-ES': return 'Alemán - Español';
    case 'EN-ES': return 'Inglés - Español';
    default: 
      // Fallback for potential future pairs
      // Cast pair to string as TS infers 'never' here
      const stringPair = pair as string; 
      const parts = stringPair.split('-');
      // Simple capitalization for fallback
      const formatPart = (part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      // Ensure split resulted in two parts before formatting
      if (parts.length === 2) {
        return `${formatPart(parts[0])} - ${formatPart(parts[1])}`;
      }
      // Return the original string if format is unexpected
      return stringPair; 
  }
};
