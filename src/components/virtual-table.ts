// ═══════════════════════════════════════════════════════════════
// VIRTUAL TABLE - Renderização otimizada para grandes listas
// ═══════════════════════════════════════════════════════════════

import { LogEntry } from '../../types';

interface VirtualTableConfig {
  container: HTMLElement;
  rowHeight: number;
  overscan?: number;
  onRowRender: (index: number, log: LogEntry) => HTMLElement;
}

interface VirtualTableState {
  logs: LogEntry[];
  startIndex: number;
  endIndex: number;
  scrollTop: number;
  viewportHeight: number;
}

export class VirtualTable {
  private container: HTMLElement;
  private contentContainer: HTMLElement;
  private config: VirtualTableConfig;
  private state: VirtualTableState;
  private resizeObserver: ResizeObserver | null = null;
  private rowElements: Map<number, HTMLElement> = new Map();

  constructor(config: VirtualTableConfig) {
    this.container = config.container;
    this.config = { overscan: 5, ...config };
    this.state = {
      logs: [],
      startIndex: 0,
      endIndex: 0,
      scrollTop: 0,
      viewportHeight: 0,
    };

    this.setupContainer();
    this.attachEvents();
    this.attachResizeObserver();
  }

  private setupContainer(): void {
    // Configura container principal
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';
    this.container.style.willChange = 'transform';

    // Cria container de conteúdo
    this.contentContainer = document.createElement('div');
    this.contentContainer.style.position = 'relative';
    this.contentContainer.style.willChange = 'transform';
    this.contentContainer.style.contain = 'layout style paint';
    
    // Limpa e adiciona
    this.container.innerHTML = '';
    this.container.appendChild(this.contentContainer);
  }

  private attachEvents(): void {
    this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
  }

  private attachResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.state.viewportHeight = entry.contentRect.height;
        this.updateViewport();
      }
    });

    this.resizeObserver.observe(this.container);
  }

  private handleScroll(): void {
    this.state.scrollTop = this.container.scrollTop;
    this.updateViewport();
  }

  private updateViewport(): void {
    const { rowHeight, overscan = 5 } = this.config;
    const { scrollTop, viewportHeight, logs } = this.state;

    // Calcula índices visíveis
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(
      logs.length - 1,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan
    );

    // Só atualiza se mudou
    if (startIndex !== this.state.startIndex || endIndex !== this.state.endIndex) {
      this.state.startIndex = startIndex;
      this.state.endIndex = endIndex;
      this.renderVisibleRows();
    }
  }

  private renderVisibleRows(): void {
    const { startIndex, endIndex, logs } = this.state;
    const { rowHeight } = this.config;

    // Atualiza altura total do container
    const totalHeight = logs.length * rowHeight;
    this.contentContainer.style.height = `${totalHeight}px`;

    // Remove linhas que saíram da viewport
    for (const [index, element] of this.rowElements) {
      if (index < startIndex || index > endIndex) {
        element.remove();
        this.rowElements.delete(index);
      }
    }

    // Adiciona/Atualiza linhas visíveis
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= logs.length) break;

      const log = logs[i];
      let rowElement = this.rowElements.get(i);

      if (!rowElement) {
        rowElement = this.config.onRowRender(i, log);
        rowElement.style.position = 'absolute';
        rowElement.style.top = '0';
        rowElement.style.left = '0';
        rowElement.style.right = '0';
        rowElement.style.height = `${rowHeight}px`;
        rowElement.style.transform = `translateY(${i * rowHeight}px)`;
        rowElement.dataset.index = String(i);
        
        this.contentContainer.appendChild(rowElement);
        this.rowElements.set(i, rowElement);
      }
    }
  }

  // API Pública

  setData(logs: LogEntry[]): void {
    this.state.logs = logs;
    this.rowElements.forEach((el) => el.remove());
    this.rowElements.clear();
    this.updateViewport();
  }

  refresh(): void {
    this.updateViewport();
  }

  scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
    const { rowHeight } = this.config;
    this.container.scrollTo({
      top: index * rowHeight,
      behavior,
    });
  }

  getVisibleRange(): { start: number; end: number } {
    return {
      start: this.state.startIndex,
      end: this.state.endIndex,
    };
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.rowElements.forEach((el) => el.remove());
    this.rowElements.clear();
    this.container.innerHTML = '';
  }

  // Estimativa de performance
  getPerformanceMetrics(): {
    totalRows: number;
    visibleRows: number;
    renderedRows: number;
    memorySavings: string;
  } {
    const { logs, startIndex, endIndex } = this.state;
    const totalRows = logs.length;
    const visibleRows = endIndex - startIndex + 1;
    const renderedRows = this.rowElements.size;
    const memorySavings = `${((1 - renderedRows / totalRows) * 100).toFixed(1)}%`;

    return {
      totalRows,
      visibleRows,
      renderedRows,
      memorySavings,
    };
  }
}

// Hook para React/Vue-like usage
export function useVirtualTable(
  containerRef: HTMLElement | null,
  options: Omit<VirtualTableConfig, 'container'>
): VirtualTable | null {
  if (!containerRef) return null;
  return new VirtualTable({ container: containerRef, ...options });
}

// Utilitário para cálculo de altura dinâmica
export function measureRowHeight(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  const marginTop = parseFloat(styles.marginTop);
  const marginBottom = parseFloat(styles.marginBottom);
  return rect.height + marginTop + marginBottom;
}
