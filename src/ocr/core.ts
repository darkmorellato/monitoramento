import { showToast } from '../ui';

declare const Tesseract: any;

const _workers: Record<string, any> = {};

export async function getWorker(lang: string, paramsKey: string | null = null, params: any = null): Promise<any> {
    const cacheKey = paramsKey ? `${lang}_${paramsKey}` : lang;
    if (!_workers[cacheKey]) {
        _workers[cacheKey] = await Tesseract.createWorker(lang);
        if (params) await _workers[cacheKey].setParameters(params);
    }
    return _workers[cacheKey];
}

export function playSound(src: string): void {
    try {
        const audio = new Audio(src);
        audio.volume = 0.8;
        audio.play().catch(() => {});
    } catch (e) {}
}

let tesseractLoaded = false;
export async function loadTesseract(): Promise<void> {
    if (tesseractLoaded) return;
    if (typeof Tesseract !== 'undefined') { tesseractLoaded = true; return; }
    showToast('⏳ Carregando OCR (primeira vez)...', 'info');
    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => { tesseractLoaded = true; resolve(); };
        script.onerror = () => reject(new Error('Falha ao carregar Tesseract.js da CDN'));
        document.head.appendChild(script);
        setTimeout(() => reject(new Error('Timeout ao carregar Tesseract.js (CDN lenta ou offline)')), 20000);
    });
}
