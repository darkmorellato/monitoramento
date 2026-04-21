// ═══════════════════════════════════════════════════════════════
// UTILS - Funções utilitárias + Debounce
// ═══════════════════════════════════════════════════════════════

export function fmtDate(d) {
    const p = d.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
}

export function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function getConsecutiveDrops(logs) {
    let c = 0;
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].diff < 0) c++; else break;
    }
    return c;
}

export function linearRegression(data) {
    const n = data.length;
    // Mínimo 5 pontos para uma projeção confiável
    if (n < 5) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    data.forEach((y, x) => { sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; });
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: sumY / n };
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

export function calcHealth(logs) {
    if (logs.length < 3) return null;
    const drops = logs.filter(l => l.diff < 0).length;
    const dropRatio = drops / logs.length;
    // Janela de 7 dias recentes (mais representativa que 3)
    const recent = logs.slice(-7);
    const recentDrops = recent.filter(l => l.diff < 0).length;
    const recentRatio = recentDrops / recent.length;
    if (recentRatio >= 0.6 || dropRatio > 0.4) return { label: 'Crítico', icon: '🔴', cls: 'health-critico' };
    if (recentRatio >= 0.3 || dropRatio > 0.25) return { label: 'Regular', icon: '🟡', cls: 'health-regular' };
    if (dropRatio > 0.1) return { label: 'Bom', icon: '🔵', cls: 'health-bom' };
    return { label: 'Excelente', icon: '🟢', cls: 'health-excelente' };
}

export function calcStreak(logs) {
    let streak = 0;
    // Conta apenas dias com crescimento real (diff > 0), não inclui dias neutros
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].diff > 0) streak++; else break;
    }
    return streak;
}
