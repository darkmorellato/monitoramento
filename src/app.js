// ═══════════════════════════════════════════════════════════════
// APP - Main: Form, KPIs, Table, Insights, Init, Master Update
// ═══════════════════════════════════════════════════════════════

import { showToast, showConfirm, showImageById, showImage, showNotes, closeModal, startClock } from './ui.js';
import { saveLogEntry, deleteRecordFromDB, clearAllDataFromDB, getDB } from './firebase.js';
import { dateUnlocked, currentStore, setDateUnlocked, renderStoreList, selectStore, doLogout, requestDateUnlock, checkDatePw, closePwModal, togglePwVisibility } from './auth.js';
import { renderChart, renderDonut, switchChart, setPeriod, donutFocus, currentChart } from './charts.js';
import { loadImageFile, clearImage, extractDataFromImage, handleDragOver, handleDragLeave, handleDrop } from './ocr.js';
import { exportCSV, exportPDF, shareResume, copyShare } from './export.js';
import { initKeyboardShortcuts } from './keys.js';
import { fmtDate, calcHealth, calcStreak, getConsecutiveDrops, linearRegression } from './utils.js';

// ── STATE ───────────────────────────────────────────────────

let logs = [];
let sortField = 'date';
let sortDir = -1;
let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ── DOM REFS ────────────────────────────────────────────────

const form = document.getElementById('recordForm');
const dateInputEl = document.getElementById('dateInput');
const totalInput = document.getElementById('totalInput');
const ratingInput = document.getElementById('ratingInput');
const notesInput = document.getElementById('notesInput');
const tableBody = document.getElementById('tableBody');

// ── INIT ────────────────────────────────────────────────────

function updateMonthLabel() {
    document.getElementById('monthLabel').textContent = `${MESES[selectedMonth]} ${selectedYear}`;
}

function prevMonth() {
    selectedMonth--;
    if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; }
    updateMonthLabel();
    renderTable();
}

function nextMonth() {
    selectedMonth++;
    if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; }
    updateMonthLabel();
    renderTable();
}

function goToCurrentMonth() {
    const now = new Date();
    selectedMonth = now.getMonth();
    selectedYear = now.getFullYear();
    updateMonthLabel();
    renderTable();
}

function init() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    dateInputEl.value = `${yyyy}-${mo}-${dd}`;
    document.getElementById('dateDisplay').value = `${dd}/${mo}/${yyyy}`;
    startClock(() => dateUnlocked);
    updateMonthLabel();
}

// ── MASTER UPDATE ───────────────────────────────────────────

function updateAll() {
    logs.sort((a, b) => new Date(a.date) - new Date(b.date));
    renderKPIs();
    renderChart(currentChart, logs);
    renderDonut(logs);
    renderTable();
    renderInsights();
    updateHeaderStats();
    updateHealthBadge();
    updateWeekly();
    updateStreak();
}

window.__updateAll = (newLogs) => { logs = newLogs; updateAll(); };
window.__currentStore = null;
Object.defineProperty(window, '__currentStore', { get: () => currentStore });

// ── SORT ────────────────────────────────────────────────────

function sortBy(field) {
    if (sortField === field) sortDir *= -1; else { sortField = field; sortDir = -1; }
    renderTable();
}

// ── FORM SUBMIT ─────────────────────────────────────────────

form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentStore) { showToast('Faça login em uma loja primeiro.', 'error'); return; }
    const date = dateInputEl.value;
    const time = document.getElementById('timeInput').value;
    const total = parseInt(totalInput.value, 10);
    if (isNaN(total) || total < 0) { showToast('⚠️ Informe um total válido.', 'warn'); return; }
    const rating = parseFloat(ratingInput.value);
    if (ratingInput.value && (isNaN(rating) || rating < 1 || rating > 5)) { showToast('⚠️ Nota deve ser 1 a 5.', 'warn'); return; }
    const notes = notesInput.value.trim();
    const existingOnDate = logs.find(l => l.date === date);
    if (existingOnDate) {
        const substituir = await showConfirm('Substituir registro?', `Já existe registro para ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}. Deseja substituir?`);
        if (!substituir) return;
    }
    const logId = existingOnDate ? existingOnDate.id : Date.now();
    const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const prevLog = sorted.filter(l => l.date < date).pop();
    const diff = prevLog ? total - prevLog.total : 0;
    const pct = prevLog && prevLog.total !== 0 ? parseFloat(((diff / prevLog.total) * 100).toFixed(2)) : 0;

    // Verificar se streak quebrou
    const prevStreak = calcStreak(logs);
    if (prevStreak >= 3 && diff < 0) {
        showToast(`🔥 Streak de ${prevStreak} dias quebrado!`, 'warn');
    }

    const newEntry = { id: logId, date, time, total, rating: isNaN(rating) ? null : rating, diff, pct, notes, image: null };
    const tempLogs = logs.filter(l => l.date !== date);
    tempLogs.push(newEntry);
    tempLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    tempLogs.forEach((l, i) => {
        l.diff = i === 0 ? 0 : l.total - tempLogs[i - 1].total;
        l.pct = (i === 0 || tempLogs[i - 1].total === 0) ? 0 : parseFloat(((l.diff / tempLogs[i - 1].total) * 100).toFixed(2));
    });

    const { currentBase64Image } = await import('./ocr.js');
    newEntry.image = currentBase64Image || null;

    try {
        showToast('⏳ Salvando...', 'success');
        await saveLogEntry(newEntry, currentStore);
        for (const l of tempLogs) {
            if (l.id !== newEntry.id) {
                const ref = getDB().collection('Lojas').doc(currentStore.name).collection('registros');
                await ref.doc(String(l.id)).update({ diff: l.diff, pct: l.pct });
            }
        }
    } catch (err) {
        console.error('Firestore save error:', err);
        showToast('❌ Erro ao salvar.', 'error');
        return;
    }
    totalInput.value = ''; ratingInput.value = ''; notesInput.value = '';
    clearImage();
    const next = new Date(date + 'T12:00:00'); next.setDate(next.getDate() + 1);
    const ndd = String(next.getDate()).padStart(2, '0');
    const nmo = String(next.getMonth() + 1).padStart(2, '0');
    const nyyyy = next.getFullYear();
    if (dateUnlocked) { dateInputEl.value = `${nyyyy}-${nmo}-${ndd}`; document.getElementById('dateDisplay').value = `${ndd}/${nmo}/${nyyyy}`; }
    showToast('✅ Registro salvo!', 'success');
});

// ── DELETE / CLEAR ──────────────────────────────────────────

async function deleteRecord(id) {
    const ok = await showConfirm('Remover registro?', 'Esta ação não pode ser desfeita.');
    if (!ok) return;
    deleteRecordFromDB(id, currentStore);
    showToast('Registro removido.', 'success');
}

async function clearAllData() {
    const ok = await showConfirm('Apagar TUDO?', 'Todos os registros serão permanentemente removidos.');
    if (!ok) return;
    await clearAllDataFromDB(currentStore);
    showToast('Registros apagados.', 'success');
}

// ── KPIs ────────────────────────────────────────────────────

function renderKPIs() {
    const kpiRow = document.getElementById('kpiRow');
    if (logs.length === 0) { kpiRow.innerHTML = ''; return; }
    const last = logs[logs.length - 1], first = logs[0];
    const totalGrowth = last.total - first.total;
    const drops = logs.filter(l => l.diff < 0);
    const gains = logs.filter(l => l.diff > 0);
    const biggest = [...logs].sort((a, b) => a.diff - b.diff)[0];
    const ratingLogs = logs.filter(l => l.rating);
    const avgRating = ratingLogs.length ? (ratingLogs.reduce((s, l) => s + l.rating, 0) / ratingLogs.length) : 0;
    const streak = calcStreak(logs);
    const avgGain = logs.length > 1 ? (totalGrowth / (logs.length - 1)).toFixed(1) : 0;

    const kpis = [
        { label: 'Total Atual', value: last.total.toLocaleString(), sub: totalGrowth >= 0 ? `<span class="font-semibold" style="color:#4ade80;">+${totalGrowth} no período</span>` : `<span class="font-semibold" style="color:#f87171;">${totalGrowth} no período</span>`, icon: '⭐' },
        { label: 'Última Variação', value: (last.diff > 0 ? '+' : '') + last.diff, sub: last.diff < 0 ? `<span style="color:#f87171;">${last.pct}% · Queda</span>` : last.diff > 0 ? `<span style="color:#4ade80;">+${last.pct}% · Crescimento</span>` : `<span style="color:#94a3b8;">Estável</span>`, icon: last.diff < 0 ? '📉' : '📈' },
        { label: 'Quedas', value: drops.length, sub: drops.length > 0 ? `<span style="color:#f87171;">Maior: ${biggest.diff} em ${fmtDate(biggest.date).substring(0, 5)}</span>` : `<span style="color:#4ade80;">Nenhuma queda!</span>`, icon: '🔻' },
        { label: 'Nota Média', value: ratingLogs.length > 0 ? avgRating.toFixed(1) : '—', sub: ratingLogs.length > 0 ? `<span style="color:#fbbf24;">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5 - Math.round(avgRating))}</span>` : '<span style="color:#94a3b8;">Sem notas</span>', icon: '🌟' },
        { label: 'Média/Dia', value: (avgGain > 0 ? '+' : '') + avgGain, sub: `<span style="color:#94a3b8;">🔥 Streak: ${streak} dia(s)</span>`, icon: '📊' }
    ];
    kpiRow.innerHTML = kpis.map(k =>
        `<div class="kpi-card glass rounded-2xl p-5"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="text-xs font-semibold mb-1" style="color:#94a3b8;">${k.label}</p><p class="text-3xl font-black leading-tight" style="color:#ffffff;">${k.value}</p><p class="text-xs mt-2" style="color:#94a3b8;">${k.sub}</p></div><span class="text-3xl shrink-0 float">${k.icon}</span></div></div>`
    ).join('');
}

// ── HEADER STATS ────────────────────────────────────────────

function updateHeaderStats() {
    const hs = document.getElementById('headerStats');
    if (logs.length === 0) { hs.classList.add('hidden'); return; }
    hs.classList.remove('hidden');
    const last = logs[logs.length - 1];
    document.getElementById('hTotal').textContent = last.total.toLocaleString();
    const tw = document.getElementById('hTrendWrap');
    const ht = document.getElementById('hTrend');
    if (last.diff < 0) { tw.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border'; tw.style.background = 'rgba(239,68,68,0.2)'; tw.style.borderColor = 'rgba(239,68,68,0.3)'; ht.innerHTML = `<span class="font-bold text-xs" style="color:#f87171;">${last.diff} (${last.pct}%) 📉</span>`; }
    else if (last.diff > 0) { tw.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border'; tw.style.background = 'rgba(34,197,94,0.2)'; tw.style.borderColor = 'rgba(34,197,94,0.3)'; ht.innerHTML = `<span class="font-bold text-xs" style="color:#4ade80;">+${last.diff} (+${last.pct}%) 📈</span>`; }
    else { tw.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border'; tw.style.background = 'rgba(148,163,184,0.2)'; tw.style.borderColor = 'rgba(148,163,184,0.3)'; ht.innerHTML = `<span class="text-xs" style="color:#94a3b8;">— Estável</span>`; }
}

function updateHealthBadge() {
    const badge = document.getElementById('healthBadge');
    const health = calcHealth(logs);
    if (!health) { badge.classList.add('hidden'); return; }
    badge.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm ${health.cls}`;
    document.getElementById('healthIcon').textContent = health.icon;
    document.getElementById('healthLabel').textContent = health.label;
    badge.classList.remove('hidden');
}

function updateStreak() {
    const streak = calcStreak(logs);
    const badge = document.getElementById('streakBadge');
    if (streak >= 2) { badge.classList.remove('hidden'); badge.classList.add('flex'); document.getElementById('streakCount').textContent = streak; if (streak >= 5) badge.classList.add('streak-glow'); }
    else { badge.classList.add('hidden'); }
}

function updateWeekly() {
    if (logs.length < 2) { document.getElementById('weeklyBar').classList.add('hidden'); return; }
    const cut1 = new Date(); cut1.setDate(cut1.getDate() - 7);
    const cut2 = new Date(); cut2.setDate(cut2.getDate() - 14);
    const curr = logs.filter(l => new Date(l.date) >= cut1);
    const prev = logs.filter(l => { const d = new Date(l.date); return d >= cut2 && d < cut1; });
    const cTotal = curr.reduce((s, l) => s + Math.max(0, l.diff), 0);
    const pTotal = prev.reduce((s, l) => s + Math.max(0, l.diff), 0);
    const diff = cTotal - pTotal;
    const drops = curr.filter(l => l.diff < 0).length;
    document.getElementById('weeklyBar').classList.remove('hidden');
    document.getElementById('wkCurrent').textContent = `+${cTotal}`;
    document.getElementById('wkPrev').textContent = `+${pTotal}`;
    const diffEl = document.getElementById('wkDiff');
    diffEl.textContent = (diff >= 0 ? '+' : '') + diff;
    diffEl.style.fontWeight = 'bold';
    diffEl.style.color = diff >= 0 ? '#4ade80' : '#f87171';
    document.getElementById('wkDrops').textContent = drops;
}

// ── TABLE ───────────────────────────────────────────────────

function renderTable() {
    let data = logs.filter(l => {
        const d = new Date(l.date + 'T12:00:00');
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    data.sort((a, b) => {
        if (sortField === 'date') return sortDir * (new Date(a.date) - new Date(b.date));
        return sortDir * (Number(a[sortField] || 0) - Number(b[sortField] || 0));
    });

    const dropCount = logs.filter(l => l.diff < 0).length;
    const gainCount = logs.filter(l => l.diff > 0).length;
    const totalGained = logs.filter(l => l.diff > 0).reduce((s, l) => s + l.diff, 0);
    const totalLost = Math.abs(logs.filter(l => l.diff < 0).reduce((s, l) => s + l.diff, 0));

    const dc = document.getElementById('dropCount'), gc = document.getElementById('gainCount');
    const tg = document.getElementById('totalGainedBadge'), tl = document.getElementById('totalLostBadge');

    if (dropCount > 0) { document.getElementById('dropCountNum').textContent = dropCount; document.getElementById('dropCountPlural').textContent = dropCount > 1 ? 's' : ''; dc.classList.remove('hidden'); dc.classList.add('flex'); } else { dc.classList.add('hidden'); dc.classList.remove('flex'); }
    if (gainCount > 0) { document.getElementById('gainCountNum').textContent = gainCount; document.getElementById('gainCountPlural').textContent = gainCount > 1 ? 's' : ''; gc.classList.remove('hidden'); gc.classList.add('flex'); } else { gc.classList.add('hidden'); gc.classList.remove('flex'); }
    if (totalGained > 0) { document.getElementById('totalGainedNum').textContent = totalGained; tg.classList.remove('hidden'); tg.classList.add('flex'); } else { tg.classList.add('hidden'); tg.classList.remove('flex'); }
    if (totalLost > 0) { document.getElementById('totalLostNum').textContent = totalLost; tl.classList.remove('hidden'); tl.classList.add('flex'); } else { tl.classList.add('hidden'); tl.classList.remove('flex'); }

    if (data.length === 0) {
        const emptyMsg = `Nenhum registro em ${MESES[selectedMonth]} ${selectedYear}.`;
        tableBody.innerHTML = `<tr><td colspan="8" class="px-5 py-12 text-center text-sm" style="color:#64748b;">${emptyMsg}</td></tr>`;
        const mc = document.getElementById('mobileCards');
        if (mc) mc.innerHTML = `<div class="text-center text-sm py-8" style="color:#64748b;">${emptyMsg}</div>`;
        return;
    }

    tableBody.innerHTML = data.map((log, i) => {
        const isDrop = log.diff < 0, isGain = log.diff > 0;
        const rowCls = isDrop ? 'row-drop' : isGain ? 'row-gain' : '';
        const diffBadge = log.diff !== 0 ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style="${isDrop ? 'background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3)' : 'background:rgba(34,197,94,0.2);color:#86efac;border:1px solid rgba(34,197,94,0.3)'}">${isDrop ? '▼' : '▲'} ${Math.abs(log.diff)}</span>` : `<span class="text-gray-400">—</span>`;
        const pctBadge = log.pct !== 0 && log.pct !== undefined ? `<span class="text-xs font-bold" style="${isDrop ? 'color:#f87171' : 'color:#4ade80'}">${log.pct > 0 ? '+' : ''}${log.pct}%</span>` : `<span class="text-gray-400">—</span>`;
        const statusBadge = isDrop ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style="background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">🔻 Queda</span>` : isGain ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style="background:rgba(34,197,94,0.2);color:#86efac;border:1px solid rgba(34,197,94,0.3);">📈 Ganho</span>` : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.25);">● Neutro</span>`;
        const stars = log.rating ? `<span class="flex items-center gap-1 font-semibold text-xs" style="color:#fbbf24;">${log.rating}<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg></span>` : `<span class="text-gray-400">—</span>`;
        const notesCell = log.notes ? `<button onclick="window.__showNotes('${encodeURIComponent(log.notes)}')" class="max-w-28 truncate block text-xs text-blue-400 hover:text-blue-300 underline text-left">${log.notes.substring(0, 20)}${log.notes.length > 20 ? '…' : ''}</button>` : `<span class="text-gray-400">—</span>`;
        return `<tr class="hover:brightness-95 transition-all fade-up ${rowCls}" style="animation-delay:${i * 12}ms; border-color: rgba(255,255,255,0.05);">
            <td class="px-5 py-3 whitespace-nowrap"><span class="text-sm font-semibold" style="color:#e2e8f0;">${fmtDate(log.date).substring(0, 5)}</span><span class="text-xs ml-1" style="color:#64748b;">${log.time || ''}</span></td>
            <td class="px-5 py-3 whitespace-nowrap text-sm font-black" style="color:#ffffff;">${log.total.toLocaleString()}</td>
            <td class="px-5 py-3 whitespace-nowrap">${stars}</td>
            <td class="px-5 py-3 whitespace-nowrap">${diffBadge}</td>
            <td class="px-5 py-3 whitespace-nowrap">${pctBadge}</td>
            <td class="px-5 py-3 whitespace-nowrap">${statusBadge}</td>
            <td class="px-5 py-3 whitespace-nowrap">${notesCell}</td>
            <td class="px-5 py-3 whitespace-nowrap">${log.image ? `<button onclick="window.__showImageById(${log.id})" class="text-blue-400 hover:text-blue-300 text-xs font-semibold underline">Ver Print</button>` : `<span class="text-gray-400 text-xs">—</span>`}</td>
        </tr>`;
    }).join('');

    const mc = document.getElementById('mobileCards');
    if (mc) {
        mc.innerHTML = data.map((log, i) => {
            const isDrop = log.diff < 0, isGain = log.diff > 0;
            const cardCls = isDrop ? 'card-drop' : isGain ? 'card-gain' : '';
            const statusColor = isDrop ? '#f87171' : isGain ? '#4ade80' : '#94a3b8';
            const diffText = log.diff !== 0 ? `<span class="font-bold" style="color:${statusColor};">${log.diff > 0 ? '+' : ''}${log.diff}</span>` : `<span class="text-gray-400">—</span>`;
            const pctText = log.pct !== 0 && log.pct !== undefined ? `<span style="color:${statusColor};">(${log.pct > 0 ? '+' : ''}${log.pct}%)</span>` : '';
            const ratingText = log.rating ? `<span class="font-semibold" style="color:#fbbf24;">${log.rating} ★</span>` : `<span class="text-gray-400">—</span>`;
            const actions = [];
            if (log.notes) actions.push(`<button onclick="window.__showNotes('${encodeURIComponent(log.notes)}')" class="text-xs text-blue-400 font-semibold">📝 Obs</button>`);
            if (log.image) actions.push(`<button onclick="window.__showImageById(${log.id})" class="text-xs text-blue-400 font-semibold">🖼️ Print</button>`);
            return `<div class="mobile-card ${cardCls} fade-up" style="animation-delay:${i * 20}ms">
                <div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2"><span class="text-sm font-bold" style="color:#e2e8f0;">${fmtDate(log.date).substring(0, 5)}</span><span class="text-xs" style="color:#64748b;">${log.time || ''}</span></div><span class="text-xs font-bold" style="color:${statusColor};">${isDrop ? '🔻' : isGain ? '📈' : '●'} ${isDrop ? 'Queda' : isGain ? 'Ganho' : 'Neutro'}</span></div>
                <div class="flex items-center justify-between"><div class="flex items-center gap-3"><div><div class="text-xs" style="color:#64748b;">Total</div><div class="text-lg font-black" style="color:#ffffff;">${log.total.toLocaleString()}</div></div><div><div class="text-xs" style="color:#64748b;">Variação</div><div class="text-sm font-semibold">${diffText} ${pctText}</div></div><div><div class="text-xs" style="color:#64748b;">Nota</div><div class="text-sm">${ratingText}</div></div></div>${actions.length > 0 ? `<div class="flex items-center gap-2">${actions.join('')}</div>` : ''}</div></div>`;
        }).join('');
    }
}

// ── INSIGHTS ────────────────────────────────────────────────

function renderInsights() {
    const list = document.getElementById('insightsList');
    if (logs.length < 2) { list.innerHTML = `<p class="text-xs text-gray-400">Adicione ao menos 2 registros para ver a análise.</p>`; return; }
    const insights = [];
    const last = logs[logs.length - 1], first = logs[0];
    const drops = logs.filter(l => l.diff < 0);
    const gains = logs.filter(l => l.diff > 0);
    const totalGain = last.total - first.total;
    const streak = calcStreak(logs);
    const ratingLogs = logs.filter(l => l.rating != null);
    const ratingTrend = ratingLogs.length >= 2 ? ratingLogs[ratingLogs.length - 1].rating - ratingLogs[ratingLogs.length - 2].rating : 0;
    const vals = logs.map(l => l.total);
    const reg = linearRegression(vals);

    if (reg && logs.length >= 4) {
        const next3 = Math.round(reg.slope * (vals.length + 2) + reg.intercept);
        if (reg.slope < -0.5) insights.push({ type: 'drop', text: `🔮 <strong>Previsão:</strong> Tendência de queda. ~${next3} em 3 dias.` });
        else if (reg.slope > 0.5) insights.push({ type: 'gain', text: `🔮 <strong>Previsão:</strong> Tendência positiva. ~${next3} em 3 dias.` });
        else insights.push({ type: 'neutral', text: `🔮 <strong>Previsão:</strong> Estável (~${next3} em 3 dias).` });
    }
    if (streak >= 3) insights.push({ type: 'gain', text: `🔥 <strong>Streak:</strong> ${streak} dias sem queda!` });
    if (last.diff < 0) insights.push({ type: 'drop', text: `🔻 <strong>Queda:</strong> ${Math.abs(last.diff)} em ${fmtDate(last.date).substring(0, 5)} (${last.pct}%).` });
    else if (last.diff > 0) insights.push({ type: 'gain', text: `📈 <strong>Crescimento:</strong> +${last.diff} em ${fmtDate(last.date).substring(0, 5)} (+${last.pct}%).` });
    const consec = getConsecutiveDrops(logs);
    if (consec >= 2) insights.push({ type: 'drop', text: `⚠️ <strong>Alerta:</strong> ${consec} dias consecutivos com queda.` });
    if (totalGain > 0) insights.push({ type: 'gain', text: `✅ <strong>Saldo:</strong> +${totalGain} (${first.total > 0 ? parseFloat(((totalGain / first.total) * 100).toFixed(1)) : 'N/A'}%).` });
    else if (totalGain < 0) insights.push({ type: 'drop', text: `❌ <strong>Saldo negativo:</strong> ${totalGain} avaliações.` });
    if (drops.length > 0) { const bd = [...logs].sort((a, b) => a.diff - b.diff)[0]; insights.push({ type: 'drop', text: `📉 <strong>Maior queda:</strong> ${Math.min(...drops.map(l => l.diff))} em ${fmtDate(bd.date).substring(0, 5)}.` }); }
    if (gains.length > 0) { const bg = [...logs].sort((a, b) => b.diff - a.diff)[0]; insights.push({ type: 'gain', text: `🚀 <strong>Melhor dia:</strong> +${Math.max(...gains.map(l => l.diff))} em ${fmtDate(bg.date).substring(0, 5)}.` }); }
    if (ratingTrend < 0) insights.push({ type: 'warn', text: `⭐ <strong>Nota em queda:</strong> ${ratingLogs[ratingLogs.length - 2].rating} → ${ratingLogs[ratingLogs.length - 1].rating}.` });
    else if (ratingTrend > 0) insights.push({ type: 'gain', text: `⭐ <strong>Nota em alta:</strong> ${ratingLogs[ratingLogs.length - 2].rating} → ${ratingLogs[ratingLogs.length - 1].rating}.` });
    const dropRatio = Math.round((drops.length / logs.length) * 100);
    if (dropRatio > 30) insights.push({ type: 'warn', text: `📊 <strong>${dropRatio}% com queda</strong> — acima do normal.` });
    else if (dropRatio <= 10 && logs.length >= 5) insights.push({ type: 'neutral', text: `📊 <strong>Saudável:</strong> Apenas ${dropRatio}% com queda.` });

    const typeMap = { drop: 'insight-drop', gain: 'insight-gain', neutral: 'insight-neutral', warn: 'insight-warn' };
    list.innerHTML = insights.map(i => `<div class="insight-item ${typeMap[i.type]}">${i.text}</div>`).join('');
}

// ── WINDOW BINDINGS (para onclick no HTML) ──────────────────

window.__selectStore = (id) => selectStore(id, init);
window.__doLogout = () => doLogout(() => { logs = []; updateAll(); });
window.__showImageById = (id) => showImageById(id, logs);
window.__showNotes = (encoded) => showNotes(encoded);
window.__showImage = (src) => showImage(src);
window.__closeModal = (el) => closeModal(el);
window.__sortBy = (field) => sortBy(field);
window.__switchChart = (type) => switchChart(type, logs);
window.__setPeriod = (days, btn) => setPeriod(days, btn, logs);
window.__donutFocus = (type) => donutFocus(type, logs);
window.__renderChart = () => renderChart(currentChart, logs);
window.__exportCSV = () => exportCSV(logs);
window.__exportPDF = () => exportPDF(logs);
window.__shareResume = () => shareResume(logs);
window.__copyShare = () => copyShare();
window.__deleteRecord = (id) => deleteRecord(id);
window.__clearAllData = () => clearAllData();
window.__extractDataFromImage = () => extractDataFromImage();
window.__clearImage = () => clearImage();
window.__handleDragOver = (e) => handleDragOver(e);
window.__handleDragLeave = () => handleDragLeave();
window.__handleDrop = (e) => handleDrop(e);
window.__requestDateUnlock = () => requestDateUnlock();
window.__checkDatePw = () => checkDatePw();
window.__closePwModal = () => closePwModal();
window.__togglePwVisibility = () => togglePwVisibility();

// ── MONTH NAVIGATION BINDINGS ────────────────────────────────

window.__prevMonth = prevMonth;
window.__nextMonth = nextMonth;
window.__goToCurrentMonth = goToCurrentMonth;

// ── IMAGE INPUT ─────────────────────────────────────────────

const imageInput = document.getElementById('imageInput');
if (imageInput) imageInput.addEventListener('change', e => loadImageFile(e.target.files[0]));

// ── KEYBOARD SHORTCUTS ──────────────────────────────────────

initKeyboardShortcuts(
    () => form.dispatchEvent(new Event('submit', { cancelable: true })),
    () => exportCSV(logs),
    () => exportPDF(logs)
);

// ── BOOT ────────────────────────────────────────────────────

renderStoreList();
