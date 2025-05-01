// scripts/seedDatabase.ts

// Load dotenv FIRST
import dotenv from 'dotenv';
import path from 'path';
const configResult = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// --- Debugging ---
console.log('[Seed Script] dotenv config result:', configResult.error ? configResult.error : 'Loaded OK'); // Show error if dotenv failed
console.log('[Seed Script] Checking process.env.NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Exists' : 'MISSING');
console.log('[Seed Script] Checking process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Exists' : 'MISSING');
// --- End Debugging ---

// Import the function
import { getSupabaseClient } from '../lib/supabaseClient';
import { availableBooks, Book } from '../lib/bookData';

console.log('[Seed Script] Calling getSupabaseClient()...');
// Get the client AFTER dotenv has run
const supabase = getSupabaseClient();
console.log('[Seed Script] getSupabaseClient() returned.');

async function seedDatabase() {
  console.log('Starting database seeding...');

  // Prepare data for insertion
  const booksToInsert = availableBooks.map(book => ({
    title: book.title,
    author: book.author,
    filename: book.filename,
    languagePair: book.languagePair,
    level: book.level,
    description: book.description,
  }));

  // Insert data in chunks
  const chunkSize = 50;
  for (let i = 0; i < booksToInsert.length; i += chunkSize) {
    const chunk = booksToInsert.slice(i, i + chunkSize);
    console.log(`Inserting chunk ${i / chunkSize + 1}...`);

    const { data, error } = await supabase // Use the initialized client
      .from('books')
      .insert(chunk)
      .select();

    if (error) {
      console.error('Error inserting chunk:', error);
    } else {
      console.log(`Successfully inserted ${data?.length || 0} books in this chunk.`);
    }
  }

  console.log('Database seeding completed.');
}

seedDatabase().catch(error => {
  console.error('Seeding script failed:', error);
  process.exit(1);
});