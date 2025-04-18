import { NextResponse } from 'next/server';

// Obtener configuración desde variables de entorno
const CONFIG = {
  limitedMode: process.env.LIMITED_MODE !== 'false',
  maxPages: parseInt(process.env.MAX_PAGES || '3')
};

export async function GET() {
  return NextResponse.json(CONFIG);
}
