import '../css/styles.css';
import '../css/components.css';
import '../css/animations.css';

// ═══════════════════════════════════════════════════════════════
// APP - Main: Form, KPIs, Table, Insights, Init, Master Update
// ═══════════════════════════════════════════════════════════════

import { showToast, showConfirm, showImageById, showImage, showNotes, closeModal, startClock } from './ui';
import { saveLogEntry, deleteRecordFromDB, clearAllDataFromDB, getDB } from './firebase';
import { renderStoreList, selectStore, doLogout, requestDateUnlock, checkDatePw, closePwModal, togglePwVisibility } from './auth';
import { getCurrentStore, isDateUnlocked, getLogs, setLogs } from './state';
import { renderChart, renderDonut, switchChart, setPeriod, donutFocus, currentChart } from './charts';
import { currentBase64Image, loadImageFile, clearImage, extractDataFromImage, extractFromClipboard, handleDragOver, handleDragLeave, handleDrop } from './ocr/ocr';
import { exportCSV, exportPDF, shareResume, copyShare } from './export';
import { initKeyboardShortcuts } from './keys';
import { fmtDate, calcHealth, calcStreak, getConsecutiveDrops, linearRegression } from './utils';
import type { LogEntry, Store } from '../types';

declare global {
  interface Window {
    __updateAll: (newLogs: LogEntry[]) => void;
    __currentStore: Store | null;
    __selectStore: (id: string) => void;
    __doLogout: () => void;
    __showImageById: (id: number) => void;
    __showNotes: (encoded: string) => void;
    __showImage: (src: string) => void;
    __closeModal: (el: HTMLElement) => void;
    __sortBy: (field: string) => void;
    __switchChart: (type: string) => void;
    __setPeriod: (days: number, btn: HTMLElement) => void;
    __donutFocus: (type: string) => void;
    __deleteRecord: (id: string | number) => void;
    __clearAllData: () => void;
    __exportCSV: () => void;
    __exportPDF: () => void;
    __shareResume: () => void;
    __copyShare: () => void;
    __renderChart: () => void;
    __requestDateUnlock: () => void;
    __checkDatePw: () => void;
    __closePwModal: () => void;
    __togglePwVisibility: () => void;
    __prevMonth: () => void;
    __nextMonth: () => void;
    __goToCurrentMonth: () => void;
    __resetSubmitState: () => void;
  // External libraries loaded via CDN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tesseract: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firebase: any;
  }
}

// ── STATE ───────────────────────────────────────────────────

let logs: LogEntry[] = [];
let sortField: string = 'date';
let sortDir: number = -1;
let selectedMonth: number = new Date().getMonth();
let selectedYear: number = new Date().getFullYear();
let _lastTableHash: string = '';
let _isSubmitting: boolean = false;

const MESES: string[] = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ── DOM REFS ────────────────────────────────────────────────

const form = document.getElementById('recordForm') as HTMLFormElement;
const dateInputEl = document.getElementById('dateInput') as HTMLInputElement;
const totalInput = document.getElementById('totalInput') as HTMLInputElement;
const ratingInput = document.getElementById('ratingInput') as HTMLInputElement;
const notesInput = document.getElementById('notesInput') as HTMLTextAreaElement;
const tableBody = document.getElementById('tableBody') as HTMLElement;

// ── INIT ────────────────────────────────────────────────────

function updateMonthLabel() {
    const ml = document.getElementById('monthLabel');
    if(ml) ml.textContent = `${MESES[selectedMonth]} ${selectedYear}`;
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

/**
 * Função de inicialização chamada após login ou reload
 * @param newLogs Registros vindos do banco de dados
 */
function init(newLogs: LogEntry[] = []) {
    console.log('[app] init disparado. Registros:', newLogs.length);
    logs = newLogs;
    setLogs(newLogs);
    
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    
    if(dateInputEl) dateInputEl.value = `${yyyy}-${mo}-${dd}`;
    const dateDisplay = document.getElementById('dateDisplay') as HTMLInputElement;
    if (dateDisplay) dateDisplay.value = `${dd}/${mo}/${yyyy}`;
    
    startClock(() => isDateUnlocked());
    updateMonthLabel();
    updateAll();
}

// ── MASTER UPDATE ───────────────────────────────────────────

function updateAll() {
    // Sincroniza logs locais com o estado global se necessário
    logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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

// Bindings globais para callbacks que vêm de outros módulos
window.__updateAll = (newLogs: LogEntry[]) => { logs = newLogs; updateAll(); };

if (!window.hasOwnProperty('__currentStore')) {
    Object.defineProperty(window, '__currentStore', { 
        get: () => getCurrentStore(),
        configurable: true
    });
}

// ── SORT ────────────────────────────────────────────────────

function sortBy(field: string) {
    if (sortField === field) sortDir *= -1; else { sortField = field; sortDir = -1; }
    renderTable();
}

// ── FORM SUBMIT ─────────────────────────────────────────────

window.__resetSubmitState = () => {
    _isSubmitting = false;
    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (btn) btn.disabled = false;
};

if (form) {
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (_isSubmitting) { console.warn('[submit] interceptado — enviando...'); return; }
        _isSubmitting = true;
        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (submitBtn) submitBtn.disabled = true;
        try {
            if (!getCurrentStore()) { showToast('Selecione uma loja primeiro.', 'error'); return; }
            const date = dateInputEl.value;
            const timeInput = document.getElementById('timeInput') as HTMLInputElement;
            const time = timeInput.value;
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
            const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const prevLog = sorted.filter(l => l.date < date).pop();
            const diff = prevLog ? total - prevLog.total : 0;
            const pct = prevLog && prevLog.total !== 0 ? parseFloat(((diff / prevLog.total) * 100).toFixed(2)) : 0;

            const newEntry: LogEntry = { id: logId, date, time, total, rating: isNaN(rating) ? null : rating, diff, pct, notes, image: currentBase64Image || null, imageUrl: null };
            
            const loadingModal = document.getElementById('loadingModal');
            if (loadingModal) loadingModal.classList.remove('hidden');

            showToast('⏳ Salvando...', 'success');
            const s = getCurrentStore();
            if(s) await saveLogEntry(newEntry, s);
            
            // Re-renderização e sincronismo são automáticos via listener do Firebase (listenToStore)
            totalInput.value = ''; ratingInput.value = ''; notesInput.value = '';
            clearImage();
            
            const next = new Date(date + 'T12:00:00'); next.setDate(next.getDate() + 1);
            const ndd = String(next.getDate()).padStart(2, '0');
            const nmo = String(next.getMonth() + 1).padStart(2, '0');
            const nyyyy = next.getFullYear();
            if (!isDateUnlocked()) { 
                dateInputEl.value = `${nyyyy}-${nmo}-${ndd}`; 
                const _ddDisplay = document.getElementById('dateDisplay') as HTMLInputElement;
                if(_ddDisplay) _ddDisplay.value = `${ndd}/${nmo}/${nyyyy}`; 
            }
            
            if (loadingModal) loadingModal.classList.add('hidden');
            showToast('✅ Registro salvo!', 'success');
        } catch (err) {
            console.error('Firestore save error:', err);
            const loadingModal = document.getElementById('loadingModal');
            if (loadingModal) loadingModal.classList.add('hidden');
            showToast('❌ Erro ao salvar.', 'error');
        } finally {
            _isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// ── DELETE / CLEAR ──────────────────────────────────────────

async function deleteRecord(id: string | number) {
    const ok = await showConfirm('Remover registro?', 'Esta ação não pode ser desfeita.');
    if (!ok) return;
    const s = getCurrentStore();
    if(s) await deleteRecordFromDB(id, s);
    showToast('Registro removido.', 'success');
}

async function clearAllData() {
    const ok = await showConfirm('Apagar TUDO?', 'Todos os registros serão permanentemente removidos.');
    if (!ok) return;
    const s = getCurrentStore();
    if(s) await clearAllDataFromDB(s);
    logs = [];
    setLogs(logs);
    updateAll();
    showToast('Dados removidos.', 'info');
}

// ── KPIs ────────────────────────────────────────────────────

function renderKPIs() {
    const kpiRow = document.getElementById('kpiRow');
    if (logs.length === 0 || !kpiRow) { if(kpiRow) kpiRow.classList.add('hidden'); return; }
    const last = logs[logs.length - 1], first = logs[0];
    const totalGrowth = last.total - first.total;
    const drops = logs.filter(l => l.diff < 0);
    const Gains = logs.filter(l => l.diff > 0);
    const biggest = [...logs].sort((a, b) => a.diff - b.diff)[0];
    const ratingLogs = logs.filter(l => l.rating !== null);
    const avgRating = ratingLogs.length > 0 ? ratingLogs.reduce((s, l) => s + (l.rating as number), 0) / ratingLogs.length : 0;
    const streak = calcStreak(logs);
    const avgGainStr = logs.length > 1 ? (totalGrowth / (logs.length - 1)).toFixed(1) : "0";

    const kpis = [
        { label: 'Total Atual', value: last.total.toLocaleString(), sub: totalGrowth >= 0 ? `<span class="font-semibold" style="color:#4ade80;">+${totalGrowth} no período</span>` : `<span class="font-semibold" style="color:#f87171;">${totalGrowth} no período</span>`, icon: '⭐' },
        { label: 'Última Variação', value: (last.diff > 0 ? '+' : '') + last.diff, sub: last.diff < 0 ? `<span style="color:#f87171;">${last.pct}% · Queda</span>` : last.diff > 0 ? `<span style="color:#4ade80;">+${last.pct}% · Crescimento</span>` : `<span style="color:#94a3b8;">Estável</span>`, icon: last.diff < 0 ? '📉' : '📈' },
        { label: 'Quedas', value: drops.length, sub: drops.length > 0 && biggest ? `<span style="color:#f87171;">Maior: ${biggest.diff} em ${fmtDate(biggest.date).substring(0, 5)}</span>` : `<span style="color:#4ade80;">Nenhuma queda!</span>`, icon: '🔻' }
    ];
    
    kpis.push({ label: 'Nota Média', value: ratingLogs.length > 0 ? avgRating.toFixed(1) : '—', sub: ratingLogs.length > 0 ? `<span style="color:#fbbf24;">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5 - Math.round(avgRating))}</span>` : '<span style="color:#94a3b8;">Sem notas</span>', icon: '🌟' });
    kpis.push({ label: 'Média/Dia', value: (Number(avgGainStr) > 0 ? '+' : '') + avgGainStr, sub: `<span style="color:#94a3b8;">🔥 Streak: ${streak} dia(s)</span>`, icon: '📊' });

    kpiRow.classList.remove('hidden');
    kpiRow.innerHTML = kpis.map(k => `
        <div class="kpi-card glass rounded-2xl p-5 fade-up">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-xs font-semibold mb-1" style="color:#94a3b8;">${k.label}</p>
                    <p class="text-3xl font-black leading-tight" style="color:#ffffff;">${k.value}</p>
                    <p class="text-xs mt-2" style="color:#94a3b8;">${k.sub}</p>
                </div>
                <span class="text-3xl shrink-0 float">${k.icon}</span>
            </div>
        </div>`
    ).join('');
}

// ── HEADER STATS ────────────────────────────────────────────

function updateHeaderStats() {
    const hs = document.getElementById('headerStats');
    if (logs.length === 0 || !hs) { if(hs) hs.classList.add('hidden'); return; }
    hs.classList.remove('hidden');
    const hStreak = document.getElementById('hStreak');
    const streak = calcStreak(logs);
    if(hStreak) {
        hStreak.textContent = String(streak);
        if (streak >= 3) hStreak.classList.add('text-orange-400'); else hStreak.classList.remove('text-orange-400');
    }
    const last = logs[logs.length - 1];
    const hTotal = document.getElementById('hTotal');
    if(hTotal) hTotal.textContent = last.total.toLocaleString();
    const tw = document.getElementById('hTrendWrap');
    const ht = document.getElementById('hTrend');
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    if (saveBtn) saveBtn.disabled = false;
    if (last.diff < 0 && tw && ht) { 
        tw.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-red-400 bg-red-500/10 border-red-500/20'; 
        ht.innerHTML = `<span class="font-bold text-xs">${last.diff} (${last.pct}%) 📉</span>`; 
    }
    else if (last.diff > 0 && tw && ht) { 
        tw.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-green-400 bg-green-500/10 border-green-500/20'; 
        ht.innerHTML = `<span class="font-bold text-xs">+${last.diff} (+${last.pct}%) 📈</span>`; 
    }
    else if(tw && ht) { 
        tw.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-slate-400 bg-slate-500/10 border-slate-500/20'; 
        ht.innerHTML = `<span class="text-xs">— Estável</span>`; 
    }
}

function updateHealthBadge() {
    const badge = document.getElementById('healthBadge');
    const health = calcHealth(logs);
    if (!health || !badge) { if(badge) badge.classList.add('hidden'); return; }
    badge.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm ${health.cls}`;
    const healthIcon = document.getElementById('healthIcon');
    const healthLabel = document.getElementById('healthLabel');
    if(healthIcon) healthIcon.textContent = health.icon;
    if(healthLabel) healthLabel.textContent = health.label;
    badge.classList.remove('hidden');
}

function updateWeekly() {
    const weeklyBar = document.getElementById('weeklyBar');
    const wkCurrent = document.getElementById('wkCurrent');
    const wkPrev = document.getElementById('wkPrev');
    if (logs.length < 2) { if(weeklyBar) weeklyBar.classList.add('hidden'); return; }
    const cut1 = new Date(); cut1.setDate(cut1.getDate() - 7);
    const cut2 = new Date(); cut2.setDate(cut2.getDate() - 14);
    const curr = logs.filter(l => new Date(l.date) >= cut1);
    const prev = logs.filter(l => { const d = new Date(l.date); return d >= cut2 && d < cut1; });
    const cTotal = curr.reduce((s, l) => s + Math.max(0, l.diff), 0);
    const pTotal = prev.reduce((s, l) => s + Math.max(0, l.diff), 0);
    const diff = cTotal - pTotal;
    const dropCount = curr.filter(l => l.diff < 0).length;
    
    if(weeklyBar) weeklyBar.classList.remove('hidden');
    if(wkCurrent) wkCurrent.textContent = `+${cTotal}`;
    if(wkPrev) wkPrev.textContent = `+${pTotal}`;
    const diffEl = document.getElementById('wkDiff');
    if (diffEl) {
        diffEl.textContent = (diff >= 0 ? '+' : '') + diff;
        diffEl.style.color = diff >= 0 ? '#4ade80' : '#f87171';
    }
    const wkDropsEl = document.getElementById('wkDrops');
    if(wkDropsEl) wkDropsEl.textContent = String(dropCount);
}

function updateStreak() {
    const streak = calcStreak(logs);
    const badge = document.getElementById('streakBadge');
    if (!badge) return;
    if (streak >= 2) { 
        badge.classList.remove('hidden'); 
        badge.classList.add('flex'); 
        const count = document.getElementById('streakCount');
        if(count) count.textContent = String(streak); 
        if (streak >= 5) badge.classList.add('streak-glow'); 
    }
    else { badge.classList.add('hidden'); }
}

// ── TABLE ───────────────────────────────────────────────────

function renderTable() {
    if(!tableBody) return;
    const tableHash = `${selectedMonth}-${selectedYear}-${sortField}-${sortDir}-${logs.map(l => `${l.id}:${l.diff}`).join(',')}`;
    if (tableHash === _lastTableHash) return;
    _lastTableHash = tableHash;

    let data = logs.filter(l => {
        const d = new Date(l.date + 'T12:00:00');
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    
  data.sort((a, b) => {
    if (sortField === 'date') return sortDir * (new Date(a.date).getTime() - new Date(b.date).getTime());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valA = (a as any)[sortField] as number ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valB = (b as any)[sortField] as number ?? 0;
    return sortDir * (Number(valA) - Number(valB));
  });

    // Filtros de contagem para o cabeçalho da tabela (referente ao mês selecionado)
    const dc = document.getElementById('dropCount'), gc = document.getElementById('gainCount');
    const tgb = document.getElementById('totalGainedBadge'), tlb = document.getElementById('totalLostBadge');
    
    if (dc) { 
        const num = data.filter(l => l.diff < 0).length;
        const nEl = document.getElementById('dropCountNum'), pEl = document.getElementById('dropCountPlural');
        if(nEl) nEl.textContent = String(num);
        if(pEl) pEl.textContent = num > 1 ? 's' : '';
        num > 0 ? dc.classList.remove('hidden', 'flex') : dc.classList.add('hidden');
        if (num > 0) dc.classList.add('flex');
    }
    if (gc) { 
        const num = data.filter(l => l.diff > 0).length;
        const nEl = document.getElementById('gainCountNum'), pEl = document.getElementById('gainCountPlural');
        if(nEl) nEl.textContent = String(num);
        if(pEl) pEl.textContent = num > 1 ? 's' : '';
        num > 0 ? gc.classList.remove('hidden', 'flex') : gc.classList.add('hidden');
        if (num > 0) gc.classList.add('flex');
    }
    if (tgb) {
        const sum = data.reduce((acc, l) => acc + (l.diff > 0 ? l.diff : 0), 0);
        const sEl = document.getElementById('totalGainedNum');
        if(sEl) sEl.textContent = String(sum);
        sum > 0 ? tgb.classList.remove('hidden', 'flex') : tgb.classList.add('hidden');
        if (sum > 0) tgb.classList.add('flex');
    }
    if (tlb) {
        const sum = data.reduce((acc, l) => acc + (l.diff < 0 ? Math.abs(l.diff) : 0), 0);
        const sEl = document.getElementById('totalLostNum');
        if(sEl) sEl.textContent = String(sum);
        sum > 0 ? tlb.classList.remove('hidden', 'flex') : tlb.classList.add('hidden');
        if (sum > 0) tlb.classList.add('flex');
    }

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="px-5 py-12 text-center text-sm text-slate-500">Nenhum registro encontrado.</td></tr>`;
        const mc = document.getElementById('mobileCards');
        if (mc) mc.innerHTML = `<div class="text-center py-8 text-slate-500">Nenhum registro.</div>`;
        return;
    }

    tableBody.innerHTML = data.map((log, i) => {
        const isDrop = log.diff < 0, isGain = log.diff > 0;
        const rowCls = isDrop ? 'row-drop' : isGain ? 'row-gain' : '';
        const diffBadge = log.diff !== 0 ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style="${isDrop ? 'background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3)' : 'background:rgba(34,197,94,0.2);color:#86efac;border:1px solid rgba(34,197,94,0.3)'}">${isDrop ? '▼' : '▲'} ${Math.abs(log.diff)}</span>` : `<span style="color:#94a3b8;">—</span>`;
        const pctBadge = log.pct ? `<span class="text-xs font-bold" style="${isDrop ? 'color:#f87171' : 'color:#4ade80'}">${log.pct > 0 ? '+' : ''}${log.pct}%</span>` : `<span style="color:#94a3b8;">—</span>`;
        const statusBadge = isDrop ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style="background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">🔻 Queda</span>` : isGain ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style="background:rgba(34,197,94,0.2);color:#86efac;border:1px solid rgba(34,197,94,0.3);">📈 Ganho</span>` : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.25);">● Neutro</span>`;
        const stars = log.rating ? `<span class="flex items-center gap-1 font-semibold text-xs" style="color:#fbbf24;">${log.rating}<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg></span>` : `<span style="color:#94a3b8;">—</span>`;
        const notesCell = log.notes ? `<button onclick="window.__showNotes('${encodeURIComponent(log.notes)}')" class="max-w-28 truncate block text-xs text-blue-400 hover:text-blue-300 underline text-left">${log.notes.substring(0,20)}${log.notes.length > 20 ? '…' : ''}</button>` : `<span style="color:#94a3b8;">—</span>`;
        
        return `<tr class="hover:brightness-95 transition-all fade-up ${rowCls}" style="animation-delay:${i * 12}ms; border-color: rgba(255,255,255,0.05);">
            <td class="px-5 py-3 whitespace-nowrap"><span class="text-sm font-semibold" style="color:#e2e8f0;">${fmtDate(log.date).substring(0, 5)}</span><span class="text-xs ml-1" style="color:#64748b;">${log.time || ''}</span></td>
            <td class="px-5 py-3 whitespace-nowrap text-sm font-black" style="color:#ffffff;">${log.total.toLocaleString()}</td>
            <td class="px-5 py-3 whitespace-nowrap">${stars}</td>
            <td class="px-5 py-3 whitespace-nowrap">${diffBadge}</td>
            <td class="px-5 py-3 whitespace-nowrap">${pctBadge}</td>
            <td class="px-5 py-3 whitespace-nowrap">${statusBadge}</td>
            <td class="px-5 py-3 whitespace-nowrap">${notesCell}</td>
            <td class="px-5 py-3 whitespace-nowrap">${(log.image || log.imageUrl) ? `<button onclick="window.__showImageById(${log.id})" class="text-blue-400 hover:text-blue-300 text-xs font-semibold underline">Ver Print</button>` : `<span style="color:#94a3b8;" class="text-xs">—</span>`}</td>
        </tr>`;
    }).join('');

    // Mobile Cards logic...
    const mc = document.getElementById('mobileCards');
    if (mc) {
        mc.innerHTML = data.map((log, i) => {
            const isDrop = log.diff < 0, isGain = log.diff > 0;
            const statusColor = isDrop ? '#f87171' : isGain ? '#4ade80' : '#94a3b8';
            return `<div class="mobile-card px-4 py-3 rounded-xl bg-white/5 border border-white/5 mb-3 fade-up" style="animation-delay:${i * 20}ms">
                <div class="flex justify-between items-center mb-2"><span class="text-sm font-bold text-slate-200">${fmtDate(log.date).substring(0, 5)}</span><span class="text-xs font-bold" style="color:${statusColor}">${isDrop ? '🔻 Queda' : isGain ? '📈 Crescimento' : '● Estável'}</span></div>
                <div class="flex justify-between items-end"><div><div class="text-[10px] text-slate-500 uppercase">Total</div><div class="text-lg font-black text-white">${log.total.toLocaleString()}</div></div><div class="text-right"> <div class="text-[10px] text-slate-500 uppercase">Variação</div><div class="text-sm font-bold" style="color:${statusColor}">${log.diff > 0 ? '+' : ''}${log.diff} (${log.pct}%)</div> </div></div>
            </div>`;
        }).join('');
    }
}

// ── INSIGHTS ────────────────────────────────────────────────

function renderInsights() {
    const list = document.getElementById('insightsList');
    if (!list) return;
    if (logs.length < 2) { list.innerHTML = `<p class="text-xs text-slate-500">Dados insuficientes para análise.</p>`; return; }
    
    const insights = [];
    const last = logs[logs.length - 1], first = logs[0];
    const totalGain = last.total - first.total;
    const gainPct = first.total > 0 ? Math.round((totalGain / first.total) * 100) : 0;
    
    const vals = logs.map(l => l.total);
    const reg = linearRegression(vals);
    if (reg) {
        const pred = Math.round(reg.slope * (vals.length + 2) + reg.intercept);
        insights.push({ type: 'gain', text: `🔮 <strong>Previsão:</strong> Tendência ${reg.slope >= 0 ? 'positiva' : 'negativa'}. ~${pred} em 3 dias.` });
    }

    insights.push({ type: 'gain', text: `✅ <strong>Saldo:</strong> +${totalGain} (${gainPct}%).` });

    const sortedByDiff = [...logs].sort((a, b) => b.diff - a.diff);
    const bestDay = sortedByDiff[0];
    if (bestDay && bestDay.diff > 0) {
        insights.push({ type: 'gain', text: `🚀 <strong>Melhor dia:</strong> +${bestDay.diff} em ${fmtDate(bestDay.date).substring(0,5)}.` });
    }

    const drops = logs.filter(l => l.diff < 0).length;
    const dropPct = Math.round((drops / logs.length) * 100);
    insights.push({ type: 'neutral', text: `📊 <strong>Saudável:</strong> Apenas ${dropPct}% com queda.` });

    const typeMap: Record<string, string> = { drop: 'insight-drop', gain: 'insight-gain', warn: 'insight-warn', neutral: 'insight-neutral' };
    list.innerHTML = insights.map(i => `<div class="insight-item ${typeMap[i.type] || 'insight-neutral'} text-sm py-2 px-3 rounded-lg bg-white/5 border border-white/5 mb-2">${i.text}</div>`).join('');
}

// ── WINDOW BINDINGS (onclick/global) ───────────────────────

window.__selectStore = (id: string) => selectStore(id, init);
window.__doLogout = () => doLogout(() => { logs = []; updateAll(); });
window.__showImageById = (id: number) => showImageById(id, logs);
window.__showNotes = (encoded: string) => showNotes(encoded);
window.__showImage = (src: string) => showImage(src);
window.__closeModal = (el: HTMLElement) => closeModal(el);
window.__sortBy = (field: string) => sortBy(field);
window.__switchChart = (type: string) => { switchChart(type, logs); };
window.__setPeriod = (days: number, btn: HTMLElement) => { setPeriod(days, btn, logs); };
window.__donutFocus = (type: string) => { donutFocus(type, logs); };
window.__deleteRecord = (id: string | number) => deleteRecord(id);
window.__clearAllData = () => clearAllData();
const getScopedData = () => {
    const scope = (document.getElementById('exportScope') as HTMLSelectElement)?.value || 'all';
    if (scope === 'all') return logs;
    if (scope === 'month') {
        return logs.filter(l => {
            const d = new Date(l.date + 'T12:00:00');
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
    }
    if (scope === 'year') {
        return logs.filter(l => {
            const d = new Date(l.date + 'T12:00:00');
            return d.getFullYear() === selectedYear;
        });
    }
    return logs;
};

window.__exportCSV = () => exportCSV(getScopedData());
window.__exportPDF = () => exportPDF(getScopedData());
window.__shareResume = () => shareResume(getScopedData());
window.__copyShare = () => copyShare();
window.__renderChart = () => renderChart(currentChart, logs);

window.__requestDateUnlock = () => requestDateUnlock();
window.__checkDatePw = () => checkDatePw();
window.__closePwModal = () => closePwModal();
window.__togglePwVisibility = () => togglePwVisibility();

window.__prevMonth = prevMonth;
window.__nextMonth = nextMonth;
window.__goToCurrentMonth = goToCurrentMonth;

// ── IMAGE INPUT ─────────────────────────────────────────────

const imageInput = document.getElementById('imageInput') as HTMLInputElement;
if (imageInput) imageInput.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) loadImageFile(target.files[0]);
});

// ── KEYBOARD SHORTCUTS ──────────────────────────────────────

initKeyboardShortcuts(
    () => { if(form) form.dispatchEvent(new Event('submit', { cancelable: true })); },
    () => exportCSV(logs),
    () => exportPDF(logs)
);

// ── BOOT ────────────────────────────────────────────────────

// Inicializa a lista de lojas passando o callback que conecta ao selectStore
renderStoreList((id) => selectStore(id, init));

// Auto-restauração da loja
const _savedStore = localStorage.getItem('lastStoreId');
if (_savedStore) {
    console.log(`[app] restaurando sessão: ${_savedStore}`);
    // Pequeno atraso para garantir que o DOM esteja pronto
    setTimeout(() => {
        window.__selectStore(_savedStore);
    }, 200);
}
