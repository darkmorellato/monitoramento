// ═══════════════════════════════════════════════════════════════
// UTILS - Funções utilitárias + Debounce
// ═══════════════════════════════════════════════════════════════

import { LogEntry, HealthStatus, Regression } from '../types';

export function fmtDate(d: string): string {
    const p = d.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), delay);
  };
}

export function getConsecutiveDrops(logs: LogEntry[]): number {
    let c = 0;
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].diff < 0) c++; else break;
    }
    return c;
}

export function linearRegression(data: number[]): Regression | null {
    const n = data.length;
    // Mínimo 5 pontos para uma projeção confiável
    if (n < 5) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    data.forEach((y, x) => { sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; });
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    // Calculate R-squared
  const yMean = sumY / n;
  let ssRes = 0, ssTot = 0;
  data.forEach((y, x) => {
    const yPred = slope * x + intercept;
    ssRes += Math.pow(y - yPred, 2);
    ssTot += Math.pow(y - yMean, 2);
  });
  const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  return { slope, intercept, r2 };
}

export function calcHealth(logs: LogEntry[]): HealthStatus | null {
  if (logs.length < 3) return null;
  const drops = logs.filter(l => l.diff < 0).length;
  const dropRatio = drops / logs.length;
  // Janela de 7 dias recentes (mais representativa que 3)
  const recent = logs.slice(-7);
  const recentDrops = recent.filter(l => l.diff < 0).length;
  const recentRatio = recentDrops / recent.length;
  if (recentRatio >= 0.6 || dropRatio > 0.4) return { label: 'Crítico', icon: '🔴', cls: 'health-bad' };
  if (recentRatio >= 0.3 || dropRatio > 0.25) return { label: 'Regular', icon: '🟡', cls: 'health-warning' };
  if (dropRatio > 0.1) return { label: 'Bom', icon: '🔵', cls: 'health-good' };
  return { label: 'Excelente', icon: '🟢', cls: 'health-good' };
}

export function calcStreak(logs: LogEntry[]): number {
    let streak = 0;
    // Conta apenas dias com crescimento real (diff > 0), não inclui dias neutros
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].diff > 0) streak++; else break;
    }
    return streak;
}
