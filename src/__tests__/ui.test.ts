import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showToast,
  hideToast,
  updateClock,
  toggleTheme,
  openModal,
  closeModal,
  showConfirm,
  hideConfirm,
} from '../ui';

describe('UI Module', () => {
  // Mock DOM elements
  let mockToast: HTMLElement;
  let mockClock: HTMLElement;
  let mockModal: HTMLElement;
  let mockConfirm: HTMLElement;

  beforeEach(() => {
    // Setup mock DOM
    mockToast = document.createElement('div');
    mockToast.id = 'toast';
    document.body.appendChild(mockToast);

    mockClock = document.createElement('div');
    mockClock.id = 'clock';
    document.body.appendChild(mockClock);

    mockModal = document.createElement('div');
    mockModal.id = 'modal';
    document.body.appendChild(mockModal);

    mockConfirm = document.createElement('div');
    mockConfirm.id = 'confirm';
    document.body.appendChild(mockConfirm);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllTimers();
  });

  describe('Toast Notifications', () => {
    it('should show toast with message', () => {
      showToast('Test message', 'info');
      expect(mockToast.textContent).toContain('Test message');
      expect(mockToast.classList.contains('show')).toBe(true);
    });

    it('should hide toast', () => {
      showToast('Test', 'info');
      hideToast();
      expect(mockToast.classList.contains('show')).toBe(false);
    });

    it('should auto-hide after duration', () => {
      vi.useFakeTimers();
      showToast('Test', 'info', 100);
      expect(mockToast.classList.contains('show')).toBe(true);
      vi.advanceTimersByTime(100);
      expect(mockToast.classList.contains('show')).toBe(false);
      vi.useRealTimers();
    });

    it('should support different toast types', () => {
      const types = ['success', 'error', 'warning', 'info'] as const;
      types.forEach(type => {
        showToast('Test', type);
        expect(mockToast.classList.contains(type)).toBe(true);
      });
    });
  });

  describe('Clock', () => {
    it('should update clock with current time', () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      
      updateClock();
      expect(mockClock.textContent).toContain(hours);
      expect(mockClock.textContent).toContain(minutes);
    });
  });

  describe('Theme', () => {
    it('should toggle theme class', () => {
      document.body.classList.add('dark');
      toggleTheme();
      expect(document.body.classList.contains('dark')).toBe(false);
      toggleTheme();
      expect(document.body.classList.contains('dark')).toBe(true);
    });

    it('should persist theme preference', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      toggleTheme();
      expect(setItemSpy).toHaveBeenCalledWith('theme', expect.any(String));
    });
  });

  describe('Modal', () => {
    it('should open modal with content', () => {
      openModal('<p>Test content</p>');
      expect(mockModal.innerHTML).toContain('Test content');
      expect(mockModal.classList.contains('show')).toBe(true);
    });

    it('should close modal', () => {
      openModal('Test');
      closeModal();
      expect(mockModal.classList.contains('show')).toBe(false);
    });
  });

  describe('Confirm Dialog', () => {
    it('should show confirm with message', () => {
      showConfirm('Are you sure?');
      expect(mockConfirm.textContent).toContain('Are you sure?');
      expect(mockConfirm.classList.contains('show')).toBe(true);
    });

    it('should hide confirm', () => {
      showConfirm('Test');
      hideConfirm();
      expect(mockConfirm.classList.contains('show')).toBe(false);
    });

    it('should resolve on confirm', async () => {
      const promise = showConfirm('Confirm?');
      const confirmBtn = mockConfirm.querySelector('.confirm-btn');
      if (confirmBtn) {
        confirmBtn.dispatchEvent(new Event('click'));
      }
      await expect(promise).resolves.toBe(true);
    });

    it('should reject on cancel', async () => {
      const promise = showConfirm('Confirm?');
      const cancelBtn = mockConfirm.querySelector('.cancel-btn');
      if (cancelBtn) {
        cancelBtn.dispatchEvent(new Event('click'));
      }
      await expect(promise).rejects.toBe(false);
    });
  });
});
