import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script' // Import Script
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
        {/* Google AdSense Script */}
        {publisherId !== 'YOUR_PUBLISHER_ID' && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive" // Load after the page becomes interactive
          />
        )}
      </head>
      <body className={`${inter.className} bg-background text-foreground`}>
        {children}
        {/* Footer added */}
        <footer className="w-full py-4 px-6 md:px-12 mt-12 text-center text-sm text-stone-400 border-t border-stone-700/50">
          <p>&copy; {new Date().getFullYear()} Biblioteca Bilingüe. Todos los derechos reservados.</p>
          <nav className="mt-2">
            <Link href="/privacy" className="hover:text-stone-200 transition duration-150 ease-in-out">
              Política de Privacidad
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  )
}
