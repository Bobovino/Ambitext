import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  
  // Verificar que exista el progreso para esta sesión
  if (
    !global.translationProgress || 
    !global.translationProgress[sessionId]
  ) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
  }
  
  // Devolver el estado actual del progreso
  return NextResponse.json(global.translationProgress[sessionId]);
}
