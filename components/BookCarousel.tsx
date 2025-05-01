'use client';

import { useState, useRef, useEffect } from 'react';
import { Book } from '@/lib/bookData';
import Link from 'next/link';

interface BookCarouselProps {
  books: Book[];
  title: string;
  languagePairName: string;
}

// Basic SVG Chevron Icons (replace with better icons if available)
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

export default function BookCarousel({ books, title, languagePairName }: BookCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledToStart, setIsScrolledToStart] = useState(true);
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);
  const [showArrows, setShowArrows] = useState(false); // State to control arrow visibility based on content width

  // Card width (w-60 = 240px) + spacing (space-x-5 = 20px)
  const cardOuterWidth = 240 + 20;
  const scrollAmount = cardOuterWidth * 3; // Scroll by approx 3 cards

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollWidth, clientWidth } = scrollContainerRef.current;
      // Show arrows only if content is wider than the container
      setShowArrows(scrollWidth > clientWidth);
      checkScrollPosition(); // Also update button states
    } else {
      setShowArrows(false);
    }
  };

  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setIsScrolledToStart(scrollLeft <= 0);
      setIsScrolledToEnd(scrollLeft >= scrollWidth - clientWidth - 1); // Use 1px buffer
    }
  };

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  useEffect(() => {
    // Need a slight delay for initial render and layout calculation
    const timer = setTimeout(checkScrollability, 100);

    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', checkScrollPosition);
    window.addEventListener('resize', checkScrollability); // Use checkScrollability on resize

    return () => {
      clearTimeout(timer);
      container?.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [books]); // Re-check if books change

  // --- Add Logging Here ---
  useEffect(() => {
    console.log('[BookCarousel] Received books prop:', JSON.stringify(books, null, 2));
  }, [books]);
  // --- End Logging ---

  if (!books || books.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={`carousel-title-${title.replace(/\s+/g, '-')}`}>
      {/* Heading remains constrained */}
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <h3 id={`carousel-title-${title.replace(/\s+/g, '-')}`} className="text-2xl font-semibold mb-5 text-stone-200 border-b border-stone-700 pb-2">
          {title}
        </h3>
      </div>
      {/* Carousel container: Constrain width and center */}
      <div className="relative group max-w-6xl mx-auto">
        {/* Left Arrow: Positioned inside the max-w container */}
        {showArrows && !isScrolledToStart && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-1 cursor-pointer" // Adjusted padding/margin
            aria-label="Scroll left"
          >
            <ChevronLeftIcon />
          </button>
        )}

        {/* Scrollable content area: Padding applied here */}
        <div
          ref={scrollContainerRef}
          // Added px-6 md:px-12 for padding INSIDE the scroll area
          className="flex overflow-x-auto space-x-5 pb-6 scrollbar-hide px-6 md:px-12"
        >
          {books.map((book) => {
            // --- Add Logging Here ---
            const downloadHref = book.filename; // Get the value intended for href
            console.log(`[BookCarousel] Generating link for "${book.title}". href value:`, downloadHref);
            // --- End Logging ---

            return (
              // Book card: w-60 ensures approx 6 are visible in max-w-6xl
              <div
                key={book.id}
                className="flex-shrink-0 w-56 sm:w-60 bg-stone-800 rounded-lg shadow-lg overflow-hidden flex flex-col border border-stone-700/50 transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-xl"
              >
                {/* ... card content remains the same ... */}
                <div className="flex flex-col flex-grow p-4">
                  <h4 className="text-md font-semibold mb-1 text-stone-100 truncate">{book.title}</h4>
                  <p className="text-sm text-stone-400 mb-2 truncate">{book.author}</p>
                  <p className="text-xs text-stone-300 mb-3 flex-grow line-clamp-3">{book.description || `Traducción bilingüe ${languagePairName}.`}</p>
                  <a
                    href={downloadHref} // Use the variable we logged
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded mt-auto text-center text-xs transition duration-150 ease-in-out self-end"
                    aria-label={`Descargar ${book.title}`}
                  >
                    Descargar
                  </a>
                </div>
              </div>
            );
          })}
          {/* No end spacer needed due to internal padding */}
        </div>

        {/* Right Arrow: Positioned inside the max-w container */}
        {showArrows && !isScrolledToEnd && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 z-20 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 mr-1 cursor-pointer" // Adjusted padding/margin
            aria-label="Scroll right"
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>
    </section>
  );
}
