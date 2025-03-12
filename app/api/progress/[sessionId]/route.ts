import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  
  console.log(`Solicitud de progreso para sesión: ${sessionId}`);
  
  // Verificar que exista la variable global
  if (typeof global.translationProgress === 'undefined') {
    console.log("No existe objeto de progreso global");
    return NextResponse.json({ error: 'Sistema de progreso no inicializado' }, { status: 404 });
  }
  
  // Verificar que exista el progreso para esta sesión
  if (!global.translationProgress[sessionId]) {
    console.log(`No se encontró progreso para la sesión: ${sessionId}`);
    return NextResponse.json({ 
      error: 'Sesión no encontrada',
      availableSessions: Object.keys(global.translationProgress)
    }, { status: 404 });
  }
  
  // Asegurarse de que los datos de progreso sean válidos
  const progress = global.translationProgress[sessionId];
  const safeProgress = {
    totalSentences: progress.totalSentences || 0,
    completedSentences: progress.completedSentences || 0,
    totalPages: progress.totalPages || 1,
    currentPage: progress.currentPage || 0,
    status: progress.status || 'processing',
    limitedMode: !!progress.limitedMode,
    processedPages: progress.processedPages || 0,
    totalPdfPages: progress.totalPdfPages || 0
  };
  
  console.log(`Progreso actual: ${safeProgress.completedSentences}/${safeProgress.totalSentences} frases, estado: ${safeProgress.status}`);
  
  // Devolver el estado actual del progreso
  return NextResponse.json(safeProgress);
}
