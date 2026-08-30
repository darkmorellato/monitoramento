// ═══════════════════════════════════════════════════════════════
// OCR WEB WORKER - Processamento assíncrono de imagens
// ═══════════════════════════════════════════════════════════════

// Tipos de mensagens Worker
interface WorkerMessage {
  id: string;
  type: 'PROCESS_IMAGE' | 'CANCEL';
  payload: {
    imageData: string;
    storeType?: string;
  };
}

interface WorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload?: {
    total?: number;
    rating?: number;
    date?: string;
    confidence?: number;
    rawText?: string;
  };
  progress?: number;
  error?: string;
}

// Simulação simples - Tesseract não está instalado no projeto
// O OCR real requer a biblioteca tesseract.js
let isProcessing = false;

async function processImage(imageData: string, _storeType?: string): Promise<WorkerResponse['payload']> {
  if (isProcessing) {
    throw new Error('Already processing an image');
  }

  isProcessing = true;

  try {
    // Simula processamento - em produção usar Tesseract
    // Reporta progresso
    for (let i = 0; i <= 100; i += 25) {
      self.postMessage({
        id: 'progress',
        type: 'PROGRESS' as const,
        progress: i / 100,
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Retorna resultado simulado
    // Em produção, usar Tesseract para extrair texto real
    return {
      total: 100,
      rating: 4.5,
      date: new Date().toISOString().split('T')[0],
      confidence: 0.85,
      rawText: 'Sample OCR text - Tesseract not available',
    };
  } finally {
    isProcessing = false;
  }
}

// Handler de mensagens do Worker
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'PROCESS_IMAGE':
        const result = await processImage(payload.imageData, payload.storeType);

        const successResponse: WorkerResponse = {
          id,
          type: 'SUCCESS',
          payload: result,
        };

        self.postMessage(successResponse);
        break;

      case 'CANCEL':
        isProcessing = false;

        const cancelResponse: WorkerResponse = {
          id,
          type: 'SUCCESS',
        };

        self.postMessage(cancelResponse);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const errorResponse: WorkerResponse = {
      id,
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    self.postMessage(errorResponse);
  }
};

// Cleanup on terminate
self.onclose = () => {
  isProcessing = false;
};
