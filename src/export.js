// ═══════════════════════════════════════════════════════════════
// EXPORT - CSV, PDF, Share
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui.js';
import { fmtDate, calcHealth, calcStreak, getConsecutiveDrops } from './utils.js';

export function exportCSV(logs) {
    if (logs.length === 0) { showToast('Nenhum dado para exportar.', 'error'); return; }
    const sep = ';';
    const cols = ['Data', 'Horário', 'Total de Avaliações', 'Nota Média', 'Variação (Qtd)', 'Variação (%)', 'Status', 'Observações'];
    const header = cols.join(sep);
    const rows = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date)).map(l => {
        const st = l.diff < 0 ? 'Queda' : l.diff > 0 ? 'Ganho' : 'Neutro';
        const pctFmt = l.pct != null ? (l.pct > 0 ? '+' : '') + l.pct + '%' : '';
        const diffFmt = l.diff > 0 ? '+' + l.diff : String(l.diff);
        const safe = v => `"${String(v || '').replace(/"/g, '""')}"`;
        return [safe(fmtDate(l.date)), safe(l.time || ''), l.total, l.rating != null ? l.rating : '', diffFmt, pctFmt, st, safe(l.notes || '')].join(sep);
    }).join('\r\n');
    const blob = new Blob(['\uFEFF' + header + '\r\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `avaliacoes_google_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('📥 CSV exportado!', 'success');
}

export function exportPDF(logs) {
    if (logs.length === 0) { showToast('Nenhum dado para exportar.', 'error'); return; }
    const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last = sorted[sorted.length - 1], first = sorted[0];
    const drops = sorted.filter(l => l.diff < 0), gains = sorted.filter(l => l.diff > 0);
    const health = calcHealth(logs);
    const rows = sorted.map(l => {
        const st = l.diff < 0 ? '🔻 Queda' : l.diff > 0 ? '📈 Ganho' : '● Neutro';
        return `<tr style="background:${l.diff < 0 ? '#fff5f5' : l.diff > 0 ? '#f0fdf4' : '#fff'}">
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${fmtDate(l.date)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${l.time || '-'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700">${l.total}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${l.rating ?? '-'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;color:${l.diff < 0 ? '#ef4444' : l.diff > 0 ? '#22c55e' : '#94a3b8'}">${l.diff > 0 ? '+' : ''}${l.diff}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:${l.diff < 0 ? '#ef4444' : l.diff > 0 ? '#22c55e' : '#94a3b8'}">${l.pct > 0 ? '+' : ''}${l.pct ?? 0}%</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${st}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b">${l.notes || '-'}</td>
        </tr>`;
    }).join('');
    const totalGained = gains.reduce((s, l) => s + l.diff, 0);
    const totalLost = Math.abs(drops.reduce((s, l) => s + l.diff, 0));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#1e293b}h1{color:#1e40af}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f8fafc;padding:8px 10px;text-align:left;font-weight:600;color:#64748b;border-bottom:2px solid #e2e8f0}.kpi{display:inline-block;background:#f8fafc;border-radius:8px;padding:12px 20px;margin:6px;min-width:120px}.kn{font-size:24px;font-weight:800;color:#1e40af}.kl{font-size:11px;color:#64748b;margin-top:2px}</style></head><body>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <div style="background:#2563eb;color:#fff;padding:8px 14px;border-radius:10px;font-weight:800;font-size:18px">📊</div>
        <div><h1 style="margin:0;font-size:20px">Relatório de Avaliações Google</h1><p style="margin:2px 0 0;font-size:12px;color:#64748b">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
        <div style="margin-left:auto;background:${health?.cls?.includes('critico') ? '#ef4444' : health?.cls?.includes('regular') ? '#f59e0b' : '#22c55e'};color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700">${health?.icon} ${health?.label || '—'}</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;margin-bottom:24px">
        <div class="kpi"><div class="kn">${last.total}</div><div class="kl">⭐ Total Atual</div></div>
        <div class="kpi"><div class="kn" style="color:${(last.total - first.total) >= 0 ? '#16a34a' : '#dc2626'}">${(last.total - first.total) >= 0 ? '+' : ''}${last.total - first.total}</div><div class="kl">📊 Saldo</div></div>
        <div class="kpi"><div class="kn" style="color:#f59e0b">${last.rating ?? '-'}</div><div class="kl">🌟 Nota</div></div>
        <div class="kpi"><div class="kn" style="color:#dc2626">${drops.length}</div><div class="kl">🔻 Quedas</div></div>
        <div class="kpi"><div class="kn" style="color:#16a34a">${gains.length}</div><div class="kl">📈 Ganhos</div></div>
    </div>
    <table><thead><tr><th>Data</th><th>Horário</th><th>Total</th><th>Nota</th><th>Variação</th><th>%</th><th>Status</th><th>Obs</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center">Monitor de Avaliações · Google Meu Negócio</p>
    <script>window.onload=()=>window.print();<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { showToast('⚠️ Pop-up bloqueado. Permita pop-ups para exportar PDF.', 'warn'); return; }
    w.document.write(html); w.document.close();
    showToast('📄 PDF aberto!', 'success');
}

export function shareResume(logs) {
    if (logs.length === 0) { showToast('Nenhum dado para compartilhar.', 'error'); return; }
    const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last = sorted[sorted.length - 1], first = sorted[0];
    const drops = sorted.filter(l => l.diff < 0), gains = sorted.filter(l => l.diff > 0);
    const health = calcHealth(logs), streak = calcStreak(logs);
    const text = `📊 RELATÓRIO DE AVALIAÇÕES GOOGLE\n━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${fmtDate(first.date)} → ${fmtDate(last.date)}\n⭐ Total: ${last.total}\n🌟 Nota: ${last.rating ?? 'N/D'}\n📈 Saldo: ${(last.total - first.total) >= 0 ? '+' : ''}${last.total - first.total}\n🏥 Saúde: ${health?.icon ?? '—'} ${health?.label ?? '—'}\n🔥 Streak: ${streak} dia(s)\n━━━━━━━━━━━━━━━━━━━━━━━━\n📉 Quedas: ${drops.length} | 📈 Ganhos: ${gains.length}\n${last.diff < 0 ? `🚨 Última queda: ${Math.abs(last.diff)} avaliações!\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━\nMonitor · Google Meu Negócio`;
    document.getElementById('shareText').value = text;
    document.getElementById('shareModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function copyShare() {
    const text = document.getElementById('shareText').value;
    navigator.clipboard.writeText(text)
        .then(() => showToast('✅ Texto copiado!', 'success'))
        .catch(() => { document.getElementById('shareText').select(); document.execCommand('copy'); showToast('✅ Copiado!', 'success'); });
}
