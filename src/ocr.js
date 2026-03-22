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

// ═══════════════════════════════════════════════════════════════
// PRÉ-PROCESSAMENTO COM BINARIZAÇÃO POR THRESHOLD
// ═══════════════════════════════════════════════════════════════

function preprocessImageForOCR(base64, threshold = 150) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject('Canvas 2D not available'); return; }
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
                const color = grayscale > threshold ? 255 : 0;
                data[i] = color;
                data[i + 1] = color;
                data[i + 2] = color;
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = base64;
    });
}

async function extrairTextoDaImagem(base64, threshold = 160) {
    const imagemOtimizada = await preprocessImageForOCR(base64, threshold);
    const { data: { text } } = await Tesseract.recognize(imagemOtimizada, 'por');
    return text;
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
            } else if (mode === 'highContrast') {
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    let val = gray;
                    if (gray > 140) val = 255; else if (gray < 60) val = 0; else val = Math.min(255, Math.max(0, ((gray - 128) * 1.6) + 128));
                    data[i] = data[i + 1] = data[i + 2] = val;
                }
            } else if (mode === 'boostContrast') {
                // Modo para textos fracos: binarização adaptativa + gamma
                const gamma = 0.6;
                for (let i = 0; i < data.length; i += 4) {
                    let r = data[i], g = data[i + 1], b = data[i + 2];
                    // Gamma correction para clarear
                    r = Math.pow(r / 255, gamma) * 255;
                    g = Math.pow(g / 255, gamma) * 255;
                    b = Math.pow(b / 255, gamma) * 255;
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    // Binarização agressiva
                    const val = gray > 100 ? 255 : 0;
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
        const modes = ['boostContrast', 'text', 'highContrast'];
        const langs = ['por+eng', 'eng', 'por'];
        let bestResult = { rating: null, total: null };
        let allTexts = [];

        for (const mode of modes) {
            const processedImage = await preprocessForOCR(base64Image, mode);
            for (const lang of langs) {
                try {
                    const worker = await Tesseract.createWorker(lang);
                    const { data } = await worker.recognize(processedImage);
                    await worker.terminate();
                    allTexts.push(data.text);
                    const extracted = extractGoogleRatingData(data);
                    if (extracted.rating && !bestResult.rating) bestResult.rating = extracted.rating;
                    if (extracted.total && !bestResult.total) bestResult.total = extracted.total;
                    if (bestResult.rating && bestResult.total) break;
                } catch (e) { console.error('OCR Erro:', e); }
            }
            if (bestResult.rating && bestResult.total) break;
        }

        // Fallback: tentar na imagem original
        if (!bestResult.rating || !bestResult.total) {
            try {
                const worker = await Tesseract.createWorker('por+eng');
                const { data } = await worker.recognize(base64Image);
                await worker.terminate();
                allTexts.push(data.text);
                const fallback = extractGoogleRatingData(data);
                if (fallback.rating && !bestResult.rating) bestResult.rating = fallback.rating;
                if (fallback.total && !bestResult.total) bestResult.total = fallback.total;
                // Extração inteligente
                const smart = extractWithSmartLogic(data);
                if (smart.rating && !bestResult.rating) bestResult.rating = smart.rating;
                if (smart.total && !bestResult.total) bestResult.total = smart.total;
            } catch (e) { console.error('OCR Fallback Erro:', e); }
        }

        // Camada inteligente em todos os textos coletados
        if ((!bestResult.rating || !bestResult.total) && allTexts.length > 0) {
            for (const txt of allTexts) {
                if (bestResult.rating && bestResult.total) break;
                const smart = extractWithSmartLogic({ text: txt, lines: [{ text: txt }] });
                if (smart.rating && !bestResult.rating) bestResult.rating = smart.rating;
                if (smart.total && !bestResult.total) bestResult.total = smart.total;
            }
        }

        // Camada Google Meu Negócio (regex otimizado)
        if ((!bestResult.rating || !bestResult.total) && allTexts.length > 0) {
            for (const txt of allTexts) {
                if (bestResult.rating && bestResult.total) break;
                const gmn = extrairDadosGoogleMeuNegocio(txt);
                if (gmn.nota && !bestResult.rating) bestResult.rating = gmn.nota;
                if (gmn.totalAvaliacoes && !bestResult.total) bestResult.total = gmn.totalAvaliacoes;
            }
        }

        // Camada binarização por threshold (120, 150, 180)
        if (!bestResult.rating || !bestResult.total) {
            const thresholds = [150, 120, 180];
            for (const th of thresholds) {
                if (bestResult.rating && bestResult.total) break;
                try {
                    const textoTh = await extrairTextoDaImagem(base64Image, th);
                    allTexts.push(textoTh);
                    const extTh = extractGoogleRatingData({ text: textoTh, lines: [{ text: textoTh }] });
                    if (extTh.rating && !bestResult.rating) bestResult.rating = extTh.rating;
                    if (extTh.total && !bestResult.total) bestResult.total = extTh.total;
                    const smartTh = extractWithSmartLogic({ text: textoTh, lines: [{ text: textoTh }] });
                    if (smartTh.rating && !bestResult.rating) bestResult.rating = smartTh.rating;
                    if (smartTh.total && !bestResult.total) bestResult.total = smartTh.total;
                    const gmnTh = extrairDadosGoogleMeuNegocio(textoTh);
                    if (gmnTh.nota && !bestResult.rating) bestResult.rating = gmnTh.nota;
                    if (gmnTh.totalAvaliacoes && !bestResult.total) bestResult.total = gmnTh.totalAvaliacoes;
                } catch (e) { console.error('OCR Threshold Erro:', th, e); }
            }
        }

        // Último fallback: tentar extrair nota dos textos brutos
        if (!bestResult.rating && allTexts.length > 0) {
            for (const txt of allTexts) {
                const nota = extractRatingFromRawText(txt);
                if (nota) { bestResult.rating = nota; break; }
            }
        }

        // Regex bruta: primeiro número no formato nota
        if (!bestResult.rating && allTexts.length > 0) {
            for (const txt of allTexts) {
                const nota = extrairNotaBruta(txt);
                if (nota) { bestResult.rating = nota; break; }
            }
        }

        // Regex bruta: total antes de avaliações
        if (!bestResult.total && allTexts.length > 0) {
            for (const txt of allTexts) {
                const total = extrairTotalBruto(txt);
                if (total) { bestResult.total = total; break; }
            }
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

// ═══════════════════════════════════════════════════════════════
// EXTRAÇÃO GOOGLE MEU NEGÓCIO - Regex otimizado para o formato
// ═══════════════════════════════════════════════════════════════

function extrairDadosGoogleMeuNegocio(textoOcr) {
    if (!textoOcr) return { nota: null, totalAvaliacoes: null };
    const textoNormalizado = textoOcr.replace(/\s+/g, ' ');
    const regexNota = /([1-5][.,]\d)(?=\s*.*\bavalia)/i;
    const regexAvaliacoes = /(\d+)\s*avalia/i;
    const matchNota = textoNormalizado.match(regexNota);
    const matchAvaliacoes = textoNormalizado.match(regexAvaliacoes);
    const notaFinal = matchNota ? parseFloat(matchNota[1].replace(',', '.')) : null;
    const totalAvaliacoesFinal = matchAvaliacoes ? parseInt(matchAvaliacoes[1], 10) : null;
    return { nota: notaFinal, totalAvaliacoes: totalAvaliacoesFinal };
}

// ═══════════════════════════════════════════════════════════════
// REGEX BRUTA - Pega primeiro número no formato nota
// ═══════════════════════════════════════════════════════════════

function extrairNotaBruta(textoOcr) {
    if (!textoOcr) return null;
    const regexNotaBruta = /([1-5][.,][0-9])/;
    const match = textoOcr.match(regexNotaBruta);
    if (match) {
        const nota = parseFloat(match[0].replace(',', '.'));
        if (nota >= 1 && nota <= 5) return nota;
    }
    return null;
}

function extrairTotalBruto(textoOcr) {
    if (!textoOcr) return null;
    const m = textoOcr.match(/(\d{2,6})\s*avalia/i);
    if (m) return parseInt(m[1], 10);
    const m2 = textoOcr.match(/(\d{2,6})\s*review/i);
    if (m2) return parseInt(m2[1], 10);
    return null;
}

function extractWithSmartLogic(ocrData) {
    const { text, lines } = ocrData;
    let rating = null;
    let total = null;

    // ── PASSO 1: Localizar linha de avaliações ──
    let avaliacaoLine = null;
    const lineTexts = (lines || []).map(l => (l.text || '').trim());

    for (const line of lineTexts) {
        const lower = line.toLowerCase();
        if (/avalia[çc]|review|google|estrela|star/.test(lower)) {
            avaliacaoLine = line;
            break;
        }
    }

    // Se não encontrou linha específica, usar texto completo
    const sourceText = avaliacaoLine || text || '';
    const clean = sourceText.replace(/[★☆*✯✰⭐✦✧]/g, '').replace(/\s+/g, ' ').trim();

    // ── PASSO 2: Extrair nota (número entre 1,0 e 5,0) ──
    // Tratar "50" colado como "5,0", "48" como "4,8", etc.
    const notaPatterns = [
        // Formato normal: 5,0 ou 4.8
        /\b([1-5][,.][0-9])\b/,
        // Com espaços: 5 , 0
        /\b([1-5])\s*[,.]\s*([0-9])\b/,
        // Colado sem separador: "50" deve virar "5,0", "48" virar "4,8"
        // Mas só se estiver próximo de palavras-chave
        /(?:avalia|review|google|estrela|nota)[^\d]{0,20}([1-5][0-9])(?:\s|$|[^\d])/i,
        // Invertido: nota após avaliações
        /([1-5][0-9])(?:\s|$|[^\d])[^\d]{0,20}(?:avalia|review|google)/i,
        // OCR com ruído: 5·0, 5-0, 5:0
        /\b([1-5])[,.\-:;]([0-9])\b/,
        // Próximo a estrelas já removidas, mas pode sobrar espaço
        /\b([1-5])\s{1,3}([0-9])\b/,
    ];

    for (const regex of notaPatterns) {
        const match = clean.match(regex);
        if (match) {
            let notaStr;
            if (match[2] && !match[1].includes(',') && !match[1].includes('.')) {
                // Caso "50" colado ou "5 0" com espaço
                notaStr = match[1] + '.' + match[2];
            } else {
                notaStr = match[1].replace(',', '.');
            }
            const nota = parseFloat(notaStr);
            if (!isNaN(nota) && nota >= 1.0 && nota <= 5.0) {
                rating = nota;
                break;
            }
        }
    }

    // ── PASSO 3: Extrair total de avaliações ──
    const totalPatterns = [
        // Padrão principal: número antes de "avaliações"
        /(\d{1,6})\s*avalia[çc]/i,
        // Número antes de "reviews"
        /(\d{1,6})\s*review/i,
        // Número antes de "no/mp/ao Google"
        /(\d{1,6})\s*(?:no|mp|ao|em|de)\s*google/i,
        // Número entre parênteses
        /\((\d{1,6})\)/,
        // Google: número
        /google[:\s]+(\d{1,6})/i,
        // Número grande solto (3+ dígitos)
        /\b(\d{3,6})\b/,
    ];

    for (const regex of totalPatterns) {
        const match = clean.match(regex);
        if (match) {
            const t = parseInt(match[1], 10);
            if (t >= 1 && t <= 999999) {
                total = t;
                break;
            }
        }
    }

    return { rating, total };
}

function extractRatingFromRawText(rawText) {
    if (!rawText) return null;
    const txt = rawText.replace(/\s+/g, ' ').trim();

    // Tentar encontrar padrão: número,virgula ou número.ponto seguido de dígito
    const patterns = [
        // Padrão principal: 5,0 ou 4.8
        /\b([0-5][,.][0-9])\b/,
        // Com espaços: 5 , 0
        /\b([0-5])\s*[,.]\s*([0-9])\b/,
        // OCR confuso: S,0 ou S.O (S parece 5)
        /\b([S5s])[,.]\s*([0-9])\b/,
        // OCR confuso: 4,8 ou 4.8 com ruído
        /\b([0-5])[,.\-:]([0-9])\b/,
        // Próximo a estrelas: ★ 5,0
        /[★☆*✯✰⭐]\s*([0-5][,.][0-9])/,
        // Depois de estrelas: ★★★★★ 5,0
        /[★☆*✯✰⭐]{1,5}\s+([0-5][,.][0-9])/,
        // Antes de estrelas: 5,0 ★★★★★
        /([0-5][,.][0-9])\s+[★☆*✯✰⭐]/,
        // Próximo a "avaliações"
        /([0-5][,.][0-9])[^\d]*avalia/i,
        // Próximo a "reviews"
        /([0-5][,.][0-9])[^\d]*review/i,
    ];

    for (const regex of patterns) {
        const match = txt.match(regex);
        if (match) {
            let notaStr = '';
            if (match[2] && !match[1].includes(',') && !match[1].includes('.')) {
                notaStr = match[1] + '.' + match[2];
            } else {
                notaStr = match[1].replace(',', '.');
            }
            // Corrigir S -> 5
            notaStr = notaStr.replace(/[Ss]/g, '5');
            const nota = parseFloat(notaStr);
            if (!isNaN(nota) && nota >= 1 && nota <= 5) return nota;
        }
    }

    // Fallback final: procurar qualquer número 1-5 seguido de vírgula/ponto e dígito
    const allMatches = txt.match(/\b([1-5])\s*[,.]\s*([0-9])\b/g);
    if (allMatches) {
        for (const m of allMatches) {
            const nota = parseFloat(m.replace(',', '.').replace(/\s/g, ''));
            if (nota >= 1 && nota <= 5) return nota;
        }
    }

    return null;
}

function extractGoogleRatingData(ocrData) {
    const { text, lines, words } = ocrData;
    let rating = null, total = null;
    const allText = text.replace(/\s+/g, ' ').trim();

    const patterns = [
        // ── NOTA + ESTRELAS + TOTAL ──
        // 5,0 ★★ 793 avaliações mp Google
        { regex: /([0-5][,.]\d)\s*[★☆*✯✰⭐]{1,5}\s+(\d{2,6})\s*avalia[çc]/i, ratingIdx: 1, totalIdx: 2 },
        // 4.8 ★★ 793 reviews
        { regex: /([0-5][,.]\d)\s*[★☆*✯✰⭐]{1,5}\s+(\d{2,6})\s*review/i, ratingIdx: 1, totalIdx: 2 },
        // 4.8 ★★ 793 no Google
        { regex: /([0-5][,.]\d)\s*[★☆*✯✰⭐]{1,5}\s+(\d{2,6})\s*(?:no|mp|ao|em)\s*google/i, ratingIdx: 1, totalIdx: 2 },

        // ── NOTA + TOTAL (sem estrelas) ──
        // 4.8 (393)
        { regex: /([0-5][,.]\d)\s*\((\d{2,6})\)/g, ratingIdx: 1, totalIdx: 2 },
        // 4.8 393 avaliações
        { regex: /([0-5][,.]\d)\s+(\d{2,6})\s*avalia[çc]/i, ratingIdx: 1, totalIdx: 2 },
        // 4.8 393 reviews
        { regex: /([0-5][,.]\d)\s+(\d{2,6})\s*review/i, ratingIdx: 1, totalIdx: 2 },
        // 4.8 · 393 avaliações
        { regex: /([0-5][,.]\d)\s*[·•]\s*(\d{2,6})\s*avalia[çc]/i, ratingIdx: 1, totalIdx: 2 },

        // ── NOTA + ESTRELAS (sem total) ──
        // 4,9 ★★★★★
        { regex: /([0-5][,.]\d)\s*[★☆*✯✰⭐]{1,5}/g, ratingIdx: 1, totalIdx: -1 },
        // ★★★★★ 4.9
        { regex: /[★☆*✯✰⭐]{1,5}\s*([0-5][,.]\d)/g, ratingIdx: 1, totalIdx: -1 },

        // ── SÓ TOTAL ──
        // 393 avaliações
        { regex: /(\d{2,6})\s*avalia[çc][õo]e?s?/i, ratingIdx: -1, totalIdx: 1 },
        // 393 reviews
        { regex: /(\d{2,6})\s*reviews?/i, ratingIdx: -1, totalIdx: 1 },
        // 393 no Google / mp Google / ao Google
        { regex: /(\d{2,6})\s*(?:no|mp|ao|em|de)\s*google/i, ratingIdx: -1, totalIdx: 1 },
        // Google: 393
        { regex: /google[:\s]+(\d{2,6})/i, ratingIdx: -1, totalIdx: 1 },

        // ── FORMATO INVERTIDO ──
        // 793 avaliações Google ★★ 5,0
        { regex: /(\d{2,6})\s*avalia[çc][^\d]*([0-5][,.]\d)/i, ratingIdx: 2, totalIdx: 1 },
        // 793 reviews Google 4.8
        { regex: /(\d{2,6})\s*review[^\d]*([0-5][,.]\d)/i, ratingIdx: 2, totalIdx: 1 },

        // ── FORMATO GOOGLE MAPS ──
        // Google Maps 4.8 (793)
        { regex: /google\s*maps?\s*([0-5][,.]\d)\s*\((\d{2,6})\)/i, ratingIdx: 1, totalIdx: 2 },
        // 4.8 estrelas · 793 avaliações
        { regex: /([0-5][,.]\d)\s*estrela[^\d]*(\d{2,6})\s*avalia[çc]/i, ratingIdx: 1, totalIdx: 2 },
        // 4.8 stars · 793 reviews
        { regex: /([0-5][,.]\d)\s*star[^\d]*(\d{2,6})\s*review/i, ratingIdx: 1, totalIdx: 2 },
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

    // ── FALLBACKS ──
    // Número entre parênteses
    if (!total) { const m = allText.match(/\(\s*(\d{2,6})\s*\)/); if (m) total = parseInt(m[1], 10); }
    // Número antes de avaliações/reviews/google
    if (!total) { const m = allText.match(/(\d{2,6})\s*(?:avalia[çc]|review|no\s+google|mp\s+google)/i); if (m) total = parseInt(m[1], 10); }
    // Nota solta (formato 4,8 ou 4.8)
    if (!rating) { const ms = allText.match(/\b([0-5][,.]\d)\b/g); if (ms) for (const m of ms) { const r = parseFloat(m.replace(',', '.')); if (r >= 0 && r <= 5) { rating = r; break; } } }
    // Número grande solto (provavelmente total de avaliações)
    if (!total) { const ms = allText.match(/\b(\d{3,6})\b/g); if (ms) for (const m of ms) { const t = parseInt(m, 10); if (t >= 10 && t <= 999999) { total = t; break; } } }

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

// ═══════════════════════════════════════════════════════════════
// CLIPBOARD - Extrair dados copiados do Google Maps
// ═══════════════════════════════════════════════════════════════

export async function extractFromClipboard() {
    try {
        const texto = await navigator.clipboard.readText();
        if (!texto || texto.trim().length === 0) {
            showToast('⚠️ Nenhum texto encontrado na área de transferência.', 'warn');
            return;
        }

        // Aplicar todos os extratores no texto copiado
        const smart = extractWithSmartLogic({ text: texto, lines: [{ text: texto }] });
        const gmn = extrairDadosGoogleMeuNegocio(texto);
        const raw = extractRatingFromRawText(texto);

        let rating = smart.rating || gmn.nota || raw || null;
        let total = smart.total || gmn.totalAvaliacoes || null;

        // Fallback: buscar total no texto
        if (!total) {
            const m = texto.match(/(\d{1,6})\s*avalia/i);
            if (m) total = parseInt(m[1], 10);
        }
        if (!total) {
            const m = texto.match(/(\d{1,6})\s*review/i);
            if (m) total = parseInt(m[1], 10);
        }

        const totalInput = document.getElementById('totalInput');
        const ratingInput = document.getElementById('ratingInput');
        let filled = 0;

        if (total !== null && total > 0) {
            totalInput.value = total;
            totalInput.classList.add('ring-2', 'ring-green-400');
            setTimeout(() => totalInput.classList.remove('ring-2', 'ring-green-400'), 2500);
            filled++;
        }
        if (rating !== null && rating >= 1 && rating <= 5) {
            ratingInput.value = rating;
            ratingInput.classList.add('ring-2', 'ring-green-400');
            setTimeout(() => ratingInput.classList.remove('ring-2', 'ring-green-400'), 2500);
            filled++;
        }

        if (filled > 0) {
            playSound('assets/voice/voice2.mp3');
            showToast(`✅ Clipboard extraiu ${filled} dado(s)! Nota: ${rating || '?'} | Total: ${total || '?'}`, 'success');
        } else {
            showToast('⚠️ Não foi possível extrair dados do texto copiado.', 'warn');
        }
    } catch (err) {
        console.error('Clipboard erro:', err);
        showToast('❌ Erro ao ler clipboard. Permita o acesso.', 'error');
    }
}
