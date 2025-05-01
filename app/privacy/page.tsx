import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidad - Biblioteca Bilingüe',
  description: 'Política de privacidad para el sitio Biblioteca Bilingüe.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 bg-gradient-to-b from-stone-900 to-black text-foreground">
      <div className="w-full max-w-4xl bg-stone-800/50 p-8 rounded-lg shadow-xl border border-stone-700/50">
        <h1 className="text-4xl font-bold mb-6 text-center text-stone-100">
          Política de Privacidad
        </h1>
        <div className="space-y-4 text-stone-300">
          <p>Última actualización: {new Date().toLocaleDateString('es-ES')}</p>

          <h2 className="text-2xl font-semibold text-stone-200 pt-4">Introducción</h2>
          <p>
            Bienvenido/a a Biblioteca Bilingüe. Nos comprometemos a proteger tu privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y salvaguardamos tu información cuando visitas nuestro sitio web. Por favor, lee esta política de privacidad cuidadosamente. Si no estás de acuerdo con los términos de esta política de privacidad, por favor no accedas al sitio.
          </p>

          <h2 className="text-2xl font-semibold text-stone-200 pt-4">Recopilación de tu Información</h2>
          <p>
            Podemos recopilar información sobre ti de varias maneras. La información que podemos recopilar en el Sitio incluye:
          </p>
          <ul className="list-disc list-inside pl-4">
            <li>
              <strong>Datos Personales:</strong> Información de identificación personal, como tu nombre o dirección de correo electrónico, que nos proporcionas voluntariamente (por ejemplo, al contactarnos). No estás obligado/a a proporcionarnos información personal de ningún tipo, sin embargo, tu negativa a hacerlo puede impedirte usar ciertas características del Sitio.
            </li>
            <li>
              <strong>Datos Derivados:</strong> Información que nuestros servidores recopilan automáticamente cuando accedes al Sitio, como tu dirección IP, tipo de navegador, sistema operativo, tiempos de acceso y las páginas que has visto directamente antes y después de acceder al Sitio.
            </li>
             <li>
              <strong>Datos de Publicidad (Futuro):</strong> Si integramos publicidad (como Google AdMob), los proveedores de publicidad pueden usar cookies de seguimiento y otras tecnologías para recopilar información sobre tu uso del Sitio y otros sitios web, como tu dirección IP, ID de dispositivo, navegador web, páginas vistas, tiempo dedicado a las páginas, enlaces pulsados e información de conversión. Esta información puede ser utilizada para, entre otras cosas, analizar y rastrear datos, determinar la popularidad de cierto contenido y entregar publicidad dirigida a tus intereses.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-stone-200 pt-4">Uso de tu Información</h2>
          <p>
            Tener información precisa sobre ti nos permite proporcionarte una experiencia fluida, eficiente y personalizada. Específicamente, podemos usar la información recopilada sobre ti a través del Sitio para:
          </p>
          <ul className="list-disc list-inside pl-4">
            <li>Administrar el sitio web.</li>
            <li>Mejorar tu experiencia de navegación personalizando el sitio web.</li>
            <li>Responder a tus consultas y solicitudes.</li>
            <li>Monitorear y analizar el uso y las tendencias para mejorar tu experiencia con el Sitio.</li>
            <li>Mostrar anuncios (si se implementan en el futuro).</li>
          </ul>

          <h2 className="text-2xl font-semibold text-stone-200 pt-4">Divulgación de tu Información</h2>
          <p>
            No compartiremos tu información personal con terceros excepto como se describe en esta Política de Privacidad o si obtenemos tu consentimiento.
          </p>

          <h2 className="text-2xl font-semibold text-stone-200 pt-4">Seguridad de tu Información</h2>
          <p>
            Utilizamos medidas de seguridad administrativas, técnicas y físicas para ayudar a proteger tu información personal. Si bien hemos tomado medidas razonables para asegurar la información personal que nos proporcionas, ten en cuenta que a pesar de nuestros esfuerzos, ninguna medida de seguridad es perfecta o impenetrable, y ningún método de transmisión de datos puede garantizarse contra cualquier interceptación u otro tipo de uso indebido.
          </p>

           <h2 className="text-2xl font-semibold text-stone-200 pt-4">Política para Niños</h2>
          <p>
            No solicitamos conscientemente información ni comercializamos a niños menores de 13 años. Si te das cuenta de que hemos recopilado información personal de niños menores de 13 años, contáctanos utilizando la información de contacto proporcionada a continuación.
          </p>

          <h2 className="text-2xl font-semibold text-stone-200 pt-4">Cambios a esta Política de Privacidad</h2>
          <p>
            Podemos actualizar esta Política de Privacidad de vez en cuando. Te notificaremos cualquier cambio publicando la nueva Política de Privacidad en el Sitio. Se te aconseja revisar esta Política de Privacidad periódicamente para cualquier cambio. Los cambios a esta Política de Privacidad son efectivos cuando se publican en esta página.
          </p>

          <h2 className="text-2xl font-semibold text-stone-200 pt-4">Contáctanos</h2>
          <p>
            Si tienes preguntas o comentarios sobre esta Política de Privacidad, por favor contáctanos en: [Tu Email de Contacto o Formulario de Contacto - ¡¡IMPORTANTE: Añadir esto!!]
          </p>

          <div className="text-center mt-8">
            <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition duration-150 ease-in-out">
              Volver a la página principal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
