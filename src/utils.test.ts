/**
 * Tests for utils.ts
 * Monitor de Avaliações Miplace
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  fmtDate,
  debounce,
  getConsecutiveDrops,
  linearRegression,
  calcHealth,
  calcStreak,
} from './utils';
import type { LogEntry } from '../types';

// Mock window.setTimeout for debounce tests
globalThis.window = {
  setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  clearTimeout: (id: number) => clearTimeout(id as unknown as number),
} as unknown as Window & typeof globalThis;

describe('Utils', () => {
  describe('fmtDate', () => {
    it('should format date from YYYY-MM-DD to DD/MM/YYYY', () => {
      expect(fmtDate('2024-01-15')).toBe('15/01/2024');
      expect(fmtDate('2024-12-31')).toBe('31/12/2024');
    });

    it('should handle single digit months and days', () => {
      expect(fmtDate('2024-01-05')).toBe('05/01/2024');
    });
  });

  describe('debounce', () => {
    it('should delay function execution', async () => {
      let called = false;
      const fn = () => {
        called = true;
      };
      const debounced = debounce(fn, 50);

      debounced();
      expect(called).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(called).toBe(true);
    });

    it('should reset timer on multiple calls', async () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
      };
      const debounced = debounce(fn, 50);

      debounced();
      await new Promise((resolve) => setTimeout(resolve, 30));
      debounced();
      await new Promise((resolve) => setTimeout(resolve, 30));
      debounced();
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(callCount).toBe(1);
    });
  });

  describe('getConsecutiveDrops', () => {
    it('should count consecutive drops from the end', () => {
      const logs: LogEntry[] = [
        { id: 1, date: '2024-01-01', time: '10:00', total: 100, rating: null, diff: 0, pct: 0, notes: '', image: null, imageUrl: null },
        { id: 2, date: '2024-01-02', time: '10:00', total: 90, rating: null, diff: -10, pct: -10, notes: '', image: null, imageUrl: null },
        { id: 3, date: '2024-01-03', time: '10:00', total: 85, rating: null, diff: -5, pct: -5.5, notes: '', image: null, imageUrl: null },
        { id: 4, date: '2024-01-04', time: '10:00', total: 80, rating: null, diff: -5, pct: -5.9, notes: '', image: null, imageUrl: null },
      ];

      expect(getConsecutiveDrops(logs)).toBe(3);
    });

    it('should return 0 if no drops', () => {
      const logs: LogEntry[] = [
        { id: 1, date: '2024-01-01', time: '10:00', total: 100, rating: null, diff: 10, pct: 10, notes: '', image: null, imageUrl: null },
        { id: 2, date: '2024-01-02', time: '10:00', total: 110, rating: null, diff: 10, pct: 10, notes: '', image: null, imageUrl: null },
      ];

      expect(getConsecutiveDrops(logs)).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(getConsecutiveDrops([])).toBe(0);
    });
  });

  describe('linearRegression', () => {
    it('should return null for less than 5 points', () => {
      expect(linearRegression([1, 2, 3, 4])).toBeNull();
    });

    it('should calculate linear regression correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = linearRegression(data);

      expect(result).not.toBeNull();
      expect(result!.slope).toBeCloseTo(1, 1);
      expect(result!.intercept).toBeCloseTo(1, 1);
      expect(result!.r2).toBeGreaterThan(0.99);
    });

    it('should handle flat data', () => {
      const data = [5, 5, 5, 5, 5];
      const result = linearRegression(data);

      expect(result).not.toBeNull();
      expect(result!.slope).toBeCloseTo(0, 1);
      expect(result!.r2).toBe(0); // No variance
    });

    it('should return R-squared between 0 and 1', () => {
      const data = [2, 4, 6, 8, 10, 12, 14, 16];
      const result = linearRegression(data);

      expect(result).not.toBeNull();
      expect(result!.r2).toBeGreaterThanOrEqual(0);
      expect(result!.r2).toBeLessThanOrEqual(1);
    });
  });

  describe('calcHealth', () => {
    it('should return null for less than 3 logs', () => {
      expect(calcHealth([])).toBeNull();
      expect(calcHealth([{ id: 1, date: '2024-01-01', time: '10:00', total: 100, rating: null, diff: 0, pct: 0, notes: '', image: null, imageUrl: null }])).toBeNull();
    });

    it('should return "good" health for consistent data', () => {
      const logs: LogEntry[] = [
        { id: 1, date: '2024-01-01', time: '10:00', total: 100, rating: 4, diff: 0, pct: 0, notes: '', image: null, imageUrl: null },
        { id: 2, date: '2024-01-02', time: '10:00', total: 105, rating: 4, diff: 5, pct: 5, notes: '', image: null, imageUrl: null },
        { id: 3, date: '2024-01-03', time: '10:00', total: 110, rating: 4, diff: 5, pct: 4.8, notes: '', image: null, imageUrl: null },
        { id: 4, date: '2024-01-04', time: '10:00', total: 115, rating: 4, diff: 5, pct: 4.5, notes: '', image: null, imageUrl: null },
        { id: 5, date: '2024-01-05', time: '10:00', total: 120, rating: 4, diff: 5, pct: 4.3, notes: '', image: null, imageUrl: null },
      ];

      const health = calcHealth(logs);
      expect(health).not.toBeNull();
      expect(health!.cls).toBe('health-good');
    });

    it('should return "bad" health for declining data', () => {
      const logs: LogEntry[] = [
        { id: 1, date: '2024-01-01', time: '10:00', total: 100, rating: 2, diff: 0, pct: 0, notes: '', image: null, imageUrl: null },
        { id: 2, date: '2024-01-02', time: '10:00', total: 90, rating: 2, diff: -10, pct: -10, notes: '', image: null, imageUrl: null },
        { id: 3, date: '2024-01-03', time: '10:00', total: 80, rating: 2, diff: -10, pct: -11, notes: '', image: null, imageUrl: null },
        { id: 4, date: '2024-01-04', time: '10:00', total: 70, rating: 2, diff: -10, pct: -12.5, notes: '', image: null, imageUrl: null },
        { id: 5, date: '2024-01-05', time: '10:00', total: 60, rating: 2, diff: -10, pct: -14, notes: '', image: null, imageUrl: null },
      ];

      const health = calcHealth(logs);
      expect(health).not.toBeNull();
      expect(health!.cls).toBe('health-bad');
    });
  });

  describe('calcStreak', () => {
    it('should calculate current streak', () => {
      const logs: LogEntry[] = [
        { id: 1, date: '2024-01-01', time: '10:00', total: 100, rating: null, diff: 10, pct: 10, notes: '', image: null, imageUrl: null },
        { id: 2, date: '2024-01-02', time: '10:00', total: 110, rating: null, diff: 10, pct: 10, notes: '', image: null, imageUrl: null },
        { id: 3, date: '2024-01-03', time: '10:00', total: 120, rating: null, diff: 10, pct: 9, notes: '', image: null, imageUrl: null },
      ];

      expect(calcStreak(logs)).toBe(3);
    });

    it('should break streak on drop', () => {
      const logs: LogEntry[] = [
        { id: 1, date: '2024-01-01', time: '10:00', total: 100, rating: null, diff: 10, pct: 10, notes: '', image: null, imageUrl: null },
        { id: 2, date: '2024-01-02', time: '10:00', total: 110, rating: null, diff: 10, pct: 10, notes: '', image: null, imageUrl: null },
        { id: 3, date: '2024-01-03', time: '10:00', total: 100, rating: null, diff: -10, pct: -9, notes: '', image: null, imageUrl: null },
      ];

      expect(calcStreak(logs)).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(calcStreak([])).toBe(0);
    });
  });
});
