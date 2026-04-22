// ═══════════════════════════════════════════════════════════════
// LAZY LOADER - Utilitários para code splitting e lazy loading
// ═══════════════════════════════════════════════════════════════

import { showToast } from '../ui';

/**
 * Interface para módulos lazy loaded
 * Suporta tanto módulos ES6 com default export quanto módulos sem default
 */
interface LazyModule<T> {
  default?: T;
  __esModule?: boolean;
  [key: string]: unknown;
}

/**
 * Estado do carregamento
 */
enum LoadState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
}

/**
 * Cache de módulos carregados
 */
const moduleCache = new Map<string, Promise<unknown>>();

/**
 * Carrega um módulo dinamicamente com cache
 * @param loader Função de importação dinâmica
 * @param name Nome do módulo (para cache)
 * @param timeout Timeout em ms
 * @returns Promise com o módulo carregado
 */
export async function lazyLoad<T>(
  loader: () => Promise<LazyModule<T> | T>,
  name: string,
  timeout = 30000
): Promise<T> {
  // Verifica cache
  if (moduleCache.has(name)) {
    const cached = await moduleCache.get(name) as LazyModule<T>;
    // Se tem default, retorna default. Senão, retorna o próprio módulo
    return (cached.default ?? cached) as T;
  }

  // Cria promise de carregamento
  const loadPromise = Promise.race([
    loader().then((mod) => {
      console.log(`[LazyLoader] ✅ ${name} carregado com sucesso`);
      return mod;
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout loading ${name}`)), timeout);
    }),
  ]);

  // Armazena no cache
  moduleCache.set(name, loadPromise);

  try {
    const module = await loadPromise;
    // Se é um módulo ES6 com default, retorna default. Senão retorna o módulo direto
    const mod = module as LazyModule<T>;
    return (mod.default ?? mod) as T;
  } catch (error) {
    // Remove do cache em caso de erro
    moduleCache.delete(name);
    console.error(`[LazyLoader] ❌ Erro ao carregar ${name}:`, error);
    throw error;
  }
}

/**
 * Componente lazy com skeleton loading
 */
export interface LazyComponentConfig<T> {
  loader: () => Promise<LazyModule<T> | T>;
  name: string;
  onLoading?: () => void;
  onLoaded?: (component: T) => void;
  onError?: (error: Error) => void;
  skeleton?: HTMLElement | string;
}

/**
 * Cria um componente lazy carregável sob demanda
 */
export function createLazyComponent<T>(config: LazyComponentConfig<T>) {
  let state: LoadState = LoadState.IDLE;
  let component: T | null = null;
  let error: Error | null = null;

  const load = async (): Promise<T> => {
    if (state === LoadState.LOADED && component) {
      return component;
    }

    if (state === LoadState.LOADING) {
      // Aguarda carregamento em andamento
      while (state === LoadState.LOADING) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (component) return component;
      if (error) throw error;
    }

    state = LoadState.LOADING;
    config.onLoading?.();

    try {
      component = await lazyLoad(config.loader, config.name);
      state = LoadState.LOADED;
      config.onLoaded?.(component);
      return component;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      state = LoadState.ERROR;
      config.onError?.(error);
      throw error;
    }
  };

  return {
    load,
    getState: () => state,
    getComponent: () => component,
    getError: () => error,
    isLoaded: () => state === LoadState.LOADED,
    isLoading: () => state === LoadState.LOADING,
  };
}

/**
 * Lazy imports pré-configurados para os principais módulos
 */
// Lazy loading modules - these modules don't have default exports
// Using type assertion to bypass strict checking
export const LazyOCR = {
  core: () => lazyLoad(() => import('../ocr/core') as Promise<unknown>, 'ocr-core'),
  manager: () => lazyLoad(() => import('../ocr/ocr-manager') as Promise<unknown>, 'ocr-manager'),
  strategies: {
    base: () => lazyLoad(() => import('../ocr/strategies/base') as Promise<unknown>, 'ocr-strategy-base'),
    honor: () => lazyLoad(() => import('../ocr/strategies/honor') as Promise<unknown>, 'ocr-strategy-honor'),
  },
};

export const LazyCharts = {
  renderer: () => lazyLoad(() => import('../charts') as Promise<unknown>, 'charts'),
};

export const LazyExport = {
  csv: () => lazyLoad(() => import('../export') as Promise<unknown>, 'export-csv'),
  pdf: () => lazyLoad(() => import('../export') as Promise<unknown>, 'export-pdf'),
};

export const LazyComponents = {
  virtualTable: () => lazyLoad(() => import('../components/virtual-table') as Promise<unknown>, 'virtual-table'),
  // Worker não é importado como módulo - é carregado via URL
  // worker: () => new Worker(new URL('../workers/ocr.worker.ts', import.meta.url)),
};

/**
 * Precarrega módulos em background
 * @param loaders Array de loaders para precarregar
 */
export function preloadModules(loaders: Array<() => Promise<unknown>>): void {
  // Usa requestIdleCallback se disponível
  const schedule = window.requestIdleCallback || window.setTimeout;

  // Usa any para compatibilidade com tipos do requestIdleCallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (schedule as any)(() => {
    loaders.forEach((loader) => {
      loader().catch((err) => {
        console.warn('[LazyLoader] Preload failed:', err);
      });
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, 2000 as any);
}

/**
 * Hook para React-like lazy loading
 * @param importFn Função de import
 * @returns Componente lazy
 */
export function lazy<T extends { new (...args: unknown[]): unknown }>(
  importFn: () => Promise<LazyModule<T>>
): () => Promise<T> {
  let component: T | null = null;

  return async (): Promise<T> => {
    if (!component) {
      const mod = await importFn();
      component = mod.default as T;
    }
    return component;
  };
}

/**
 * Utilitário para chunk splitting otimizado
 * Carrega múltiplos chunks em paralelo
 */
export async function loadParallel<T extends Record<string, unknown>>(
  imports: { [K in keyof T]: () => Promise<LazyModule<T[K]>> }
): Promise<T> {
  const entries = Object.entries(imports);
  const results = await Promise.allSettled(
    entries.map(async ([name, loader]) => ({
      name,
      module: await lazyLoad(loader as () => Promise<LazyModule<unknown>>, name),
    }))
  );

  const fulfilled = results
    .filter((r): r is PromiseFulfilledResult<{ name: string; module: unknown }> => r.status === 'fulfilled')
    .reduce((acc, { value }) => {
      acc[value.name as keyof T] = value.module as T[keyof T];
      return acc;
    }, {} as T);

  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (rejected.length > 0) {
    console.warn('[LazyLoader] Alguns módulos falharam:', rejected);
  }

  return fulfilled;
}

/**
 * Monitor de performance para lazy loading
 */
export class LazyLoadMonitor {
  private metrics: Map<string, { start: number; end?: number; size?: number }> = new Map();

  start(name: string): void {
    this.metrics.set(name, { start: performance.now() });
  }

  end(name: string, size?: number): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.end = performance.now();
      if (size) metric.size = size;
    }
  }

  getMetrics(): Array<{ name: string; duration: number; size?: number }> {
    return Array.from(this.metrics.entries())
      .filter(([, m]) => m.end !== undefined)
      .map(([name, m]) => ({
        name,
        duration: m.end! - m.start,
        size: m.size,
      }));
  }

  report(): string {
    const metrics = this.getMetrics();
    if (metrics.length === 0) return 'Nenhuma métrica disponível';

    return metrics
      .map((m) => `  ${m.name}: ${m.duration.toFixed(2)}ms${m.size ? ` (${(m.size / 1024).toFixed(2)}KB)` : ''}`)
      .join('\n');
  }
}

// Singleton monitor
export const lazyLoadMonitor = new LazyLoadMonitor();

/**
 * Carregamento progressivo - carrega chunks conforme necessário
 */
export class ProgressiveLoader {
  private loadedChunks = new Set<string>();
  private loadQueue: string[] = [];
  private isLoading = false;

  constructor(
    private chunkMap: Map<string, () => Promise<unknown>>,
    private onChunkLoaded?: (name: string) => void
  ) {}

  async loadChunk(name: string): Promise<boolean> {
    if (this.loadedChunks.has(name)) return true;

    const loader = this.chunkMap.get(name);
    if (!loader) {
      console.warn(`[ProgressiveLoader] Chunk não encontrado: ${name}`);
      return false;
    }

    try {
      await loader();
      this.loadedChunks.add(name);
      this.onChunkLoaded?.(name);
      return true;
    } catch (error) {
      console.error(`[ProgressiveLoader] Erro ao carregar ${name}:`, error);
      return false;
    }
  }

  queueChunk(name: string): void {
    if (!this.loadedChunks.has(name) && !this.loadQueue.includes(name)) {
      this.loadQueue.push(name);
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isLoading || this.loadQueue.length === 0) return;

    this.isLoading = true;
    const name = this.loadQueue.shift()!;

    try {
      await this.loadChunk(name);
    } finally {
      this.isLoading = false;
      this.processQueue();
    }
  }

  getLoadedChunks(): string[] {
    return Array.from(this.loadedChunks);
  }

  getQueueLength(): number {
    return this.loadQueue.length;
  }
}

/**
 * Intersection Observer para lazy loading de componentes visíveis
 */
export function createVisibilityLoader(
  element: Element,
  onVisible: () => void,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        onVisible();
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, ...options });

  observer.observe(element);

  return () => observer.disconnect();
}
