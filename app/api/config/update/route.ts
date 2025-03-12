import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Este secreto debería estar en variables de entorno
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-key';

// Ruta al archivo de configuración compartido
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

// Función para actualizar el archivo de configuración
async function updateConfig(newConfig: any) {
  try {
    // Asegurarse de que existe el directorio
    await fs.promises.mkdir(path.dirname(CONFIG_PATH), { recursive: true }).catch(() => {});
    
    // Escribir la nueva configuración
    await fs.promises.writeFile(
      CONFIG_PATH,
      JSON.stringify(newConfig, null, 2)
    );
    
    return true;
  } catch (error) {
    console.error('Error guardando configuración:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Verificar la autenticación
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    
    // Validar los datos recibidos
    if (typeof body.limitedMode !== 'boolean') {
      return NextResponse.json({ error: 'El campo limitedMode debe ser un booleano' }, { status: 400 });
    }
    
    if (body.maxPages !== undefined && (!Number.isInteger(body.maxPages) || body.maxPages < 1)) {
      return NextResponse.json({ error: 'El campo maxPages debe ser un número entero positivo' }, { status: 400 });
    }
    
    // Construir la nueva configuración
    const newConfig = {
      limitedMode: body.limitedMode,
      maxPages: body.maxPages || 5
    };
    
    // Actualizar el archivo de configuración
    const success = await updateConfig(newConfig);
    
    if (success) {
      return NextResponse.json({ 
        message: 'Configuración actualizada correctamente',
        config: newConfig 
      });
    } else {
      return NextResponse.json({ error: 'Error guardando la configuración' }, { status: 500 });
    }
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error procesando la solicitud',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
