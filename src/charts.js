// ═══════════════════════════════════════════════════════════════
// CHARTS - Main Chart, Donut, Period Comparison
// ═══════════════════════════════════════════════════════════════

import { fmtDate, linearRegression } from './utils.js';

export let currentChart = 'volume';
let periodFilter = 0;
let donutFocusMode = null;
let chartInstance = null;
let donutInstance = null;

// ── PERIOD FILTER ───────────────────────────────────────────

export function setPeriod(days, btn, logs) {
    periodFilter = days;
    document.querySelectorAll('.filter-btn').forEach(b => { b.classList.remove('active'); b.style.color = '#94a3b8'; });
    btn.classList.add('active');
    btn.style.color = '#ffffff';
    renderChart(currentChart, logs);
}

function getFilteredLogs(logs) {
    if (periodFilter === 0) return logs;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodFilter);
    return logs.filter(l => new Date(l.date) >= cutoff);
}

// ── CHART SWITCH ────────────────────────────────────────────

export function switchChart(type, logs) {
    currentChart = type;
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.style.color = '#94a3b8'; });
    const idx = ['volume', 'variacao', 'nota', 'pct', 'comparar'].indexOf(type);
    const btns = document.querySelectorAll('.tab-btn');
    if (btns[idx]) { btns[idx].classList.add('active'); btns[idx].style.color = '#ffffff'; }
    renderChart(type, logs);
}

// ── MAIN CHART ──────────────────────────────────────────────

export function renderChart(type, logs) {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const empty = document.getElementById('chartEmpty');
    const filtered = getFilteredLogs(logs);
    const showForecast = document.getElementById('forecastToggle')?.checked;

    if (filtered.length < 2) {
        empty.classList.remove('hidden');
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        return;
    }
    empty.classList.add('hidden');
    if (chartInstance) chartInstance.destroy();

    const labels = filtered.map(l => fmtDate(l.date).substring(0, 5));
    const gridColor = '#1e293b';
    const tickColor = '#475569';

    if (type === 'volume') {
        let fLabels = [], fData = [];
        if (showForecast) {
            const vals = filtered.map(l => l.total);
            const reg = linearRegression(vals);
            if (reg) {
                const lastDate = new Date(filtered[filtered.length - 1].date);
                for (let i = 1; i <= 3; i++) {
                    const d = new Date(lastDate);
                    d.setDate(d.getDate() + i);
                    fLabels.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`);
                    fData.push(Math.round(reg.slope * (vals.length - 1 + i) + reg.intercept));
                }
            }
        }
        const allLabels = [...labels, ...fLabels];
        const ptColors = filtered.map(l => l.diff < 0 ? '#ef4444' : l.diff > 0 ? '#3b82f6' : '#94a3b8');
        const datasets = [{
            label: 'Total', data: [...filtered.map(l => l.total), ...fData.map(() => null)],
            borderColor: '#3b82f6',
            backgroundColor: ctx2 => { const g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(59,130,246,0.43)'); g.addColorStop(1, 'rgba(59,130,246,0.08)'); return g; },
            borderWidth: 2.5, pointBackgroundColor: [...ptColors, ...fData.map(() => 'transparent')],
            pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 9, fill: true, tension: 0.35
        }];
        if (showForecast && fData.length > 0) {
            const conn = filtered[filtered.length - 1].total;
            datasets.push({ label: 'Previsão', data: [...filtered.map(() => null), conn, ...fData.slice(1)], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.33)', borderWidth: 2, borderDash: [6, 4], pointBackgroundColor: '#f97316', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5, fill: false, tension: 0.35 });
        }
        chartInstance = new Chart(ctx, { type: 'line', data: { labels: allLabels, datasets }, options: chartOptions('Volume', v => `${v} avaliações`, type, gridColor, tickColor, filtered) });
    } else if (type === 'variacao') {
        const diffs = filtered.map(l => l.diff);
        chartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Variação', data: diffs, backgroundColor: diffs.map(d => d < 0 ? 'rgba(239,68,68,0.83)' : d > 0 ? 'rgba(59,130,246,0.83)' : 'rgba(148,163,184,0.65)'), borderColor: diffs.map(d => d < 0 ? '#ef4444' : d > 0 ? '#3b82f6' : '#94a3b8'), borderWidth: 1.5, borderRadius: 6 }] }, options: chartOptions('Variação', v => (v > 0 ? '+' : '') + v + ' avaliações', type, gridColor, tickColor, filtered) });
    } else if (type === 'nota') {
        chartInstance = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Nota', data: filtered.map(l => l.rating), borderColor: '#f59e0b', backgroundColor: ctx2 => { const g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(245,158,11,0.41)'); g.addColorStop(1, 'rgba(245,158,11,0.08)'); return g; }, borderWidth: 2.5, pointBackgroundColor: '#f59e0b', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5, fill: true, tension: 0.35, spanGaps: true }] }, options: chartOptions('Nota', v => `${v} ★`, type, gridColor, tickColor, filtered) });
    } else if (type === 'pct') {
        const pcts = filtered.map(l => l.pct || 0);
        chartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: '%', data: pcts, backgroundColor: pcts.map(d => d < 0 ? 'rgba(239,68,68,0.83)' : d > 0 ? 'rgba(34,197,94,0.83)' : 'rgba(148,163,184,0.65)'), borderColor: pcts.map(d => d < 0 ? '#ef4444' : d > 0 ? '#22c55e' : '#94a3b8'), borderWidth: 1.5, borderRadius: 6 }] }, options: chartOptions('Variação %', v => (v > 0 ? '+' : '') + v + '%', type, gridColor, tickColor, filtered) });
    } else if (type === 'comparar') {
        renderComparisonChart(ctx, logs, gridColor, tickColor);
    }
}

function renderComparisonChart(ctx, logs, gridColor, tickColor) {
    const now = new Date();
    const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - 7);
    const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const thisWeek = logs.filter(l => new Date(l.date) >= thisWeekStart);
    const lastWeek = logs.filter(l => { const d = new Date(l.date); return d >= lastWeekStart && d < thisWeekStart; });

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const thisData = Array(7).fill(null);
    const lastData = Array(7).fill(null);

    thisWeek.forEach(l => { const d = new Date(l.date + 'T12:00:00'); thisData[d.getDay()] = l.total; });
    lastWeek.forEach(l => { const d = new Date(l.date + 'T12:00:00'); lastData[d.getDay()] = l.total; });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                { label: 'Semana Atual', data: thisData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 2.5, pointRadius: 5, fill: true, tension: 0.35, spanGaps: true },
                { label: 'Semana Anterior', data: lastData, borderColor: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', borderWidth: 2, borderDash: [5, 3], pointRadius: 4, fill: true, tension: 0.35, spanGaps: true }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 } } }, tooltip: { backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 12, cornerRadius: 10 } },
            scales: {
                y: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor }, border: { display: false } },
                x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11 } }, border: { display: false } }
            }
        }
    });
}

function chartOptions(label, tooltipFmt, type, gridColor, tickColor, filtered) {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 12, cornerRadius: 10, boxPadding: 4,
                callbacks: {
                    title: ctx => { const i = ctx[0].dataIndex; return i < filtered.length ? fmtDate(filtered[i].date) : 'Previsão'; },
                    label: ctx => tooltipFmt(ctx.parsed.y),
                    afterLabel: ctx => {
                        const i = ctx.dataIndex;
                        if (i < filtered.length) {
                            const l = filtered[i]; const lines = [];
                            if (type === 'volume' && l.diff !== 0) lines.push(`Variação: ${l.diff > 0 ? '+' : ''}${l.diff} (${l.pct}%)`);
                            if (l.notes) lines.push(`📝 ${l.notes}`);
                            return lines;
                        }
                        return '';
                    }
                }
            }
        },
        scales: {
            y: { beginAtZero: type === 'variacao' || type === 'pct', ticks: { precision: type === 'nota' ? 1 : type === 'pct' ? 1 : 0, color: tickColor, font: { size: 11 } }, grid: { color: gridColor }, border: { display: false } },
            x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11 } }, border: { display: false } }
        }
    };
}

// ── DONUT ───────────────────────────────────────────────────

export function renderDonut(logs) {
    const gains = logs.filter(l => l.diff > 0).length;
    const drops = logs.filter(l => l.diff < 0).length;
    const neutral = logs.filter(l => l.diff === 0).length;
    const total = logs.length;
    const gainPct = total > 0 ? Math.round((gains / total) * 100) : 0;
    const dropPct = total > 0 ? Math.round((drops / total) * 100) : 0;
    const neutralPct = total > 0 ? Math.round((neutral / total) * 100) : 0;

    document.getElementById('donutGain').textContent = gains;
    document.getElementById('donutDrop').textContent = drops;
    document.getElementById('donutNeutral').textContent = neutral;
    document.getElementById('donutMain').textContent = total;
    document.getElementById('donutSubLabel').textContent = total > 0 ? 'monitorados' : '';
    document.getElementById('donutGainPct').textContent = total > 0 ? gainPct + '%' : '';
    document.getElementById('donutDropPct').textContent = total > 0 ? dropPct + '%' : '';
    document.getElementById('donutNeutralPct').textContent = total > 0 ? neutralPct + '%' : '';
    document.getElementById('donutBarGain').style.width = gainPct + '%';
    document.getElementById('donutBarDrop').style.width = dropPct + '%';
    document.getElementById('donutBarNeutral').style.width = neutralPct + '%';

    const ctx = document.getElementById('donutChart').getContext('2d');
    if (donutInstance) donutInstance.destroy();
    if (total === 0) return;

    const canvas = document.getElementById('donutChart');
    const isMobile = window.innerWidth <= 640;
    const donutSize = isMobile ? 170 : 210;
    canvas.width = donutSize; canvas.height = donutSize;
    const wrapper = canvas.closest('.donut-wrapper');
    if (wrapper) { wrapper.style.width = donutSize + 'px'; wrapper.style.height = donutSize + 'px'; }

    donutInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Ganhos', 'Quedas', 'Neutros'], datasets: [{ data: [gains || 0.001, drops || 0.001, neutral || 0.001], backgroundColor: gains === 0 && drops === 0 && neutral === 0 ? ['#475569'] : ['#4ade80', '#f87171', '#64748b'], borderWidth: gains === 0 && drops === 0 && neutral === 0 ? 0 : 4, borderColor: '#1e293b', hoverOffset: 12 }] },
        options: {
            responsive: false, maintainAspectRatio: false, cutout: '70%',
            animation: { animateRotate: true, duration: 800, easing: 'easeOutQuart' },
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 12, cornerRadius: 10, callbacks: { label: ctx => { const real = [gains, drops, neutral][ctx.dataIndex]; return `${ctx.label}: ${real} dia(s) (${total > 0 ? Math.round(real / total * 100) : 0}%)`; } } } },
            onClick: (e, elements) => { if (!elements.length) { donutFocus(null, logs); return; } donutFocus(['gain', 'drop', 'neutral'][elements[0].index], logs); }
        }
    });
}

export function donutFocus(type, logs) {
    donutFocusMode = donutFocusMode === type ? null : type;
    const cards = { gain: 'donutCardGain', drop: 'donutCardDrop', neutral: 'donutCardNeutral' };
    const labels = { gain: '📈 Ganhos', drop: '🔻 Quedas', neutral: '● Neutros' };
    const counts = { gain: logs.filter(l => l.diff > 0).length, drop: logs.filter(l => l.diff < 0).length, neutral: logs.filter(l => l.diff === 0).length };
    const total = logs.length;
    Object.values(cards).forEach(id => { const el = document.getElementById(id); el.style.boxShadow = ''; el.style.transform = ''; el.style.transition = 'all 0.2s'; });
    if (donutFocusMode) {
        const el = document.getElementById(cards[donutFocusMode]);
        const shadows = { gain: '0 0 0 2px #4ade80', drop: '0 0 0 2px #f87171', neutral: '0 0 0 2px #d1d5db' };
        el.style.boxShadow = shadows[donutFocusMode]; el.style.transform = 'scale(1.07)';
        const pct = total > 0 ? Math.round((counts[donutFocusMode] / total) * 100) : 0;
        document.getElementById('donutMain').textContent = counts[donutFocusMode];
        document.getElementById('donutSubLabel').textContent = labels[donutFocusMode] + ' · ' + pct + '%';
    } else {
        donutFocusMode = null;
        document.getElementById('donutMain').textContent = total;
        document.getElementById('donutSubLabel').textContent = total > 0 ? 'monitorados' : '';
    }
}
