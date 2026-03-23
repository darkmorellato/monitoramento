// ═══════════════════════════════════════════════════════════════
// OCR - Lazy Tesseract.js, Image Processing, Data Extraction
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui.js';

export let currentBase64Image = null;
export let currentMimeType = null;
let tesseractLoaded = false;

// ── WORKER CACHE ─────────────────────────────────────────────
// Workers Tesseract são caros de criar (carregam WASM + dados de treino).
// Reutilizá-los reduz drasticamente o tempo de OCR a partir da 2ª imagem.
const _workers = {};

async function getWorker(lang, paramsKey = null, params = null) {
    const cacheKey = paramsKey ? `${lang}_${paramsKey}` : lang;
    if (!_workers[cacheKey]) {
        _workers[cacheKey] = await Tesseract.createWorker(lang);
        if (params) await _workers[cacheKey].setParameters(params);
    }
    return _workers[cacheKey];
}

function playSound(src) {
    try {
        const audio = new Audio(src);
        audio.volume = 0.8;
        audio.play().catch(() => {});
    } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// PRÉ-PROCESSAMENTO - Recorte focado na linha de avaliação
// ═══════════════════════════════════════════════════════════════

function cropRatingLine(base64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64); return; }

            const w = img.width;
            const h = img.height;

            // A linha de avaliação geralmente fica nos primeiros 40% da imagem
            // (logo abaixo do nome da loja)
            const cropY = Math.round(h * 0.05);
            const cropH = Math.round(h * 0.45);
            const cropX = 0;
            const cropW = w;

            canvas.width = cropW;
            canvas.height = cropH;
            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

function preprocessForRatingOCR(base64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64); return; }

            // Ampliar 2x para melhor OCR
            const scale = 2;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Binarização forte + contraste máximo
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                // Binarização agressiva para texto preto em fundo branco
                if (gray < 180) {
                    data[i] = data[i + 1] = data[i + 2] = 0;
                } else {
                    data[i] = data[i + 1] = data[i + 2] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
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

// Amplia 3x e binariza forte — para extrair "(N)" com máxima precisão
function upscaleForParens(base64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64); return; }
            const scale = 3;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const v = gray < 160 ? 0 : 255;
                data[i] = data[i + 1] = data[i + 2] = v;
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

async function extrairTextoDaImagem(base64, threshold = 160) {
    const imagemOtimizada = await preprocessImageForOCR(base64, threshold);
    const worker = await getWorker('por');
    const { data: { text } } = await worker.recognize(imagemOtimizada);
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
        script.onerror = () => reject(new Error('Falha ao carregar Tesseract.js da CDN'));
        document.head.appendChild(script);
        // Timeout de 20s: se a CDN travar, não fica esperando indefinidamente
        setTimeout(() => reject(new Error('Timeout ao carregar Tesseract.js (CDN lenta ou offline)')), 20000);
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

        // ═══ CAMADA 0a: OCR completo com langs — usa extractRatingLine como PRIORIDADE ═══
        try {
            const worker = await getWorker('por+eng');
            const { data } = await worker.recognize(base64Image);
            allTexts.push(data.text);
            // Prioridade máxima: extração da linha "X,Y ⭐⭐⭐⭐⭐ (N)"
            const line = extractRatingLine(data.text);
            if (line.rating !== null && !bestResult.rating) bestResult.rating = line.rating;
            if (line.total !== null && !bestResult.total) bestResult.total = line.total;
        } catch (e) { console.error('OCR Camada 0a Erro:', e); }

        // ═══ CAMADA 0b: Região da nota ampliada (3x) com whitelist para (N) ═══
        try {
            const upscaled = await upscaleForParens(base64Image);
            const workerP = await getWorker('eng', 'nums', { tessedit_char_whitelist: '0123456789()[],.* ' });
            const { data: dataP } = await workerP.recognize(upscaled);
            allTexts.push(dataP.text);
            const line = extractRatingLine(dataP.text);
            if (line.rating !== null && !bestResult.rating) bestResult.rating = line.rating;
            if (line.total !== null && !bestResult.total) bestResult.total = line.total;
            // Fallback: apenas parênteses
            if (!bestResult.total) {
                const parenMatch = dataP.text.match(/[\(\[]\s*(\d{2,6})\s*[\)\]]?/);
                if (parenMatch) {
                    const t = parseInt(parenMatch[1], 10);
                    if (t >= 10 && t < 100000) bestResult.total = t;
                }
            }
        } catch (e) { console.error('OCR Camada 0b Erro:', e); }

        // ═══ CAMADA 0c: Crop da linha de avaliação + preprocessamento binarizado ═══
        try {
            const cropped = await cropRatingLine(base64Image);
            const processedRating = await preprocessForRatingOCR(cropped);
            const worker = await getWorker('por+eng');
            const { data } = await worker.recognize(processedRating);
            allTexts.push(data.text);
            const line = extractRatingLine(data.text);
            if (line.rating !== null && !bestResult.rating) bestResult.rating = line.rating;
            if (line.total !== null && !bestResult.total) bestResult.total = line.total;
            const ratingDirect = extractDirectPattern(data.text);
            if (ratingDirect.rating !== null && !bestResult.rating) bestResult.rating = ratingDirect.rating;
            if (ratingDirect.total !== null && !bestResult.total) bestResult.total = ratingDirect.total;
        } catch (e) { console.error('OCR Camada 0c Erro:', e); }

        // Se já tem ambos os dados, pular outras camadas
        if (!bestResult.rating || !bestResult.total) {

        for (const mode of modes) {
            const processedImage = await preprocessForOCR(base64Image, mode);
            for (const lang of langs) {
                try {
                    const worker = await getWorker(lang);
                    const { data } = await worker.recognize(processedImage);
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
                const worker = await getWorker('por+eng');
                const { data } = await worker.recognize(base64Image);
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

        } // fecha if (!bestResult.rating || !bestResult.total)

        // ═══ OVERRIDE: Lojas Premium e Kassouf usam apenas número entre parênteses ═══
        const _storeId = window.__currentStore && window.__currentStore.id;
        if (['premium', 'kassouf'].includes(_storeId)) {
            let totalParens = null;

            const parenPatterns = [
                /\(\s*(\d{2,6})\s*\)/,          // (558) — exato
                /\[\s*(\d{2,6})\s*\]/,          // [558] — OCR troca ( por [
                /\|\s*(\d{2,6})\s*\|/,          // |558| — OCR troca ( por |
                /\{\s*(\d{2,6})\s*\}/,          // {558}
                /\(\s*(\d{2,5})\s*0(?!\d)/,     // (5580 — ) lido como 0
                /\(\s*(\d{2,6})\s*(?=\s|$|\D)/, // (558 sem fechar
            ];

            // Camada 1: buscar nos textos já coletados
            for (const txt of allTexts) {
                if (totalParens) break;
                for (const regex of parenPatterns) {
                    const m = txt.match(regex);
                    if (m) { const t = parseInt(m[1], 10); if (t >= 10 && t < 100000) { totalParens = t; break; } }
                }
            }

            // Camada 2: OCR dedicado com whitelist correta via setParameters (Tesseract.js v5)
            if (!totalParens) {
                try {
                    const workerP = await getWorker('eng', 'parens', { tessedit_char_whitelist: '0123456789()[]' });
                    const { data: dataP } = await workerP.recognize(base64Image);
                    allTexts.push(dataP.text);
                    for (const regex of parenPatterns) {
                        const m = dataP.text.match(regex);
                        if (m) { const t = parseInt(m[1], 10); if (t >= 10 && t < 100000) { totalParens = t; break; } }
                    }
                } catch (e) { console.error('OCR whitelist erro:', e); }
            }

            // Camada 3: qualquer número isolado de 3-4 dígitos após o rating (ex: "5,0 ... 558")
            if (!totalParens) {
                for (const txt of allTexts) {
                    if (totalParens) break;
                    const clean = txt.replace(/\s+/g, ' ');
                    // Procurar número 3-6 dígitos que não seja ano e não seja o rating×10
                    const nums = clean.match(/\b(\d{3,6})\b/g) || [];
                    for (const n of nums) {
                        const v = parseInt(n, 10);
                        const isYear = v >= 1900 && v <= 2099;
                        const isRatingX10 = bestResult.rating && v === Math.round(bestResult.rating * 10);
                        if (!isYear && !isRatingX10 && v >= 10 && v < 100000) {
                            totalParens = v;
                            break;
                        }
                    }
                }
            }

            if (totalParens !== null) bestResult.total = totalParens;
        }

        const totalInput = document.getElementById('totalInput');
        const ratingInput = document.getElementById('ratingInput');
        let filled = 0;
        if (bestResult.total !== null && bestResult.total > 0) { totalInput.value = bestResult.total; totalInput.classList.add('ring-2', 'ring-green-400'); setTimeout(() => totalInput.classList.remove('ring-2', 'ring-green-400'), 2500); filled++; }
        if (bestResult.rating !== null && bestResult.rating >= 0 && bestResult.rating <= 5) {
            ratingInput.value = bestResult.rating.toFixed(1);
            ratingInput.classList.add('ring-2', 'ring-green-400');
            setTimeout(() => ratingInput.classList.remove('ring-2', 'ring-green-400'), 2500);
            filled++;
        }
        if (filled > 0) {
            playSound('assets/voice/voice2.mp3');
            showToast(`✅ OCR extraiu ${filled} dado(s)! Nota: ${bestResult.rating || '?'} | Total: ${bestResult.total || '?'}`, 'success');
        } else showToast('⚠️ Não foi possível extrair dados. Insira manualmente.', 'warn');
    } catch (e) { console.error('OCR Erro fatal:', e); showToast('❌ Erro no OCR: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZAÇÃO DE RUÍDO OCR - Limpa caracteres de estrelas
// ═══════════════════════════════════════════════════════════════

function normalizeOcrNoise(text) {
    if (!text) return '';
    return text
        // Emoji de estrela (⭐ U+2B50, 🌟, etc.) — OCR pode manter ou converter
        .replace(/[\u2B50\u{1F31F}\u{1F4AB}\u{2728}]/gu, '★')
        // Símbolos de estrela tipográficos
        .replace(/[★☆✯✰✦✧⋆✶✷✸✹✺❋❉❊✿❀⚜⚑⛝]/g, '★')
        // Asterisco isolado (OCR comum para estrelas)
        .replace(/(?<!\d)\*(?!\d)/g, '★')
        .replace(/[•·∙⋅◦●○◉◎⦁⦾]/g, '·');
}

function collapseStars(text) {
    if (!text) return '';
    // Converte sequências de ★ em uma única estrela para matching
    return text.replace(/★{1,10}/g, '★');
}

// ═══════════════════════════════════════════════════════════════
// EXTRAÇÃO PRIMÁRIA — Linha "X,Y ⭐⭐⭐⭐⭐ (N)"
// Lógica: encontrar a linha que contém AMBOS nota decimal E (N)
// Aplicada para TODAS as lojas, antes de qualquer outro método
// ═══════════════════════════════════════════════════════════════

function extractRatingLine(text) {
    if (!text) return { rating: null, total: null };

    const lines = text.split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // ── Extrair nota: número no formato X,Y ou X.Y onde X é 0-5 ──
        const ratingMatch = line.match(/\b([0-5][,.]([0-9]))\b/);
        if (!ratingMatch) continue;
        const rating = parseFloat(ratingMatch[1].replace(',', '.'));
        if (rating < 0 || rating > 5) continue;

        // ── Extrair total: número em parênteses (formas completas e parciais) ──
        let total = null;

        // (404) — parênteses exatos
        const exactParen = line.match(/\(\s*(\d{2,6})\s*\)/);
        if (exactParen) total = parseInt(exactParen[1], 10);

        // [404] ou {404} — OCR troca parênteses por colchetes/chaves
        if (!total) {
            const altBracket = line.match(/[\[\{]\s*(\d{2,6})\s*[\]\}]/);
            if (altBracket) total = parseInt(altBracket[1], 10);
        }

        // (404  ou  (4040  — parêntese sem fechamento, ou ) lido como 0
        if (!total) {
            const openParen = line.match(/\(\s*(\d{2,5})\s*0?(?=\s|$|\D)/);
            if (openParen) {
                const v = parseInt(openParen[1], 10);
                if (v >= 10) total = v;
            }
        }

        if (total && total > 0) return { rating, total };

        // Linha tem nota E estrelas mas parênteses ilegível — retornar só nota
        const hasStars = /[★⭐*]{1,5}/.test(line);
        if (hasStars) return { rating, total: null };
    }

    return { rating: null, total: null };
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
// EXTRAÇÃO DIRETA - Padrão específico "5,0 ★★★★★ (793)"
// ═══════════════════════════════════════════════════════════════

function extractDirectPattern(rawText) {
    if (!rawText) return { rating: null, total: null };

    const normalized = normalizeOcrNoise(rawText);
    const collapsed = collapseStars(normalized);

    // Padrão EXATO: nota + estrelas + parênteses com total
    // Ex: "5,0 ★★★★★ (793)" ou "4,9 ★★ (793)"
    const directPatterns = [
        // Formato completo: nota ★ (total)
        { regex: /([0-5][,.][0-9])\s*★\s*\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
        // Formato completo com espaços extras
        { regex: /([0-5][,.][0-9])\s+★\s+\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
        // OCR com ruído: nota + lixo + parênteses
        { regex: /([0-5][,.][0-9])\s*[^\d(]{1,30}\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
        // Nota grudada em estrela: "5,0★(793)"
        { regex: /([0-5][,.][0-9])★\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
        // OCR pode ler "4,9 ★★★ ★★ (793)" com espaços variados
        { regex: /([0-5][,.][0-9])\s+★[\s★]*\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
    ];

    for (const p of directPatterns) {
        const m = collapsed.match(p.regex);
        if (m) {
            const r = parseFloat(m[p.rIdx].replace(',', '.'));
            const t = parseInt(m[p.tIdx], 10);
            if (r >= 0 && r <= 5 && t > 0) return { rating: r, total: t };
        }
    }

    return { rating: null, total: null };
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

    // Normalizar ruído de estrelas
    const normalized = normalizeOcrNoise(text || '');
    const collapsed = collapseStars(normalized);

    // ── PRIORIDADE 0: Padrão direto "nota ★ (total)" ──
    const direct = extractDirectPattern(text);
    if (direct.rating !== null) rating = direct.rating;
    if (direct.total !== null) total = direct.total;
    if (rating !== null && total !== null) return { rating, total };

    // ── PASSO 1: Localizar linha de avaliações ──
    let avaliacaoLine = null;
    const lineTexts = (lines || []).map(l => {
        const t = (l.text || '').trim();
        return collapseStars(normalizeOcrNoise(t));
    });

    for (const line of lineTexts) {
        const lower = line.toLowerCase();
        if (/avalia[çc]|review|google|estrela|star|★/.test(lower)) {
            avaliacaoLine = line;
            break;
        }
    }

    // Se não encontrou linha específica, usar texto completo normalizado
    const sourceText = avaliacaoLine || collapsed || '';
    const clean = sourceText.replace(/★/g, '').replace(/\s+/g, ' ').trim();

    // ── PASSO 2: Extrair nota ──
    // Primeiro tentar do collapsed com estrelas intactas
    if (!rating) {
        const starMatch = collapsed.match(/([0-5][,.][0-9])\s*★/);
        if (starMatch) {
            rating = parseFloat(starMatch[1].replace(',', '.'));
        }
    }

    // Depois tentar padrões limpos
    const notaPatterns = [
        /\b([0-5][,.][0-9])\b/,
        /\b([0-5])\s*[,.]\s*([0-9])\b/,
        /[★]\s*([0-5][,.][0-9])/,
        /([0-5][,.][0-9])\s*[★]/,
    ];

    for (const regex of notaPatterns) {
        if (rating !== null) break;
        const match = clean.match(regex);
        if (match) {
            let notaStr;
            if (match[2] && !match[1].includes(',') && !match[1].includes('.')) {
                notaStr = match[1] + '.' + match[2];
            } else {
                notaStr = match[1].replace(',', '.');
            }
            const nota = parseFloat(notaStr);
            if (!isNaN(nota) && nota >= 0 && nota <= 5.0) {
                rating = nota;
                break;
            }
        }
    }

    // ── PASSO 3: Extrair total de avaliações ──
    // Prioridade: número entre parênteses
    if (!total) {
        const parenMatch = sourceText.match(/\(\s*(\d{1,6})\s*\)/);
        if (parenMatch) total = parseInt(parenMatch[1], 10);
    }

    const totalPatterns = [
        /(\d{1,6})\s*avalia[çc]/i,
        /(\d{1,6})\s*review/i,
        /(\d{1,6})\s*(?:no|mp|ao|em|de)\s*google/i,
        /★\s*\((\d{1,6})\)/,
        /\(\s*(\d{1,6})\s*\)/,
        /google[:\s]+(\d{1,6})/i,
        /\b(\d{3,6})\b/,
    ];

    for (const regex of totalPatterns) {
        if (total !== null) break;
        const match = sourceText.match(regex);
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
    const normalized = normalizeOcrNoise(rawText);
    const collapsed = collapseStars(normalized);
    const txt = collapsed.replace(/\s+/g, ' ').trim();

    // Tentar encontrar padrão: nota ★ (total)
    const direct = extractDirectPattern(rawText);
    if (direct.rating !== null) return direct.rating;

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
        /★\s*([0-5][,.][0-9])/,
        // Depois de estrelas: ★★★★★ 5,0
        /★+\s+([0-5][,.][0-9])/,
        // Antes de estrelas: 5,0 ★★★★★
        /([0-5][,.][0-9])\s+★/,
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
            if (!isNaN(nota) && nota >= 0 && nota <= 5) return nota;
        }
    }

    // Fallback final: procurar qualquer número 0-5 seguido de vírgula/ponto e dígito
    const allMatches = txt.match(/\b([0-5])\s*[,.]\s*([0-9])\b/g);
    if (allMatches) {
        for (const m of allMatches) {
            const nota = parseFloat(m.replace(',', '.').replace(/\s/g, ''));
            if (nota >= 0 && nota <= 5) return nota;
        }
    }

    return null;
}

function extractGoogleRatingData(ocrData) {
    const { text, lines, words } = ocrData;
    let rating = null, total = null;
    const rawText = text || '';
    const normalized = normalizeOcrNoise(rawText);
    const collapsed = collapseStars(normalized);
    const allText = rawText.replace(/\s+/g, ' ').trim();
    const cleanCollapsed = collapsed.replace(/\s+/g, ' ').trim();

    // ═══ PRIORIDADE 0: Linha "X,Y ⭐⭐⭐⭐⭐ (N)" — padrão primário ═══
    const lineResult = extractRatingLine(rawText);
    if (lineResult.rating !== null) rating = lineResult.rating;
    if (lineResult.total !== null) total = lineResult.total;
    if (rating !== null && total !== null) return { rating, total };

    // ═══ PRIORIDADE 1: Padrão exato "nota ★ (total)" (texto normalizado) ═══
    const lineNorm = extractRatingLine(normalized);
    if (lineNorm.rating !== null && !rating) rating = lineNorm.rating;
    if (lineNorm.total !== null && !total) total = lineNorm.total;
    if (rating !== null && total !== null) return { rating, total };

    const direct = extractDirectPattern(rawText);
    if (direct.rating !== null && !rating) rating = direct.rating;
    if (direct.total !== null && !total) total = direct.total;
    if (rating !== null && total !== null) return { rating, total };

    // ═══ PRIORIDADE 2: Regex com normalização ═══
    const patterns = [
        // ── PADRÃO PRINCIPAL: nota + estrelas + (total) ──
        // 5,0 ★ (793) - após collapseStars
        { regex: /([0-5][,.][0-9])\s*★\s*\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
        // 4.9 ★★ (793)
        { regex: /([0-5][,.][0-9])\s+★\s*\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
        // Nota + ruído estrelas + (total)
        { regex: /([0-5][,.][0-9])\s*[^\d(]{1,25}\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },

        // ── NOTA + ESTRELAS + TOTAL (sem parênteses) ──
        // 5,0 ★★ 793 avaliações mp Google
        { regex: /([0-5][,.][0-9])\s*★+\s*(\d{2,6})\s*avalia[çc]/i, rIdx: 1, tIdx: 2 },
        // 4.8 ★★ 793 reviews
        { regex: /([0-5][,.][0-9])\s*★+\s*(\d{2,6})\s*review/i, rIdx: 1, tIdx: 2 },
        // 4.8 ★★ 793 no Google
        { regex: /([0-5][,.][0-9])\s*★+\s*(\d{2,6})\s*(?:no|mp|ao|em)\s*google/i, rIdx: 1, tIdx: 2 },

        // ── NOTA + TOTAL (sem estrelas, com parênteses) ──
        // 4.8 (393)
        { regex: /([0-5][,.][0-9])\s*\((\d{1,6})\)/, rIdx: 1, tIdx: 2 },
        // 4.8 393 avaliações
        { regex: /([0-5][,.][0-9])\s+(\d{2,6})\s*avalia[çc]/i, rIdx: 1, tIdx: 2 },
        // 4.8 393 reviews
        { regex: /([0-5][,.][0-9])\s+(\d{2,6})\s*review/i, rIdx: 1, tIdx: 2 },
        // 4.8 · 393 avaliações
        { regex: /([0-5][,.][0-9])\s*[·•]\s*(\d{2,6})\s*avalia[çc]/i, rIdx: 1, tIdx: 2 },

        // ── NOTA + ESTRELAS (sem total) ──
        // 4,9 ★★★★★
        { regex: /([0-5][,.][0-9])\s*★+/, rIdx: 1, tIdx: -1 },
        // ★★★★★ 4.9
        { regex: /★+\s*([0-5][,.][0-9])/, rIdx: 1, tIdx: -1 },

        // ── SÓ TOTAL ──
        // 393 avaliações
        { regex: /(\d{1,6})\s*avalia[çc][õo]e?s?/i, rIdx: -1, tIdx: 1 },
        // 393 reviews
        { regex: /(\d{1,6})\s*reviews?/i, rIdx: -1, tIdx: 1 },
        // 393 no Google / mp Google / ao Google
        { regex: /(\d{1,6})\s*(?:no|mp|ao|em|de)\s*google/i, rIdx: -1, tIdx: 1 },

        // ── FORMATO INVERTIDO ──
        // 793 avaliações Google ★★ 5,0
        { regex: /(\d{2,6})\s*avalia[çc][^\d]*([0-5][,.][0-9])/i, rIdx: 2, tIdx: 1 },
        // 793 reviews Google 4.8
        { regex: /(\d{2,6})\s*review[^\d]*([0-5][,.][0-9])/i, rIdx: 2, tIdx: 1 },

        // ── FORMATO GOOGLE MAPS ──
        // Google Maps 4.8 (793)
        { regex: /google\s*maps?\s*([0-5][,.][0-9])\s*\((\d{1,6})\)/i, rIdx: 1, tIdx: 2 },
        // 4.8 estrelas · 793 avaliações
        { regex: /([0-5][,.][0-9])\s*estrela[^\d]*(\d{2,6})\s*avalia[çc]/i, rIdx: 1, tIdx: 2 },
        // 4.8 stars · 793 reviews
        { regex: /([0-5][,.][0-9])\s*star[^\d]*(\d{2,6})\s*review/i, rIdx: 1, tIdx: 2 },
    ];

    for (const p of patterns) {
        if (rating !== null && total !== null) break;
        const match = p.regex.exec(cleanCollapsed);
        if (match) {
            if (p.rIdx > 0 && rating === null) {
                const r = parseFloat(match[p.rIdx].replace(',', '.'));
                if (r >= 0 && r <= 5) rating = r;
            }
            if (p.tIdx > 0 && total === null) {
                const t = parseInt(match[p.tIdx], 10);
                if (t > 0) total = t;
            }
            if (rating !== null && total !== null) break;
        }
    }

    // ═══ FALLBACKS AGRESSIVOS ═══

    // Fallback 1: número entre parênteses (formato mais comum)
    if (!total) {
        const m = cleanCollapsed.match(/\(\s*(\d{1,6})\s*\)/);
        if (m) total = parseInt(m[1], 10);
    }

    // Fallback 2: nota no formato "X,Y" ou "X.Y" isolada
    if (!rating) {
        const ms = cleanCollapsed.match(/\b([0-5][,.][0-9])\b/g);
        if (ms) {
            for (const m of ms) {
                const r = parseFloat(m.replace(',', '.'));
                if (r >= 0 && r <= 5) { rating = r; break; }
            }
        }
    }

    // Fallback 3: número antes de avaliações/reviews/google
    if (!total) {
        const m = cleanCollapsed.match(/(\d{2,6})\s*(?:avalia[çc]|review|no\s+google|mp\s+google)/i);
        if (m) total = parseInt(m[1], 10);
    }

    // Fallback 4: número grande solto (provavelmente total de avaliações)
    if (!total) {
        const ms = cleanCollapsed.match(/\b(\d{3,6})\b/g);
        if (ms) {
            for (const m of ms) {
                const t = parseInt(m, 10);
                if (t >= 10 && t <= 999999) { total = t; break; }
            }
        }
    }

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
