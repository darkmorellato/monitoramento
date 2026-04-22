// ═══════════════════════════════════════════════════════════════
// OCR WEB WORKER - Processamento assíncrono de imagens
// ═══════════════════════════════════════════════════════════════

import { extractDataFromText, OCRResult } from '../ocr/core';

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
  payload?: OCRResult;
  progress?: number;
  error?: string;
}

// Tesseract será carregado dinamicamente
let Tesseract: typeof import('tesseract.js') | null = null;

async function loadTesseract(): Promise<typeof import('tesseract.js')> {
  if (Tesseract) return Tesseract;
  
  // Import dinâmico do Tesseract
  const tesseractModule = await import('tesseract.js');
  Tesseract = tesseractModule;
  return Tesseract;
}

// Cache do worker Tesseract
let worker: import('tesseract.js').Worker | null = null;
let isWorkerReady = false;

async function initWorker(): Promise<import('tesseract.js').Worker> {
  if (worker && isWorkerReady) return worker;
  
  const tesseract = await loadTesseract();
  worker = await tesseract.createWorker('por', 1, {
    logger: (m: any) => {
      if (m.status === 'recognizing text') {
        self.postMessage({
          type: 'PROGRESS',
          progress: m.progress,
        });
      }
    },
    errorHandler: (err: Error) => {
      console.error('[OCR Worker] Error:', err);
    },
  });
  
  isWorkerReady = true;
  return worker;
}

async function processImage(imageData: string, storeType?: string): Promise<OCRResult> {
  const ocrWorker = await initWorker();
  
  const {
    data: { text },
  } = await ocrWorker.recognize(imageData);
  
  // Extrai dados usando a lógica existente
  const result = extractDataFromText(text, storeType);
  
  return result;
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
        // Cancela operações pendentes
        if (worker) {
          await worker.terminate();
          worker = null;
          isWorkerReady = false;
        }
        
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
self.onclose = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
};
