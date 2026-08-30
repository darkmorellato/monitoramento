/**
 * Accessibility (a11y) utilities for WCAG 2.1 compliance
 * Monitor de Avaliações Miplace
 */

// Focus management for keyboard navigation
export function initFocusManagement(): void {
  // Add class when user tabs
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.body.classList.add('user-is-tabbing');
      document.body.classList.remove('using-mouse');
    }
  });

  // Remove class when user clicks
  document.addEventListener('mousedown', () => {
    document.body.classList.remove('user-is-tabbing');
    document.body.classList.add('using-mouse');
  });
}

// Create skip to content link
export function initSkipLink(): void {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'Pular para conteúdo principal';
  skipLink.className = 'skip-link';
  skipLink.setAttribute('aria-label', 'Pular para o conteúdo principal da página');
  document.body.prepend(skipLink);

  // Ensure main content has ID
  const main = document.querySelector('main');
  if (main && !main.id) {
    main.id = 'main-content';
    main.setAttribute('tabindex', '-1');
  }
}

// ARIA live region for announcements
export function initLiveRegion(): void {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.id = 'aria-live-region';
  document.body.appendChild(liveRegion);
}

// Announce message to screen readers
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const region = document.querySelector(`[aria-live="${priority}"]`) as HTMLElement;
  if (region) {
    region.textContent = message;
    // Clear after announcement
    setTimeout(() => {
      region.textContent = '';
    }, 1000);
  }
}

// Trap focus within modal
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleTabKey(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }

  element.addEventListener('keydown', handleTabKey);
  firstFocusable?.focus();

  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
}

// Set focus to element
export function setFocus(element: HTMLElement | string): void {
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (el instanceof HTMLElement) {
    el.setAttribute('tabindex', '-1');
    el.focus();
    el.addEventListener('blur', () => {
      el.removeAttribute('tabindex');
    }, { once: true });
  }
}

// Page title management
let originalTitle = document.title;
export function setPageTitle(title: string): void {
  document.title = `${title} | Monitor de Avaliações`;
}

export function resetPageTitle(): void {
  document.title = originalTitle;
}

// Color contrast checker (WCAG 2.1 AA requires 4.5:1 for normal text)
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function getLuminance(color: string): number {
  const rgb = hexToRgb(color) || { r: 0, g: 0, b: 0 };
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Check if element is visible
export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  );
}

// Initialize all accessibility features
export function initAccessibility(): void {
  initFocusManagement();
  initSkipLink();
  initLiveRegion();
}

// Keyboard shortcut manager
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

const shortcuts: KeyboardShortcut[] = [];

export function registerShortcut(shortcut: KeyboardShortcut): () => void {
  shortcuts.push(shortcut);
  return () => {
    const index = shortcuts.indexOf(shortcut);
    if (index > -1) shortcuts.splice(index, 1);
  };
}

export function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    shortcuts.forEach((shortcut) => {
      if (
        e.key.toLowerCase() === shortcut.key.toLowerCase() &&
        !!e.ctrlKey === !!shortcut.ctrl &&
        !!e.altKey === !!shortcut.alt &&
        !!e.shiftKey === !!shortcut.shift
      ) {
        e.preventDefault();
        shortcut.action();
      }
    });
  });
}

// Reduced motion support
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// High contrast mode detection
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

// Export utility for form field labels
export function associateLabel(inputId: string, labelText: string): void {
  const input = document.getElementById(inputId);
  if (input) {
    const label = document.createElement('label');
    label.htmlFor = inputId;
    label.textContent = labelText;
    input.parentNode?.insertBefore(label, input);
  }
}

// Error message announcement
export function announceError(message: string): void {
  announce(`Erro: ${message}`, 'assertive');
}

// Success message announcement
export function announceSuccess(message: string): void {
  announce(`Sucesso: ${message}`, 'polite');
}
