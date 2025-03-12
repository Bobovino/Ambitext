'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [config, setConfig] = useState<{ limitedMode: boolean; maxPages: number }>({ limitedMode: true, maxPages: 5 });
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Cargar configuración actual
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (error) {
        setError('Error cargando configuración');
        console.error(error);
      }
    };

    fetchConfig();
  }, []);

  // Manejar cambios en el formulario
  const handleLimitedModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, limitedMode: e.target.checked }));
  };

  const handleMaxPagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setConfig(prev => ({ ...prev, maxPages: value }));
    }
  };

  // Autenticación
  const handleAuth = () => {
    if (adminKey.trim()) {
      setIsAuthorized(true);
    } else {
      setError('Clave no válida');
    }
  };

  // Guardar cambios
  const handleSaveConfig = async () => {
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/config/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        setMessage('Configuración actualizada correctamente');
        
        // Refrescar la página principal después de un breve retraso
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || 'Error actualizando configuración');
      }
    } catch (error) {
      setError('Error de conexión');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white bg-opacity-10 p-6 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center text-white">Panel de Administración</h1>
        
        {!isAuthorized ? (
          <div className="space-y-4">
            <p className="text-gray-300">Ingresa tu clave de administrador para continuar:</p>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              placeholder="Clave de administrador"
            />
            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Acceder
            </button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded">
              <h2 className="text-lg text-white mb-3">Configuración del PDF Translator</h2>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="limitedMode"
                  checked={config.limitedMode}
                  onChange={handleLimitedModeChange}
                  className="mr-2"
                />
                <label htmlFor="limitedMode" className="text-gray-300">Modo de prueba (limitado)</label>
              </div>
              
              <div className="mb-4">
                <label htmlFor="maxPages" className="block text-gray-300 mb-1">
                  Páginas máximas en modo de prueba:
                </label>
                <input
                  type="number"
                  id="maxPages"
                  value={config.maxPages}
                  onChange={handleMaxPagesChange}
                  min="1"
                  className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 w-full"
                  disabled={!config.limitedMode}
                />
              </div>
              
              <div className="mt-6">
                <button
                  onClick={handleSaveConfig}
                  className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                >
                  Guardar cambios
                </button>
              </div>
              
              {message && <p className="text-green-400 mt-2 text-sm">{message}</p>}
              {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
            </div>
            
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
            >
              Volver a inicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
