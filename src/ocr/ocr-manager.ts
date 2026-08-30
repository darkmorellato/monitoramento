// ═══════════════════════════════════════════════════════════════
// OCR MANAGER - Gerenciamento de Web Workers para OCR
// ═══════════════════════════════════════════════════════════════

import { OCRResult } from '../../types';

type OCRStatus = 'idle' | 'loading' | 'processing' | 'success' | 'error';

interface OCRState {
  status: OCRStatus;
  progress: number;
  result: OCRResult | null;
  error: string | null;
}

type StateTransition = {
  from: OCRStatus;
  to: OCRStatus;
  action?: () => void;
};

// Máquina de Estados Finita (FSM) para OCR
class OCRStateMachine {
  private state: OCRState = {
    status: 'idle',
    progress: 0,
    result: null,
    error: null,
  };

  private worker: Worker | null = null;
  private pendingRequest: { resolve: (value: OCRResult) => void; reject: (reason: Error) => void } | null = null;

  // Transições válidas
  private transitions: StateTransition[] = [
    { from: 'idle', to: 'loading' },
    { from: 'loading', to: 'processing' },
    { from: 'processing', to: 'success' },
    { from: 'processing', to: 'error' },
    { from: 'error', to: 'idle' },
    { from: 'success', to: 'idle' },
  ];

  private canTransition(to: OCRStatus): boolean {
    return this.transitions.some(t => t.from === this.state.status && t.to === to);
  }

  private transition(to: OCRStatus, data?: Partial<OCRState>): void {
    if (!this.canTransition(to)) {
      console.warn(`[OCR FSM] Invalid transition: ${this.state.status} -> ${to}`);
      return;
    }

    this.state.status = to;
    if (data) {
      Object.assign(this.state, data);
    }

    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    // Notifica listeners de mudança de estado
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ocr-state-change', { detail: { ...this.state } }));
    }
  }

  getState(): OCRState {
    return { ...this.state };
  }

  getStatus(): OCRStatus {
    return this.state.status;
  }

  isProcessing(): boolean {
    return this.state.status === 'processing' || this.state.status === 'loading';
  }

  async initialize(): Promise<void> {
    if (this.worker) return;

    this.transition('loading');

    try {
      this.worker = new Worker(new URL('../workers/ocr.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        this.handleWorkerError(error);
      };

      this.transition('idle');
    } catch (error) {
      this.transition('error', { error: error instanceof Error ? error.message : 'Failed to initialize worker' });
      throw error;
    }
  }

  private handleWorkerMessage(data: any): void {
    switch (data.type) {
      case 'PROGRESS':
        this.state.progress = data.progress;
        this.notifyStateChange();
        break;

      case 'SUCCESS':
        this.transition('success', { result: data.payload, progress: 100 });
        if (this.pendingRequest) {
          this.pendingRequest.resolve(data.payload);
          this.pendingRequest = null;
        }
        break;

      case 'ERROR':
        this.transition('error', { error: data.error });
        if (this.pendingRequest) {
          this.pendingRequest.reject(new Error(data.error));
          this.pendingRequest = null;
        }
        break;
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    this.transition('error', { error: error.message });
    if (this.pendingRequest) {
      this.pendingRequest.reject(new Error(error.message));
      this.pendingRequest = null;
    }
  }

  async process(imageData: string, storeType?: string): Promise<OCRResult> {
    if (!this.worker) {
      await this.initialize();
    }

    if (this.isProcessing()) {
      throw new Error('OCR is already processing an image');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequest = { resolve, reject };
      this.transition('processing', { progress: 0, result: null, error: null });

      this.worker!.postMessage({
        id: crypto.randomUUID(),
        type: 'PROCESS_IMAGE',
        payload: { imageData, storeType },
      });
    });
  }

  cancel(): void {
    if (!this.worker) return;

    this.worker.postMessage({
      id: crypto.randomUUID(),
      type: 'CANCEL',
    });

    this.transition('idle', { progress: 0 });
    
    if (this.pendingRequest) {
      this.pendingRequest.reject(new Error('OCR cancelled'));
      this.pendingRequest = null;
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.transition('idle', { progress: 0, result: null, error: null });
  }
}

// Singleton instance
export const ocrManager = new OCRStateMachine();

// Helper functions
export async function processImageWithOCR(imageData: string, storeType?: string): Promise<OCRResult> {
  return ocrManager.process(imageData, storeType);
}

export function getOCRProgress(): number {
  return ocrManager.getState().progress;
}

export function isOCRBusy(): boolean {
  return ocrManager.isProcessing();
}

export function cancelOCR(): void {
  ocrManager.cancel();
}
