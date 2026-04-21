// ═══════════════════════════════════════════════════════════════
// AUTOMAÇÃO - Browser Automation com Playwright
// ═══════════════════════════════════════════════════════════════
// Uso: node automation.js
// Requer: npm install && npx playwright install chromium
// ═══════════════════════════════════════════════════════════════

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── CONFIGURAÇÃO ────────────────────────────────────────────

const APP_URL = 'http://127.0.0.1:5500/';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const LOJAS = [
    { id: 'honor',   name: 'Miplace Honor',   search: 'miplace+honor' },
    { id: 'realme',  name: 'Miplace Realme',  search: 'miplace+realme' },
    { id: 'xv',      name: 'Miplace XV',      search: 'miplace+xv+de+novembro' },
    { id: 'premium', name: 'Miplace Premium', search: 'miplace+premium' },
    { id: 'kassouf', name: 'Miplace Kassouf', search: 'miplace+kassouf' },
];

// ── FUNÇÕES AUXILIARES ──────────────────────────────────────

function log(msg) {
    const time = new Date().toLocaleTimeString('pt-BR');
    console.log(`[${time}] ${msg}`);
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function tirarScreenshot(page, nome) {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const filepath = path.join(SCREENSHOT_DIR, `${nome}_${Date.now()}.png`);
    await page.screenshot({ path: filepath, fullPage: false });
    log(`📸 Screenshot: ${filepath}`);
    return filepath;
}

// ── AUTOMAÇÃO PRINCIPAL ─────────────────────────────────────

async function automatizar(loja, appPage, googlePage) {

    // ═══════════════════════════════════════════════════════
    // ETAPA 1: Abrir o app (reutiliza aba existente)
    // ═══════════════════════════════════════════════════════
    log(`🚀 ETAPA 1: Navegando para o app em ${APP_URL}`);
    await appPage.bringToFront();
    await appPage.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
        await appPage.waitForSelector(`button:has-text("${loja.name}"), text=${loja.name}`, { timeout: 3000 });
    } catch { await sleep(1000); }
    log(`✅ App carregado!`);

    // ═══════════════════════════════════════════════════════
    // ETAPA 2: Selecionar a loja
    // ═══════════════════════════════════════════════════════
    log(`🏪 ETAPA 2: Selecionando loja: ${loja.name}`);
    try {
        await appPage.click(`button:has-text("${loja.name}")`, { timeout: 5000 });
    } catch {
        try {
            await appPage.click(`text=${loja.name}`, { timeout: 5000 });
        } catch {
            log(`❌ ETAPA 2: Não encontrou botão para "${loja.name}" — abortando esta loja.`);
            return { loja: loja.name, erro: 'Botão da loja não encontrado', sucesso: false };
        }
    }
    try {
        await appPage.waitForSelector('#loginScreen[style*="none"], #storeBadge:not(.hidden)', { timeout: 5000 });
    } catch { await sleep(1500); }

    // Verificar se a loja correta foi selecionada
    const lojaAtiva = await appPage.evaluate(() => {
        const badge = document.getElementById('storeBadgeName');
        return badge ? badge.textContent.trim() : null;
    });
    if (lojaAtiva && lojaAtiva !== loja.name) {
        log(`⚠️ ETAPA 2: Badge mostra "${lojaAtiva}", esperado "${loja.name}" — continuando mesmo assim.`);
    }
    log(`✅ Loja selecionada: ${lojaAtiva || loja.name}`);

    // ═══════════════════════════════════════════════════════
    // ETAPA 3: Abrir Google Imagens com URL específica
    // ═══════════════════════════════════════════════════════
    const googleUrl = `https://www.google.com/search?q=${loja.search}&udm=1`;
    log(`🌐 ETAPA 3: Navegando para o Google Imagens...`);
    await googlePage.bringToFront();
    await googlePage.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Aguardar imagens renderizarem
    try {
        await googlePage.waitForSelector('img[jsname], .isv-r, .eA0Zlc', { timeout: 3000 });
    } catch { await sleep(1000); }

    // Fechar cookies
    try {
        const acceptBtn = googlePage.locator('button:has-text("Aceitar tudo"), button:has-text("Accept all"), button:has-text("Concordo")');
        if (await acceptBtn.isVisible({ timeout: 1000 })) {
            await acceptBtn.first().click();
            await sleep(500);
        }
    } catch {}

    log(`✅ Google Imagens carregado!`);

    // ═══════════════════════════════════════════════════════
    // ETAPA 4: Clicar no nome da loja
    // ═══════════════════════════════════════════════════════
    log(`🔍 ETAPA 4: Procurando ${loja.name} nos resultados...`);

    let clicou = false;
    const seletoresClique = [
        `a:has-text("${loja.name}")`,
        `[aria-label*="${loja.name}"]`,
        `.eA0Zlc >> nth=0`,
        `.isv-r >> nth=0`,
    ];

    for (const sel of seletoresClique) {
        try {
            const el = googlePage.locator(sel).first();
            if (await el.isVisible({ timeout: 1000 })) {
                await el.click();
                clicou = true;
                log(`✅ Clicou no resultado!`);
                break;
            }
        } catch {}
    }

    if (!clicou) {
        try {
            await googlePage.locator('img[jsname]').first().click();
            clicou = true;
            log(`✅ Clicou na primeira imagem!`);
        } catch {
            log(`❌ Não encontrou resultado clicável!`);
        }
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 5: Aguardar modal abrir
    // ═══════════════════════════════════════════════════════
    log(`⏳ ETAPA 5: Aguardando modal abrir...`);
    try {
        await googlePage.waitForSelector('[role="dialog"], h2[jsname], .knowledge-panel', { timeout: 4000 });
        await sleep(400);
    } catch { await sleep(2000); }

    // Rolar para o topo
    try { await googlePage.evaluate(() => window.scrollTo(0, 0)); } catch {}

    // ── Extrair dados direto do DOM antes do screenshot (fonte de verdade) ──
    const dadosDom = await googlePage.evaluate(() => {
        let rating = null;
        let total = null;
        const todos = Array.from(document.querySelectorAll('*'));

        // ── Nota: elemento com texto exato "X,Y" ──
        for (const el of todos) {
            if (el.children.length > 2) continue;
            const t = el.textContent.trim();
            if (/^[0-5][,.][0-9]$/.test(t) && el.offsetHeight > 0 && el.offsetHeight < 50) {
                rating = parseFloat(t.replace(',', '.'));
                break;
            }
        }

        // Fallback nota: regex no texto visível da página
        if (!rating) {
            const bodyText = document.body.innerText || '';
            const m = bodyText.match(/\b([1-5][,.][0-9])\b/);
            if (m) rating = parseFloat(m[1].replace(',', '.'));
        }

        // ── Total: elemento com texto exato "(N)" ──
        for (const el of todos) {
            if (el.children.length > 2) continue;
            const t = el.textContent.trim();
            if (/^\(\d+\)$/.test(t) && el.offsetHeight > 0 && el.offsetHeight < 50) {
                total = parseInt(t.replace(/\D/g, ''), 10);
                break;
            }
        }

        // Fallback total 1: regex "(N)" no texto visível da página
        if (!total) {
            const bodyText = document.body.innerText || '';
            const m = bodyText.match(/\((\d{2,6})\)/);
            if (m) total = parseInt(m[1], 10);
        }

        // Fallback total 2: aria-label com "N avaliações" ou "N reviews"
        if (!total) {
            const ariaEls = Array.from(document.querySelectorAll('[aria-label]'));
            for (const el of ariaEls) {
                const label = el.getAttribute('aria-label') || '';
                const m = label.match(/(\d{2,6})\s*(avalia|review)/i);
                if (m) { total = parseInt(m[1], 10); break; }
            }
        }

        // Fallback total 3: data-* attributes que possam conter o total
        if (!total) {
            for (const el of todos) {
                for (const attr of el.attributes || []) {
                    const m = attr.value.match(/\((\d{3,6})\)/);
                    if (m) { total = parseInt(m[1], 10); break; }
                }
                if (total) break;
            }
        }

        return { rating, total };
    }).catch(() => ({ rating: null, total: null }));

    log(`📊 DOM: Nota=${dadosDom.rating ?? '?'} | Total=${dadosDom.total ?? '?'}`);

    // ═══════════════════════════════════════════════════════
    // ETAPA 6 e 7: Screenshot apenas do modal da loja
    // ═══════════════════════════════════════════════════════
    log(`📸 ETAPA 6/7: Tirando screenshot do modal...`);

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // Screenshot completo (backup)
    const screenshotCompleto = path.join(SCREENSHOT_DIR, `${loja.id}_completo_${Date.now()}.png`);
    await googlePage.screenshot({ path: screenshotCompleto, fullPage: false });
    log(`📸 Backup completo salvo`);

    // Calcular área exata do modal usando evaluate
    log(`📐 Calculando área exata do modal (Quadrado Vermelho)...`);

    const areaModal = await googlePage.evaluate((nomeLoja) => {
        const nomeMin = nomeLoja.toLowerCase();

        // ═══ ESTRATÉGIA 1: Encontrar [role="dialog"] que contém o nome da loja ═══
        let modalEl = Array.from(document.querySelectorAll('[role="dialog"]'))
            .find(d => d.textContent.toLowerCase().includes(nomeMin) && d.offsetHeight > 0);

        // ═══ ESTRATÉGIA 2: Encontrar pelo botão fechar (X) ═══
        if (!modalEl) {
            const closeBtns = Array.from(document.querySelectorAll(
                '[aria-label="Fechar"], [aria-label="Close"], [aria-label="Dispensar"]'
            ));
            for (const btn of closeBtns) {
                const parent = btn.closest('[role="dialog"]') || btn.closest('[jscontroller]');
                if (parent && parent.textContent.toLowerCase().includes(nomeMin) && parent.offsetHeight > 0) {
                    modalEl = parent;
                    break;
                }
            }
        }

        // ═══ ESTRATÉGIA 3: Subir a partir do título até encontrar container com tablist ═══
        if (!modalEl) {
            const titulos = Array.from(document.querySelectorAll('h2, h3, [role="heading"]'));
            let tituloLoja = titulos.find(el =>
                el.textContent.toLowerCase().includes(nomeMin) && el.offsetHeight > 0
            );

            // Fallback: busca por parte do nome (ex: "Honor", "Realme")
            if (!tituloLoja) {
                const partes = nomeLoja.split(' ');
                for (let i = partes.length - 1; i >= 1; i--) {
                    const parte = partes[i].toLowerCase();
                    if (parte.length < 3) continue;
                    tituloLoja = titulos.find(el =>
                        el.textContent.toLowerCase().includes(parte) && el.offsetHeight > 0
                    );
                    if (tituloLoja) break;
                }
            }

            if (tituloLoja) {
                let el = tituloLoja.parentElement;
                for (let i = 0; i < 20; i++) {
                    if (!el || el === document.body) break;
                    if (el.querySelector('[role="tablist"]')) { modalEl = el; break; }
                    el = el.parentElement;
                }
                // Segundo fallback: subir mais para achar dialog
                if (!modalEl) {
                    el = tituloLoja.parentElement;
                    for (let i = 0; i < 20; i++) {
                        if (!el || el === document.body) break;
                        if (el.getAttribute('role') === 'dialog') { modalEl = el; break; }
                        el = el.parentElement;
                    }
                }
            }
        }

        if (!modalEl) return null;

        // ═══ CALCULAR COORDENADAS ═══
        const rectModal = modalEl.getBoundingClientRect();

        // Limite inferior: base da barra de abas (Visão Geral | Avaliações)
        const tablist = modalEl.querySelector('[role="tablist"]');
        let height;
        if (tablist) {
            const rectTablist = tablist.getBoundingClientRect();
            height = rectTablist.bottom - rectModal.top + 5;
        } else {
            // Fallback: altura total do modal limitada a 550px
            height = Math.min(rectModal.height, 550);
        }

        // Garantir que não ultrapasse a viewport
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        return {
            x: Math.max(0, rectModal.left),
            y: Math.max(0, rectModal.top),
            width: Math.min(rectModal.width, viewW - rectModal.left),
            height: Math.min(height, viewH - rectModal.top)
        };
    }, loja.name);

    let screenshotModal = screenshotCompleto;

    if (areaModal) {
        log(`✅ Área calculada: x=${areaModal.x.toFixed(0)} y=${areaModal.y.toFixed(0)} w=${areaModal.width.toFixed(0)} h=${areaModal.height.toFixed(0)}`);
        try {
            // Validar dimensões mínimas
            if (areaModal.width < 100 || areaModal.height < 80) {
                log(`⚠️ Área muito pequena (${areaModal.width.toFixed(0)}x${areaModal.height.toFixed(0)}), usando completo`);
            } else {
                screenshotModal = path.join(SCREENSHOT_DIR, `${loja.id}_modal_${Date.now()}.png`);
                await googlePage.screenshot({
                    path: screenshotModal,
                    type: 'png',
                    clip: areaModal
                });
                const stats = fs.statSync(screenshotModal);
                if (stats.size > 5000) {
                    log(`✅ Modal capturado (${(stats.size / 1024).toFixed(1)}KB)`);
                } else {
                    log(`⚠️ Modal muito pequeno (${(stats.size / 1024).toFixed(1)}KB), usando completo`);
                    screenshotModal = screenshotCompleto;
                }
            }
        } catch (err) {
            log(`⚠️ Erro ao cortar: ${err.message}, usando completo`);
            screenshotModal = screenshotCompleto;
        }
    } else {
        log(`⚠️ Não foi possível calcular área do modal para "${loja.name}", usando screenshot completo`);
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 8: Voltar para a aba do app
    // ═══════════════════════════════════════════════════════
    log(`↩️ ETAPA 8: Voltando para a aba do app...`);
    await appPage.bringToFront();
    await sleep(500);
    log(`✅ Aba do app ativa!`);

    // ═══════════════════════════════════════════════════════
    // ETAPA 9: Inserir screenshot no campo de foto
    // ═══════════════════════════════════════════════════════
    // Limpar campos antes de inserir nova imagem (evita "0" residual de loja anterior)
    await appPage.evaluate(() => {
        const t = document.getElementById('totalInput');
        const r = document.getElementById('ratingInput');
        if (t) { t.value = ''; t.classList.remove('ring-2', 'ring-green-400'); }
        if (r) { r.value = ''; r.classList.remove('ring-2', 'ring-green-400'); }
    });

    log(`📁 ETAPA 9: Inserindo screenshot no campo de foto...`);
    log(`   Arquivo: ${screenshotModal}`);

    // Verificar se o arquivo existe
    if (!fs.existsSync(screenshotModal)) {
        log(`❌ Arquivo não existe: ${screenshotModal}`);
        screenshotModal = screenshotCompleto;
        log(`   Usando fallback: ${screenshotCompleto}`);
    }

    const fileSize = fs.statSync(screenshotModal).size;
    log(`   Tamanho: ${(fileSize / 1024).toFixed(1)}KB`);

    try {
        // Garantir que o input está visível
        const fileInput = appPage.locator('input#imageInput');
        await fileInput.setInputFiles(screenshotModal);
        log(`✅ Screenshot inserido no input!`);
        await sleep(1000);
    } catch (err) {
        log(`❌ Erro ao inserir: ${err.message}`);
        // Fallback: tentar clicar na zona de upload primeiro
        try {
            await appPage.click('#uploadZone', { timeout: 3000 });
            await sleep(500);
            const fileInput = appPage.locator('input#imageInput');
            await fileInput.setInputFiles(screenshotModal);
            log(`✅ Screenshot inserido após clicar na zona!`);
            await sleep(1000);
        } catch (err2) {
            log(`❌ Fallback também falhou: ${err2.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 10: Registrar dados do DOM (referência para fallback)
    // ═══════════════════════════════════════════════════════
    // ETAPA 10: Confirmar dados DOM (fonte primária confiável)
    // ═══════════════════════════════════════════════════════
    log(`📊 ETAPA 10: DOM capturado — Total: ${dadosDom.total || '?'} | Nota: ${dadosDom.rating || '?'}`);

    // ═══════════════════════════════════════════════════════
    // ETAPA 11: Aguardar OCR processar (20s máximo)
    // ═══════════════════════════════════════════════════════
    log(`⏳ ETAPA 11: Aguardando OCR processar a imagem (12s)...`);
    for (let i = 0; i < 24; i++) {
        await sleep(500);
        const tv = await appPage.locator('#totalInput').inputValue();
        const rv = await appPage.locator('#ratingInput').inputValue();
        if (tv && tv !== '0' && rv && rv !== '0') {
            log(`✅ OCR preencheu após ${(i * 0.5 + 0.5).toFixed(1)}s — Total=${tv} | Nota=${rv}`);
            break;
        }
        if (i === 23) log(`⚠️ ETAPA 11: Timeout 12s atingido.`);
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 12: Definir valores finais — OCR prevalece; DOM é fallback
    // OCR extrai da imagem real de cada loja (fonte mais confiável)
    // DOM do Google Imagens pode retornar valores de outros elementos da página
    // ═══════════════════════════════════════════════════════
    log(`🔍 ETAPA 12: Consolidando Total de Avaliações e Nota Média...`);

    const ocrTotal = await appPage.locator('#totalInput').inputValue();
    const ocrRating = await appPage.locator('#ratingInput').inputValue();
    log(`   OCR leu  → Total: ${ocrTotal || '?'} | Nota: ${ocrRating || '?'}`);
    log(`   DOM leu  → Total: ${dadosDom.total || '?'} | Nota: ${dadosDom.rating || '?'}`);

    // Total: OCR é a fonte primária; DOM é usado só quando OCR não extraiu
    let totalValue;
    const ocrTotalValido = ocrTotal && ocrTotal !== '0' && !isNaN(parseInt(ocrTotal, 10));
    if (ocrTotalValido) {
        totalValue = ocrTotal;
        log(`   ✅ Total FINAL (OCR): ${totalValue}`);
    } else if (dadosDom.total) {
        totalValue = String(dadosDom.total);
        log(`   ⚠️ Total FINAL (DOM — OCR falhou): ${totalValue}`);
    } else {
        totalValue = '';
        log(`   ❌ Total: não foi possível extrair`);
    }

    // Nota: OCR é a fonte primária; DOM é usado só quando OCR não extraiu
    let ratingValue;
    const ocrRatingValido = ocrRating && ocrRating !== '0' && !isNaN(parseFloat(ocrRating));
    if (ocrRatingValido) {
        ratingValue = ocrRating;
        log(`   ✅ Nota FINAL (OCR): ${ratingValue}`);
    } else if (dadosDom.rating) {
        ratingValue = String(dadosDom.rating);
        log(`   ⚠️ Nota FINAL (DOM — OCR falhou): ${ratingValue}`);
    } else {
        ratingValue = '';
        log(`   ❌ Nota: não foi possível extrair`);
    }

    // Garantir que os campos refletem os valores finais e disparar evento input
    await appPage.evaluate(({ total, rating }) => {
        const t = document.getElementById('totalInput');
        const r = document.getElementById('ratingInput');
        if (t && total) {
            t.value = total;
            t.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (r && rating) {
            r.value = rating;
            r.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, { total: totalValue, rating: ratingValue });

    const camposOk = !!(totalValue && ratingValue);

    const resultado = {
        loja: loja.name,
        totalAvaliacoes: totalValue || null,
        notaMedia: ratingValue || null,
        sucesso: camposOk,
    };

    // ═══════════════════════════════════════════════════════
    // ETAPA 13: Preparar e clicar em "Salvar Registro"
    // ═══════════════════════════════════════════════════════
    if (!camposOk) {
        log(`❌ ETAPA 13: Campos incompletos, abortando salvamento para ${loja.name}.`);
        log(`   📊 Total: ${totalValue || 'NÃO EXTRAÍDO'}`);
        log(`   ⭐ Nota: ${ratingValue || 'NÃO EXTRAÍDO'}`);
        await tirarScreenshot(appPage, `${loja.id}_app_final`);
        return resultado;
    }

    log(`✅ ETAPA 13: Dados confirmados! Clicando em "Salvar Registro"...`);
    log(`   📊 Total: ${totalValue} | ⭐ Nota: ${ratingValue}`);

    // Aguardar toast do OCR desaparecer
    try {
        await appPage.waitForFunction(() => {
            const t = document.getElementById('toast');
            return !t || t.classList.contains('opacity-0') || t.classList.contains('translate-y-20');
        }, { timeout: 4000 });
    } catch { /* ignora */ }

    // Resetar estado de submit e fechar modal residual
    await appPage.evaluate(() => {
        if (typeof window.__resetSubmitState === 'function') window.__resetSubmitState();
        const m = document.getElementById('confirmModal');
        if (m && !m.classList.contains('hidden')) {
            m.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
    await sleep(200);

    // ── Clicar no botão ──
    let clickOk = false;
    try {
        await appPage.locator('button[type="submit"]').scrollIntoViewIfNeeded({ timeout: 1000 });
        await sleep(100);
        await appPage.locator('button[type="submit"]').click({ timeout: 3000, force: true });
        log(`✅ Botão clicado via Playwright!`);
        clickOk = true;
    } catch { /* continua */ }

    if (!clickOk) {
        try {
            await appPage.click('text=Salvar Registro', { timeout: 2000, force: true });
            log(`✅ Botão clicado via texto!`);
            clickOk = true;
        } catch { /* continua */ }
    }

    if (!clickOk) {
        try {
            await appPage.evaluate(() => {
                const btn = document.querySelector('button[type="submit"]');
                if (btn) btn.click();
            });
            log(`✅ Botão clicado via evaluate!`);
            clickOk = true;
        } catch { /* continua */ }
    }

    if (!clickOk) {
        try {
            await appPage.evaluate(() => {
                const form = document.getElementById('recordForm');
                if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            });
            log(`✅ Submit via dispatchEvent!`);
            clickOk = true;
        } catch (e) {
            log(`❌ Todas as estratégias falharam: ${e.message}`);
        }
    }

    // ── Aceitar modal de confirmação (polling, 4s) ──
    log(`⏳ Verificando modal de confirmação...`);
    let modalAceito = false;
    for (let t = 0; t < 20; t++) {
        await sleep(200);
        const ok = await appPage.evaluate(() => {
            const m = document.getElementById('confirmModal');
            if (m && !m.classList.contains('hidden') && typeof window.confirmAccept === 'function') {
                window.confirmAccept();
                return true;
            }
            return false;
        });
        if (ok) { log(`   ✅ Modal aceito (tentativa ${t + 1})`); modalAceito = true; break; }
    }
    if (!modalAceito) log(`   ℹ️ Nenhum modal de confirmação.`);

    // ═══════════════════════════════════════════════════════
    // ETAPA 14: Aguardar toast "Salvando" (confirma submit)
    // ═══════════════════════════════════════════════════════
    log(`⏳ ETAPA 14: Aguardando toast "Salvando..." (5s)...`);
    let submitDisparou = false;
    for (let i = 0; i < 10; i++) {
        await sleep(300);
        const txt = await appPage.evaluate(() => {
            const t = document.getElementById('toastMessage');
            return t ? t.textContent.trim() : '';
        });
        if (txt.includes('Salvando') || txt.includes('salvo') || txt.includes('✅')) {
            log(`✅ ETAPA 14: Submit confirmado! Toast: "${txt}"`);
            submitDisparou = true;
            break;
        }
        // Aceitar modal caso tenha aparecido com atraso
        await appPage.evaluate(() => {
            const m = document.getElementById('confirmModal');
            if (m && !m.classList.contains('hidden') && typeof window.confirmAccept === 'function') {
                window.confirmAccept();
            }
        });
    }
    if (!submitDisparou) {
        log(`⚠️ ETAPA 14: Toast "Salvando" não detectado — tentando novamente...`);
        // Tentar clicar no botão novamente
        try {
            await appPage.evaluate(() => {
                if (typeof window.__resetSubmitState === 'function') window.__resetSubmitState();
                const btn = document.querySelector('button[type="submit"]');
                if (btn) btn.click();
            });
            await sleep(1000);
            const txt = await appPage.evaluate(() => {
                const t = document.getElementById('toastMessage');
                return t ? t.textContent.trim() : '';
            });
            if (txt.includes('Salvando') || txt.includes('salvo') || txt.includes('✅')) {
                log(`   ✅ Segundo clique funcionou! Toast: "${txt}"`);
                submitDisparou = true;
            }
        } catch { /* ignora */ }
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 15: Aguardar conclusão do salvamento (20s)
    // ═══════════════════════════════════════════════════════
    log(`⏳ ETAPA 15: Aguardando conclusão do salvamento (até 15s)...`);
    let salvoConfirmado = false;
    for (let i = 0; i < 20; i++) {
        await sleep(750);
        const estado = await appPage.evaluate(() => {
            const t = document.getElementById('toastMessage');
            const m = document.getElementById('confirmModal');
            return {
                toast: t ? t.textContent.trim() : '',
                modalVisivel: m && !m.classList.contains('hidden'),
            };
        });
        if (estado.toast.includes('✅') || estado.toast.toLowerCase().includes('salvo')) {
            log(`✅ ETAPA 15: Registro salvo! (${estado.toast})`);
            salvoConfirmado = true;
            break;
        }
        // Modal ainda aberto — aceitar
        if (estado.modalVisivel) {
            log(`⚠️ [${i + 1}s] Modal ainda aberto — aceitando...`);
            await appPage.evaluate(() => { if (window.confirmAccept) window.confirmAccept(); });
        }
        // Progresso
        if (i % 8 === 7) log(`⏳ [${Math.round((i + 1) * 0.75)}s] Aguardando salvamento...`);
    }

    if (!salvoConfirmado) {
        log(`⚠️ ETAPA 15: Timeout — toast final: "${await appPage.evaluate(() => {
            const t = document.getElementById('toastMessage');
            return t ? t.textContent.trim() : '';
        })}"`);
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 16: Verificar diário de registros (fonte da verdade)
    // ═══════════════════════════════════════════════════════
    log(`⏳ ETAPA 16: Aguardando 2s para Firestore sincronizar...`);
    await sleep(2000);

    const hoje = (() => {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    const diario = await appPage.evaluate(({ totalEsp, dataHoje }) => {
        const rows = Array.from(document.querySelectorAll('#tableBody tr'));
        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 2) continue;
            const dataCell = cells[0].textContent.trim();
            const totalCell = cells[1].textContent.replace(/\D/g, '');
            if (dataCell.includes(dataHoje) && totalCell === totalEsp.replace(/\D/g, '')) {
                return { encontrado: true, data: dataCell, total: totalCell };
            }
        }
        const qualquerHoje = rows.some(r => r.textContent.includes(dataHoje));
        return { encontrado: false, qualquerHoje, totalLinhas: rows.length };
    }, { totalEsp: totalValue, dataHoje: hoje });

    if (diario.encontrado) {
        log(`✅ ETAPA 16: Registro confirmado no diário! Total=${diario.total} | Data=${diario.data}`);
        resultado.confirmadoNoDiario = true;
        if (!salvoConfirmado) {
            log(`   📌 O salvamento foi bem-sucedido (diário confirmou). O toast pode ter falhado.`);
            salvoConfirmado = true;
        }
    } else if (diario.qualquerHoje) {
        log(`⚠️ ETAPA 16: Linha de hoje encontrada, mas total diverge.`);
        resultado.confirmadoNoDiario = true;
    } else {
        log(`❌ ETAPA 16: Registro NÃO encontrado no diário (${diario.totalLinhas} linhas).`);
        resultado.confirmadoNoDiario = false;

        // Fallback: tentar salvar manualmente via evaluate se o submit não funcionou
        if (!submitDisparou) {
            log(`🔄 ETAPA 16: Tentando salvamento direto via Firestore...`);
            const salvouDireto = await appPage.evaluate(async ({ total, rating }) => {
                try {
                    if (typeof window.__forceSave === 'function') {
                        await window.__forceSave(total, rating);
                        return true;
                    }
                    return false;
                } catch { return false; }
            }, { total: totalValue, rating: ratingValue });
            if (salvouDireto) {
                log(`✅ Salvamento direto funcionou!`);
                salvoConfirmado = true;
                resultado.confirmadoNoDiario = true;
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 17: Verificar data do registro
    // ═══════════════════════════════════════════════════════
    log(`📅 ETAPA 17: Verificando data do registro...`);
    const primeiraLinha = await appPage.evaluate(() => {
        const row = document.querySelector('#tableBody tr');
        if (!row) return null;
        const cells = Array.from(row.querySelectorAll('td'));
        return {
            data: cells[0] ? cells[0].textContent.trim() : null,
            total: cells[1] ? cells[1].textContent.trim() : null,
        };
    });

    if (primeiraLinha && primeiraLinha.data && primeiraLinha.data.includes(hoje)) {
        log(`✅ ETAPA 17: Data correta! ${primeiraLinha.data} — Total: ${primeiraLinha.total}`);
        resultado.dataCorreta = true;
    } else if (primeiraLinha) {
        log(`⚠️ ETAPA 17: Primeiro registro: ${primeiraLinha.data}, esperado ${hoje}.`);
        resultado.dataCorreta = false;
    } else {
        log(`❌ ETAPA 17: Nenhum registro na tabela.`);
        resultado.dataCorreta = false;
    }

    // ═══════════════════════════════════════════════════════
    // ETAPA 18: Finalizar loja
    // ═══════════════════════════════════════════════════════
    resultado.sucesso = salvoConfirmado || resultado.confirmadoNoDiario === true;
    const statusFinal = resultado.sucesso ? '✅ Sucesso' : '❌ Falhou';
    log(`${statusFinal} — ${loja.name} (Total: ${totalValue}, Nota: ${ratingValue})`);

    // Resetar estado para próxima loja
    await appPage.evaluate(() => {
        if (typeof window.__resetSubmitState === 'function') window.__resetSubmitState();
        const m = document.getElementById('confirmModal');
        if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
        // Limpar campos
        const t = document.getElementById('totalInput');
        const r = document.getElementById('ratingInput');
        if (t) t.value = '';
        if (r) r.value = '';
    });

    await tirarScreenshot(appPage, `${loja.id}_app_final`);
    return resultado;
}

// ── EXECUÇÃO ────────────────────────────────────────────────

async function iniciarServidor() {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        log(`🌐 Iniciando servidor em http://127.0.0.1:5500/`);
        const server = exec('npx serve . -l 5500', { cwd: __dirname });
        server.stdout.on('data', d => process.stdout.write(d));
        server.stderr.on('data', d => process.stderr.write(d));
        setTimeout(() => {
            log(`✅ Servidor iniciado!`);
            resolve(server);
        }, 3000);
        server.on('error', reject);
    });
}

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🤖 AUTOMAÇÃO - Monitor de Avaliações Google   ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // Iniciar servidor
    const server = await iniciarServidor();
    await sleep(1000);

    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized', '--disable-notifications']
    });

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        permissions: ['clipboard-read', 'clipboard-write']
    });

    // Impede que o localStorage restaure a última loja automaticamente
    // (evita que a tela de login fique oculta na ETAPA 2)
    await context.addInitScript(() => {
        localStorage.removeItem('lastStoreId');
    });

    // Criar as duas abas uma única vez — reutilizadas para todas as lojas
    let appPage = await context.newPage();
    let googlePage = await context.newPage();
    log(`🗂️ Duas abas criadas (app + Google) — serão reutilizadas para todas as lojas.`);

    const resultados = [];

    for (const loja of LOJAS) {
        console.log('');
        console.log(`${'═'.repeat(52)}`);
        log(`🔄 Processando: ${loja.name}`);
        console.log(`${'═'.repeat(52)}`);

        // Reabrir páginas se fecharam inesperadamente
        try { await appPage.title(); } catch {
            log(`⚠️ Aba do app fechada — reabrindo...`);
            appPage = await context.newPage();
        }
        try { await googlePage.title(); } catch {
            log(`⚠️ Aba do Google fechada — reabrindo...`);
            googlePage = await context.newPage();
        }

        try {
            const resultado = await automatizar(loja, appPage, googlePage);
            resultados.push(resultado);
        } catch (err) {
            log(`❌ Erro fatal: ${err.message}`);
            resultados.push({ loja: loja.name, erro: err.message, sucesso: false });
            // Recriar páginas após erro fatal para garantir loja seguinte
            try { appPage = await context.newPage(); } catch {}
            try { googlePage = await context.newPage(); } catch {}
        }

        await sleep(1000);
    }

    // ── RELATÓRIO FINAL ─────────────────────────────────────
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║              📊 RELATÓRIO FINAL                 ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    for (const r of resultados) {
        const icon = r.sucesso ? '✅' : '⚠️';
        console.log(`${icon} ${r.loja}`);
        console.log(`   📊 Total: ${r.totalAvaliacoes || 'N/A'}`);
        console.log(`   ⭐ Nota: ${r.notaMedia || 'N/A'}`);
        if (r.sucesso) {
            const diario = r.confirmadoNoDiario === true ? '✅ Confirmado' : r.confirmadoNoDiario === false ? '❌ Não encontrado' : '—';
            const data = r.dataCorreta === true ? '✅ Correta' : r.dataCorreta === false ? '⚠️ Divergente' : '—';
            console.log(`   📋 Diário: ${diario}`);
            console.log(`   📅 Data:   ${data}`);
        }
        if (r.erro) console.log(`   ❌ Erro: ${r.erro}`);
        console.log('');
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    console.log(`📊 Resultado: ${sucessos}/${resultados.length} lojas extraídas com sucesso`);
    console.log(`📸 Screenshots: ${SCREENSHOT_DIR}`);
    console.log('');

    await browser.close();

    // Fechar servidor
    try { server.kill(); } catch {}
    log(`🛑 Servidor encerrado.`);
}

main().catch(console.error);
