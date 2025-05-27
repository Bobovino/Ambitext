import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!global.translationProgress) global.translationProgress = {};
  if (!global.translationProgress[sessionId]) {
    // Inicializa un progreso vacío para evitar 404 infinitos
    global.translationProgress[sessionId] = {
      totalSentences: 0,
      completedSentences: 0,
      totalPages: 0,
      currentPage: 0,
      totalBatches: 0,
      completedBatches: 0,
      status: 'processing', // Nuevo estado
      limitedMode: false,
      processedPages: 0,
      totalPdfPages: 0,
    };
  }

  return NextResponse.json(global.translationProgress[sessionId]);
}
