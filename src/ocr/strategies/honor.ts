import { IOcrStrategy, normalizeOcrNoise, collapseStars } from './base';
import { OcrResult } from '../ocr';

export class HonorStrategy implements IOcrStrategy {
    id = 'honor';

    extract(ocrData: any, allTexts: string[]): OcrResult {
        let rating: number | null = null;
        let total: number | null = null;

        // Tentar capturar dos textos processados
        for (const rawText of allTexts) {
            const normalized = normalizeOcrNoise(rawText);
            const collapsed = collapseStars(normalized);

            // Tentar extrair nota e total de parênteses diretos "X,X ★ (YYY)"
            const m = collapsed.match(/(?:([0-5][,.][0-9])\s*★\s*)?\(\s*(\d{1,6})\s*\)/);
            if (m) {
                if (m[1]) rating = parseFloat(m[1].replace(',', '.'));
                if (m[2]) {
                    const parsedTotal = parseInt(m[2], 10);
                    if (parsedTotal > 1) total = parsedTotal;
                }
            }
            if (rating && total) break;
        }

        return { rating, total };
    }
}
