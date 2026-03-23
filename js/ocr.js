// ═══════════════════════════════════════════════════════════════
// OCR - Tesseract.js, Image Processing, Data Extraction
// ═══════════════════════════════════════════════════════════════

window.currentBase64Image = null;
window.currentMimeType = null;

async function preprocessForOCR(base64, mode = 'text') {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            let w = img.width, h = img.height;
            const maxDim = mode === 'text' ? 2000 : 1800;
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }

            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;

            if (mode === 'text') {
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const brightness = (r + g + b) / 3;
                    if (brightness > 200) {
                        data[i] = data[i + 1] = data[i + 2] = 255;
                    } else if (brightness < 80) {
                        data[i] = data[i + 1] = data[i + 2] = 0;
                    } else {
                        const val = Math.min(255, Math.max(0, ((brightness - 128) * 1.8) + 128));
                        data[i] = data[i + 1] = data[i + 2] = val;
                    }
                }
            } else {
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    let val = gray;
                    if (gray > 140) val = 255;
                    else if (gray < 60) val = 0;
                    else val = Math.min(255, Math.max(0, ((gray - 128) * 1.6) + 128));
                    data[i] = data[i + 1] = data[i + 2] = val;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = base64;
    });
}

async function autoExtractFromImage(base64Image) {
    if (!base64Image) return;
    if (typeof Tesseract === 'undefined') {
        showToast('❌ Tesseract.js não carregou. Recarregue a página.', 'error');
        return;
    }

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
                } catch (e) {
                    console.error('OCR Erro:', e);
                }
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
            } catch (e) {
                console.error('OCR Fallback Erro:', e);
            }
        }

        const totalInput = document.getElementById('totalInput');
        const ratingInput = document.getElementById('ratingInput');
        let filled = 0;

        if (bestResult.total !== null && bestResult.total > 0) {
            totalInput.value = bestResult.total;
            totalInput.classList.add('ring-2', 'ring-green-400');
            setTimeout(() => totalInput.classList.remove('ring-2', 'ring-green-400'), 2500);
            filled++;
        }
        if (bestResult.rating !== null && bestResult.rating >= 0 && bestResult.rating <= 5) {
            ratingInput.value = bestResult.rating;
            ratingInput.classList.add('ring-2', 'ring-green-400');
            setTimeout(() => ratingInput.classList.remove('ring-2', 'ring-green-400'), 2500);
            filled++;
        }

        if (filled > 0) {
            showToast(`✅ OCR extraiu ${filled} dado(s)! Nota: ${bestResult.rating || '?'} | Total: ${bestResult.total || '?'}`, 'success');
        } else {
            showToast('⚠️ Não foi possível extrair dados. Insira manualmente.', 'warn');
        }
    } catch (e) {
        console.error('OCR Erro fatal:', e);
        showToast('❌ Erro no OCR: ' + e.message, 'error');
    }
}

function extractGoogleRatingData(ocrData) {
    const { text, lines, words } = ocrData;
    let rating = null;
    let total = null;

    const allText = text.replace(/\s+/g, ' ').trim();
    const starSymbols = ['★', '☆', '*', '✯', '✰', '⭐'];

    const patterns = [
        { regex: /([0-5][,.]\d)\s*([★☆*✯✰⭐]{1,5})/g, ratingIdx: 1, totalIdx: -1 },
        { regex: /([0-5][,.]\d)\s*\((\d+)\)/g, ratingIdx: 1, totalIdx: 2 },
        { regex: /([0-5][,.]\d)\s+([★☆*✯✰⭐]{1,5})\s*\((\d+)\)/g, ratingIdx: 1, totalIdx: 3 },
        { regex: /([0-5][,.]\d)\s+(\d+)\s+\((\d+)\)/g, ratingIdx: 1, totalIdx: 3 },
        { regex: /\((\d+)\)\s*([★☆*✯✰⭐]{1,5})\s*([0-5][,.]\d)/g, ratingIdx: 3, totalIdx: 1 },
        { regex: /Google[^\d]*([0-5][,.]\d)/gi, ratingIdx: 1, totalIdx: -1 },
        { regex: /rating[^\d]*([0-5][,.]\d)/gi, ratingIdx: 1, totalIdx: -1 },
        { regex: /nota[^\d]*([0-5][,.]\d)/gi, ratingIdx: 1, totalIdx: -1 },
    ];

    for (const p of patterns) {
        const match = p.regex.exec(allText);
        if (match) {
            if (p.ratingIdx > 0) {
                const r = parseFloat(match[p.ratingIdx].replace(',', '.'));
                if (r >= 0 && r <= 5) rating = r;
            }
            if (p.totalIdx > 0) {
                const t = parseInt(match[p.totalIdx], 10);
                if (t > 0) total = t;
            }
            if (rating !== null && total !== null) break;
            if (rating !== null) break;
        }
    }

    if (!total) {
        // Parênteses completos: (558)
        const m1 = allText.match(/\(\s*(\d{2,6})\s*\)/);
        if (m1) total = parseInt(m1[1], 10);
    }

    if (!total) {
        // Parênteses parciais: (558 sem fechar, ou [558], ou OCR leu como |558|
        const m2 = allText.match(/[\(\[|]\s*(\d{2,6})\s*[\)\]|]?/);
        if (m2) {
            const t = parseInt(m2[1], 10);
            if (t > 0) total = t;
        }
    }

    if (!total) {
        // "N avaliações" em português
        const m3 = allText.match(/(\d{2,6})\s*avalia/i);
        if (m3) total = parseInt(m3[1], 10);
    }

    if (!total) {
        // Último recurso: número isolado de 3+ dígitos que não seja ano nem o rating já encontrado
        const nums = allText.match(/\b([1-9]\d{2,4})\b/g);
        if (nums) {
            for (const n of nums) {
                const v = parseInt(n, 10);
                // Evita anos (1900-2099) e o próprio valor do rating convertido
                const isYear = v >= 1900 && v <= 2099;
                const isRating = rating !== null && v === Math.round(rating * 10);
                if (!isYear && !isRating) { total = v; break; }
            }
        }
    }

    if (!rating) {
        const ratingMatches = allText.match(/\b([0-5][,.]\d)\b/g);
        if (ratingMatches) {
            for (const m of ratingMatches) {
                const r = parseFloat(m.replace(',', '.'));
                if (r >= 0 && r <= 5) { rating = r; break; }
            }
        }
    }

    if (!rating) {
        for (let i = 0; i < (words || []).length; i++) {
            const word = words[i].text.trim();
            const conf = words[i].confidence || 40;
            if (word.match(/^[0-5][,.]\d$/)) {
                const r = parseFloat(word.replace(',', '.'));
                if (r >= 0 && r <= 5 && conf > 25) { rating = r; break; }
            }
            if (word.match(/^[0-5][,.]?\d?$/)) {
                const r = parseFloat(word.replace(',', '.'));
                if (r >= 0 && r <= 5 && conf > 25) { rating = r; break; }
            }
        }
    }

    if (!rating) rating = findRatingByStarCount(allText, starSymbols);

    if (!rating) {
        for (const line of (lines || [])) {
            const lineText = line.text || '';
            const hasStars = starSymbols.some(s => lineText.includes(s));
            if (hasStars) {
                const nums = lineText.match(/[0-5][,.]\d/g);
                if (nums) {
                    for (const n of nums) {
                        const r = parseFloat(n.replace(',', '.'));
                        if (r >= 0 && r <= 5) { rating = r; break; }
                    }
                }
            }
            if (!rating) {
                const intNum = lineText.match(/^([0-5])[,.]\d/);
                if (intNum) {
                    const r = parseFloat(intNum[0].replace(',', '.'));
                    if (r >= 0 && r <= 5) rating = r;
                }
            }
            if (rating) break;
        }
    }

    return { rating, total };
}

function findRatingByStarCount(allText, starSymbols) {
    let fullStars = 0;
    const safeSymbols = ['★', '☆', '⭐', '✯', '✰'];
    for (const s of safeSymbols) {
        try {
            const fullRegex = new RegExp(s, 'g');
            const fullMatches = allText.match(fullRegex);
            if (fullMatches) fullStars += fullMatches.length;
        } catch (e) { }
    }

    if (fullStars >= 5) {
        const googleMatch = allText.match(/([0-5])[,.]\d/);
        if (googleMatch) return parseFloat(googleMatch[0].replace(',', '.'));
        return 5.0;
    }
    if (fullStars >= 1 && fullStars <= 5) {
        const decimalMatch = allText.match(/([0-5])[,.]\d/);
        if (decimalMatch) return parseFloat(decimalMatch[0].replace(',', '.'));
        return fullStars;
    }
    const google5Match = allText.match(/Google[^\d]*([0-5])/i);
    if (google5Match) return parseFloat(google5Match[1]);
    return null;
}

// ── IMAGE HANDLERS ──────────────────────────────────────────

function loadImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        window.currentBase64Image = ev.target.result;
        window.currentMimeType = file.type;
        document.getElementById('imagePreview').src = window.currentBase64Image;
        document.getElementById('imagePreviewContainer').classList.remove('hidden');
        document.getElementById('uploadPlaceholder').classList.add('hidden');
        document.getElementById('imageFileName').textContent = file.name || 'imagem';
        if (window.currentStore) {
            setTimeout(() => autoExtractFromImage(window.currentBase64Image), 100);
        } else {
            showToast('⚠️ Selecione uma loja primeiro para extrair dados.', 'warn');
        }
    };
    reader.readAsDataURL(file);
}

document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', e => loadImageFile(e.target.files[0]));
    }
});

window.clearImage = function () {
    window.currentBase64Image = null;
    window.currentMimeType = null;
    const imageInput = document.getElementById('imageInput');
    if (imageInput) imageInput.value = '';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    document.getElementById('uploadPlaceholder').classList.remove('hidden');
};

window.extractDataFromImage = function () {
    if (!window.currentBase64Image) { showToast('⚠️ Carregue uma imagem primeiro.', 'warn'); return; }
    if (!window.currentStore) { showToast('⚠️ Selecione uma loja primeiro.', 'warn'); return; }
    autoExtractFromImage(window.currentBase64Image);
};

window.handleDragOver = e => { e.preventDefault(); document.getElementById('uploadZone').classList.add('drag-over'); };
window.handleDragLeave = () => document.getElementById('uploadZone').classList.remove('drag-over');
window.handleDrop = e => {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImageFile(file);
};
