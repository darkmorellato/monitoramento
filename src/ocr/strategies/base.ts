import { OcrResult } from '../ocr';

/**
 * Normaliza os símbolos de estrelas e caracteres barulhentos gerados pelo OCR.
 */
export function normalizeOcrNoise(text?: string | null): string {
    if (!text) return '';
    return text
        .replace(/[\u2B50\u{1F31F}\u{1F4AB}\u{2728}]/gu, '★')
        .replace(/[★☆✯✰✦✧⋆✶✷✸✹✺❋❉❊✿❀⚜⚑⛝]/g, '★')
        .replace(/(?<!\d)\*(?!\d)/g, '★')
        .replace(/[•·∙⋅◦●○◉◎⦁⦾]/g, '·');
}

/**
 * Transforma sequências de estrelas em uma única estrela.
 */
export function collapseStars(text?: string | null): string {
    if (!text) return '';
    return text.replace(/★{1,10}/g, '★');
}

export interface IOcrStrategy {
    id: string;
    extract(ocrData: any, allTexts: string[]): OcrResult;
}
