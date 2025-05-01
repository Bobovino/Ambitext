// Create new file: app/about/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - Bilingual Tools',
  description: 'Learn more about the Bilingual Library and Document Translator project.',
};

export default function AboutPage() {
  return (
    <main className="flex min-h-screen flex-col items-center pt-12 pb-12 px-6 bg-gradient-to-b from-stone-900 to-black text-foreground">
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl font-bold mb-8 text-center text-stone-100">
          Sobre Este Proyecto
        </h1>

        <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
          <p>
            Bienvenido a nuestro sitio, una plataforma dedicada a proporcionar herramientas útiles para estudiantes de idiomas y lectores. Nuestro objetivo es facilitar el acceso a textos bilingües y ofrecer una solución práctica para traducir documentos personales.
          </p>

          <h2 className="text-2xl font-semibold pt-4 text-emerald-400">La Biblioteca Bilingüe</h2>
          <p>
            Nuestra biblioteca contiene obras clásicas de la literatura cuyo texto original se encuentra en el <span className="font-semibold">dominio público</span>, obtenidas de fuentes como Project Gutenberg. Las traducciones paralelas que acompañan a estos textos han sido generadas utilizando <span className="font-semibold">herramientas de traducción automática</span> (como EasyNMT).
          </p>
          <p className="text-sm text-stone-400 border-l-4 border-stone-600 pl-4 italic">
            Es importante tener en cuenta que, si bien nos esforzamos por la calidad, las traducciones automáticas pueden contener errores o no capturar completamente los matices del texto original. Se proporcionan como una ayuda para el estudio y la comparación, no como sustitutos de traducciones profesionales.
          </p>

          <h2 className="text-2xl font-semibold pt-4 text-blue-400">El Traductor de Documentos</h2>
          <p>
            La herramienta de traducción de documentos le permite subir sus propios archivos PDF o EPUB y obtener una versión traducida. Utilizamos tecnología de IA para procesar y traducir el texto manteniendo la estructura del documento en la medida de lo posible. La privacidad de sus documentos es importante; los archivos subidos se procesan y no se almacenan a largo plazo una vez completada la traducción. (Consulte nuestra Política de Privacidad para más detalles).
          </p>

          <h2 className="text-2xl font-semibold pt-4 text-stone-300">Tecnología</h2>
          <p>
            Este sitio está construido con Next.js, React, Tailwind CSS y utiliza Supabase para la gestión de la base de datos y el almacenamiento de archivos. Las traducciones son impulsadas por modelos de IA a través de bibliotecas como EasyNMT.
          </p>

          <h2 className="text-2xl font-semibold pt-4 text-stone-300">Contacto</h2>
          <p>
            Puedes encontrarme o contactarme a través de LinkedIn:
            <a
              href="https://www.linkedin.com/in/rodrigo-martinez-tabernero/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline ml-2"
            >
              LinkedIn Profile
            </a>
          </p>
          {/*
          <p>
            O enviarme un correo a: <a href="mailto:your-email@example.com" className="text-emerald-400 hover:underline">your-email@example.com</a>
          </p>
          */}
        </div>

        <div className="text-center mt-12">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition duration-150 ease-in-out text-lg">
            ← Volver a la página principal
          </Link>
        </div>
      </div>
    </main>
  );
}