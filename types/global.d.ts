declare global {
  var translationProgress: {
    [key: string]: {
      totalSentences: number;
      completedSentences: number;
      totalPages: number;
      currentPage: number;
      status: 'processing' | 'completed' | 'error';
      limitedMode?: boolean;
      processedPages?: number;
      totalPdfPages?: number;
    };
  };
}

export {};
