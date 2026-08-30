// ═══════════════════════════════════════════════════════════════
// FEATURE FLAGS - Sistema de Feature Flags com Rollout Gradual
// ═══════════════════════════════════════════════════════════════

import { SentryErrorBoundary } from '../monitoring/sentry';

// Tipos de flags disponíveis
interface FeatureFlags {
  'new-ocr-engine': boolean;
  'beta-charts': boolean;
  'export-pdf-v2': boolean;
  'dark-mode': boolean;
  'offline-sync': boolean;
  'real-time-collab': boolean;
}

// Configuração padrão
const defaultFlags: FeatureFlags = {
  'new-ocr-engine': false,
  'beta-charts': false,
  'export-pdf-v2': false,
  'dark-mode': true,
  'offline-sync': false,
  'real-time-collab': false,
};

// Configurações de rollout gradual
interface RolloutConfig {
  percentage: number;
  startDate?: Date;
  endDate?: Date;
  allowedUsers?: string[];
}

const rolloutConfigs: Partial<Record<keyof FeatureFlags, RolloutConfig>> = {
  'new-ocr-engine': {
    percentage: 10,
    allowedUsers: ['admin', 'beta-tester'],
  },
  'beta-charts': {
    percentage: 25,
    startDate: new Date('2026-04-01'),
  },
};

// ═══════════════════════════════════════════════════════════════
// GERENCIADOR DE FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════

export class FeatureFlagManager {
  private flags: FeatureFlags;
  private listeners: Set<(flags: FeatureFlags) => void> = new Set();
  private userId: string | null = null;
  private userAttributes: Record<string, string> = {};
  private errorBoundary = new SentryErrorBoundary('FeatureFlagManager');
  
  constructor() {
    this.flags = this.loadFlags();
    this.setupStorageListener();
  }
  
  // Inicializar com usuário
  setUser(userId: string, attributes?: Record<string, string>): void {
    this.userId = userId;
    this.userAttributes = attributes || {};
    this.evaluateFlags();
  }
  
  // Verificar se flag está ativa
  isEnabled(flag: keyof FeatureFlags): boolean {
    // Verificar rollout gradual primeiro
    if (this.isInRollout(flag)) {
      return true;
    }
    
    return this.flags[flag] ?? false;
  }
  
  // Verificar rollout gradual
  private isInRollout(flag: keyof FeatureFlags): boolean {
    const config = rolloutConfigs[flag];
    if (!config) return false;
    
    // Verificar data
    if (config.startDate && new Date() < config.startDate) return false;
    if (config.endDate && new Date() > config.endDate) return false;
    
    // Verificar usuários permitidos
    if (config.allowedUsers?.length) {
      const userType = this.userAttributes?.['type'];
      if (userType && config.allowedUsers.includes(userType)) return true;
    }
    
    // Verificar porcentagem (hash do userId)
    if (this.userId && config.percentage < 100) {
      const userHash = this.hashString(this.userId);
      return (userHash % 100) < config.percentage;
    }
    
    return false;
  }
  
  // Hash consistente para rollout
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Ativar/desativar flag
  toggle(flag: keyof FeatureFlags): void {
    try {
      this.flags[flag] = !this.flags[flag];
      this.saveFlags();
      this.notifyListeners();
      
      console.log(`[FeatureFlag] ${String(flag)} toggled to ${this.flags[flag]}`);
    } catch (error) {
      this.errorBoundary.captureError(error as Error, { flag });
    }
  }
  
  // Set flag diretamente
  set(flag: keyof FeatureFlags, value: boolean): void {
    this.flags[flag] = value;
    this.saveFlags();
    this.notifyListeners();
  }
  
  // Obter todas as flags
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }
  
  // Verificar múltiplas flags
  areEnabled(...flags: (keyof FeatureFlags)[]): boolean {
    return flags.every((flag) => this.isEnabled(flag));
  }
  
  // Requer flag ativa (throws se não)
  require(flag: keyof FeatureFlags, featureName: string): void {
    if (!this.isEnabled(flag)) {
      throw new Error(`Feature "${featureName}" requires flag "${String(flag)}"`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PERSISTÊNCIA
  // ═══════════════════════════════════════════════════════════════
  
  private loadFlags(): FeatureFlags {
    try {
      const stored = localStorage.getItem('feature-flags');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultFlags, ...parsed };
      }
    } catch {
      // Ignore parsing errors
    }
    return { ...defaultFlags };
  }
  
  private saveFlags(): void {
    localStorage.setItem('feature-flags', JSON.stringify(this.flags));
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════
  
  subscribe(callback: (flags: FeatureFlags) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.flags));
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SYNC ENTRE ABAS
  // ═══════════════════════════════════════════════════════════════
  
  private setupStorageListener(): void {
    window.addEventListener('storage', (e) => {
      if (e.key === 'feature-flags') {
        this.flags = this.loadFlags();
        this.notifyListeners();
      }
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════
  
  resetToDefaults(): void {
    this.flags = { ...defaultFlags };
    this.saveFlags();
    this.notifyListeners();
  }
  
  getFlagExplanation(flag: keyof FeatureFlags): string {
    if (this.flags[flag]) {
      return 'Ativado manualmente';
    }
    
    const config = rolloutConfigs[flag];
    if (config) {
      if (this.isInRollout(flag)) {
        return `Ativado via rollout (${config.percentage}% dos usuários)`;
      }
      return `Em rollout gradual (${config.percentage}%)`;
    }
    
    return 'Desativado';
  }
  
  // Avaliar flags com base no usuário
  private evaluateFlags(): void {
    // Reavalia flags baseado no usuário
    this.notifyListeners();
  }
}

// Instância singleton
export const featureFlags = new FeatureFlagManager();

// ═══════════════════════════════════════════════════════════════
// REACT HOOK (se usar React)
// ═══════════════════════════════════════════════════════════════

// Simple state management for vanilla JS (no React dependency)
function createSignal<T>(initialValue: T): [() => T, (value: T) => void] {
  let value = initialValue;
  const listeners = new Set<(newValue: T) => void>();

  const get = () => value;
  const set = (newValue: T) => {
    value = newValue;
    listeners.forEach((cb) => cb(newValue));
  };

  return [get, set];
}

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  // For vanilla JS projects without React, use a simple signal pattern
  const [getEnabled, setEnabled] = createSignal(featureFlags.isEnabled(flag));

  // Subscribe to changes
  featureFlags.subscribe((flags) => {
    setEnabled(flags[flag]);
  });

  return getEnabled();
}

// ═══════════════════════════════════════════════════════════════
// DECORADOR/WRAPPER
// ═══════════════════════════════════════════════════════════════

export function withFeatureFlag<T extends (...args: any[]) => any>(
  flag: keyof FeatureFlags,
  fallbackFn: T,
  featureFn: T
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    if (featureFlags.isEnabled(flag)) {
      return featureFn(...args);
    }
    return fallbackFn(...args);
  }) as T;
}

// ═══════════════════════════════════════════════════════════════
// UI DE ADMIN
// ═══════════════════════════════════════════════════════════════

export function createFeatureFlagAdminPanel(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'feature-flag-admin';
  container.innerHTML = `
    <h3>Feature Flags Admin</h3>
    <div class="flags-list">
      ${Object.keys(defaultFlags).map((flag) => `
        <div class="flag-item">
          <label>
            <input type="checkbox" data-flag="${flag}"
              ${featureFlags.isEnabled(flag as keyof FeatureFlags) ? 'checked' : ''}>
            ${flag}
            <span class="flag-status">${featureFlags.getFlagExplanation(flag as keyof FeatureFlags)}</span>
          </label>
        </div>
      `).join('')}
    </div>
    <button id="reset-flags">Reset to Defaults</button>
  `;
  
  // Event listeners
  container.querySelectorAll('input[data-flag]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      featureFlags.set(target.dataset.flag as keyof FeatureFlags, target.checked);
    });
  });
  
  container.querySelector('#reset-flags')?.addEventListener('click', () => {
    featureFlags.resetToDefaults();
    location.reload();
  });
  
  return container;
}
