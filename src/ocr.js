// ═══════════════════════════════════════════════════════════════
// OCR - Lazy Tesseract.js, Image Processing, Data Extraction
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui.js';

export let currentBase64Image = null;
export let currentMimeType = null;
let tesseractLoaded = false;

function playSound(src) {
    try {
        const audio = new Audio(src);
        audio.volume = 0.8;
        audio.play().catch(() => {});
    } catch (e) {}
}

async function loadTesseract() {
    if (tesseractLoaded) return;
    if (typeof Tesseract !== 'undefined') { tesseractLoaded = true; return; }
    showToast('⏳ Carregando OCR (primeira vez)...', 'info');
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => { tesseractLoaded = true; resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function preprocessForOCR(base64, mode = 'text') {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let w = img.width, h = img.height;
            const maxDim = mode === 'text' ? 2000 : 1800;
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio); h = Math.round(h * ratio);
            }
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            if (mode === 'text') {
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const brightness = (r + g + b) / 3;
                    if (brightness > 200) { data[i] = data[i + 1] = data[i + 2] = 255; }
                    else if (brightness < 80) { data[i] = data[i + 1] = data[i + 2] = 0; }
                    else { const val = Math.min(255, Math.max(0, ((brightness - 128) * 1.8) + 128)); data[i] = data[i + 1] = data[i + 2] = val; }
                }
            } else {
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    let val = gray;
                    if (gray > 140) val = 255; else if (gray < 60) val = 0; else val = Math.min(255, Math.max(0, ((gray - 128) * 1.6) + 128));
                    data[i] = data[i + 1] = data[i + 2] = val;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = base64;
    });
}

export async function autoExtractFromImage(base64Image) {
    if (!base64Image) return;
    try { await loadTesseract(); } catch (e) { showToast('❌ Erro ao carregar OCR.', 'error'); return; }
    showToast('🔍 Extraindo dados da imagem...', 'success');
    try {
        const modes = ['text', 'highContrast'];
        const langs = ['por+eng', 'eng', 'por'];
        let bestResult = { rating: null, total: null };
        for (const mode of modes) {
            const processedImage = await preprocessForOCR(base64Image, mode);
            for (const lang of langs) {
                try {
                    const worker = await Tesseract.createWorker(lang);
                    const { data } = await worker.recognize(processedImage);
                    await worker.terminate();
                    const extracted = extractGoogleRatingData(data);
                    if (extracted.rating && !bestResult.rating) bestResult.rating = extracted.rating;
                    if (extracted.total && !bestResult.total) bestResult.total = extracted.total;
                    if (bestResult.rating && bestResult.total) break;
                } catch (e) { console.error('OCR Erro:', e); }
            }
            if (bestResult.rating && bestResult.total) break;
        }
        if (!bestResult.rating || !bestResult.total) {
            try {
                const worker = await Tesseract.createWorker('por+eng');
                const { data } = await worker.recognize(base64Image);
                await worker.terminate();
                const fallback = extractGoogleRatingData(data);
                if (fallback.rating && !bestResult.rating) bestResult.rating = fallback.rating;
                if (fallback.total && !bestResult.total) bestResult.total = fallback.total;
            } catch (e) { console.error('OCR Fallback Erro:', e); }
        }
        const totalInput = document.getElementById('totalInput');
        const ratingInput = document.getElementById('ratingInput');
        let filled = 0;
        if (bestResult.total !== null && bestResult.total > 0) { totalInput.value = bestResult.total; totalInput.classList.add('ring-2', 'ring-green-400'); setTimeout(() => totalInput.classList.remove('ring-2', 'ring-green-400'), 2500); filled++; }
        if (bestResult.rating !== null && bestResult.rating >= 0 && bestResult.rating <= 5) { ratingInput.value = bestResult.rating; ratingInput.classList.add('ring-2', 'ring-green-400'); setTimeout(() => ratingInput.classList.remove('ring-2', 'ring-green-400'), 2500); filled++; }
        if (filled > 0) {
            playSound('assets/voice/voice2.mp3');
            showToast(`✅ OCR extraiu ${filled} dado(s)! Nota: ${bestResult.rating || '?'} | Total: ${bestResult.total || '?'}`, 'success');
        } else showToast('⚠️ Não foi possível extrair dados. Insira manualmente.', 'warn');
    } catch (e) { console.error('OCR Erro fatal:', e); showToast('❌ Erro no OCR: ' + e.message, 'error'); }
}

function extractGoogleRatingData(ocrData) {
    const { text, lines, words } = ocrData;
    let rating = null, total = null;
    const allText = text.replace(/\s+/g, ' ').trim();
    const patterns = [
        { regex: /([0-5][,.]\d)\s*([★☆*✯✰⭐]{1,5})/g, ratingIdx: 1, totalIdx: -1 },
        { regex: /([0-5][,.]\d)\s*\((\d+)\)/g, ratingIdx: 1, totalIdx: 2 },
        { regex: /([0-5][,.]\d)\s+([★☆*✯✰⭐]{1,5})\s*\((\d+)\)/g, ratingIdx: 1, totalIdx: 3 },
        { regex: /([0-5][,.]\d)\s+[★☆*✯✰⭐]{1,5}\s+(\d{2,6})\s*avalia[çc]/i, ratingIdx: 1, totalIdx: 2 },
        { regex: /([0-5][,.]\d)\s+[★☆*✯✰⭐]{1,5}\s+(\d{2,6})\s*review/i, ratingIdx: 1, totalIdx: 2 },
        { regex: /(\d{2,6})\s*avalia[çc][ãa]o/i, ratingIdx: -1, totalIdx: 1 },
        { regex: /(\d{2,6})\s*reviews?/i, ratingIdx: -1, totalIdx: 1 },
    ];
    for (const p of patterns) {
        const match = p.regex.exec(allText);
        if (match) {
            if (p.ratingIdx > 0) { const r = parseFloat(match[p.ratingIdx].replace(',', '.')); if (r >= 0 && r <= 5) rating = r; }
            if (p.totalIdx > 0) { const t = parseInt(match[p.totalIdx], 10); if (t > 0) total = t; }
            if (rating !== null && total !== null) break;
            if (rating !== null) break;
        }
    }
    if (!total) { const m = allText.match(/\(\s*(\d{2,6})\s*\)/); if (m) total = parseInt(m[1], 10); }
    if (!total) { const m = allText.match(/(\d{2,6})\s*(?:avalia[çc]|review|no\s+google)/i); if (m) total = parseInt(m[1], 10); }
    if (!rating) { const ms = allText.match(/\b([0-5][,.]\d)\b/g); if (ms) for (const m of ms) { const r = parseFloat(m.replace(',', '.')); if (r >= 0 && r <= 5) { rating = r; break; } } }
    return { rating, total };
}

export function loadImageFile(file) {
    if (!file) return;
    playSound('assets/voice/voice1.mp3');
    const reader = new FileReader();
    reader.onload = ev => {
        currentBase64Image = ev.target.result;
        currentMimeType = file.type;
        document.getElementById('imagePreview').src = currentBase64Image;
        document.getElementById('imagePreviewContainer').classList.remove('hidden');
        document.getElementById('uploadPlaceholder').classList.add('hidden');
        document.getElementById('imageFileName').textContent = file.name || 'imagem';
        if (window.__currentStore) setTimeout(() => autoExtractFromImage(currentBase64Image), 100);
        else showToast('⚠️ Selecione uma loja primeiro para extrair dados.', 'warn');
    };
    reader.readAsDataURL(file);
}

export function clearImage() {
    currentBase64Image = null;
    currentMimeType = null;
    const imageInput = document.getElementById('imageInput');
    if (imageInput) imageInput.value = '';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    document.getElementById('uploadPlaceholder').classList.remove('hidden');
}

export function extractDataFromImage() {
    if (!currentBase64Image) { showToast('⚠️ Carregue uma imagem primeiro.', 'warn'); return; }
    if (!window.__currentStore) { showToast('⚠️ Selecione uma loja primeiro.', 'warn'); return; }
    autoExtractFromImage(currentBase64Image);
}

export function handleDragOver(e) { e.preventDefault(); document.getElementById('uploadZone').classList.add('drag-over'); }
export function handleDragLeave() { document.getElementById('uploadZone').classList.remove('drag-over'); }
export function handleDrop(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImageFile(file);
}
