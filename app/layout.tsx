import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PDF Traductor ',
  description: 'Traduce PDFs en más de 200 idiomas con líneas intercaladas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || 'YOUR_PUBLISHER_ID'

  return (
    <html lang="es">
      <head>
        {publisherId !== 'YOUR_PUBLISHER_ID' && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`${inter.className} bg-gradient-to-b from-stone-900 to-black text-foreground min-h-screen flex flex-col`}>
        <div className="flex-grow">
          {children}
        </div>
        <footer className="w-full py-4 px-6 md:px-12 mt-12 text-center text-sm text-stone-400 border-t border-stone-700/50">
          <p>&copy; {new Date().getFullYear()} Biblioteca Bilingüe y Traductor. Todos los derechos reservados.</p>
          <nav className="mt-2 space-x-4">
            <Link href="/privacy" className="hover:text-stone-200 transition duration-150 ease-in-out">
              Política de Privacidad
            </Link>
            <Link href="/about" className="hover:text-stone-200 transition duration-150 ease-in-out">
              Sobre Nosotros
            </Link>
            <a
              href="https://www.linkedin.com/in/rodrigo-martinez-tabernero/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-200 transition duration-150 ease-in-out"
            >
              LinkedIn
            </a>
            {/*
            <a href="mailto:your-email@example.com" className="hover:text-stone-200 transition duration-150 ease-in-out">
              Contacto
            </a>
            */}
          </nav>
        </footer>
      </body>
    </html>
  )
}
