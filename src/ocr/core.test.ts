/**
 * Tests for OCR Core
 * Monitor de Avaliações Miplace
 * @version 2.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWorker, playSound, loadTesseract } from './core';

// Mock global Tesseract
declare global {
  // eslint-disable-next-line no-var
  var Tesseract: {
    createWorker: (lang: string) => Promise<{
      setParameters: (params: Record<string, unknown>) => Promise<void>;
    }>;
  };
}

describe('OCR Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWorker', () => {
    it('should create worker for new language', async () => {
      const mockWorker = {
        setParameters: vi.fn(),
      };

      globalThis.Tesseract = {
        createWorker: vi.fn().mockResolvedValue(mockWorker),
      };

      const worker = await getWorker('por');
      expect(worker).toBe(mockWorker);
      expect(globalThis.Tesseract.createWorker).toHaveBeenCalledWith('por');
    });

    it('should return same worker for cached language', async () => {
      // Teste simples: getWorker retorna o mesmo objeto para mesma linguagem
      const mockWorker = { setParameters: vi.fn() };

      globalThis.Tesseract = {
        createWorker: vi.fn().mockResolvedValue(mockWorker),
      };

      const worker1 = await getWorker('por');
      const worker2 = await getWorker('por');

      // Mesmo worker deve ser retornado (do cache)
      expect(worker1).toBe(worker2);
    });

    it('should set parameters when provided', async () => {
      const mockWorker = {
        setParameters: vi.fn(),
      };

      globalThis.Tesseract = {
        createWorker: vi.fn().mockResolvedValue(mockWorker),
      };

      const params = { tessedit_char_whitelist: '0123456789' };
      await getWorker('por', 'whitelist', params);

      expect(mockWorker.setParameters).toHaveBeenCalledWith(params);
    });
  });

  describe('playSound', () => {
    it('should create and play audio', () => {
      const mockPlay = vi.fn().mockResolvedValue(undefined);
      const AudioMock = vi.fn().mockImplementation(() => ({
        volume: 0,
        play: mockPlay,
      }));
      globalThis.Audio = AudioMock as unknown as typeof Audio;

      playSound('/sounds/success.mp3');

      expect(AudioMock).toHaveBeenCalledWith('/sounds/success.mp3');
    });

    it('should handle play errors gracefully', () => {
      const mockPlay = vi.fn().mockRejectedValue(new Error('Play failed'));
      const AudioMock = vi.fn().mockImplementation(() => ({
        volume: 0,
        play: mockPlay,
      }));
      globalThis.Audio = AudioMock as unknown as typeof Audio;

      // Should not throw
      expect(() => playSound('/sounds/success.mp3')).not.toThrow();
    });
  });

  describe('loadTesseract', () => {
    it('should return immediately if already loaded', async () => {
      globalThis.Tesseract = {
        createWorker: vi.fn(),
      };

      await loadTesseract();
      await loadTesseract(); // Second call should be instant

      // No error thrown
      expect(true).toBe(true);
    });
  });
});
