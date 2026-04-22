import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  calculateLinearRegression,
  calculateHealth,
  estimateReg,
  isLogEntry,
  isStore,
  AppError,
} from '../../types';
import {
  compressImage,
  withTimeout,
} from '../firebase';

// Mock firebase for browser environment
declare global {
  interface Window {
    firebase: {
      firestore: () => any;
      storage: () => any;
    };
  }
}

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format number to BRL currency', () => {
      expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
      expect(formatCurrency(0)).toBe('R$ 0,00');
      expect(formatCurrency(-100)).toBe('-R$ 100,00');
    });

    it('should handle decimal values correctly', () => {
      expect(formatCurrency(99.99)).toBe('R$ 99,99');
      expect(formatCurrency(0.01)).toBe('R$ 0,01');
    });
  });

  describe('formatNumber', () => {
    it('should format with fixed decimals', () => {
      expect(formatNumber(3.14159, 2)).toBe('3,14');
      expect(formatNumber(3.14159, 4)).toBe('3,1416');
    });
  });

  describe('formatDate', () => {
    it('should format YYYY-MM-DD to DD/MM/YYYY', () => {
      expect(formatDate('2024-01-15')).toBe('15/01/2024');
      expect(formatDate('2024-12-31')).toBe('31/12/2024');
    });
  });

  describe('calculateLinearRegression', () => {
    it('should calculate regression correctly', () => {
      const points = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ];
      const result = calculateLinearRegression(points);
      expect(result.slope).toBeCloseTo(2, 5);
      expect(result.intercept).toBeCloseTo(0, 5);
    });

    it('should return empty for less than 2 points', () => {
      expect(calculateLinearRegression([{ x: 1, y: 2 }])).toEqual({ slope: 0, intercept: 0 });
    });
  });

  describe('calculateHealth', () => {
    it('should return good health for high r2', () => {
      const health = calculateHealth(0.9, 100);
      expect(health.cls).toBe('health-good');
    });

    it('should return bad health for low n', () => {
      const health = calculateHealth(0.9, 3);
      expect(health.cls).toBe('health-bad');
    });
  });

  describe('estimateReg', () => {
    it('should estimate based on regression', () => {
      const reg = { slope: 2, intercept: 1 };
      expect(estimateReg(reg, 5)).toBe(11);
    });

    it('should handle empty regression', () => {
      expect(estimateReg({ slope: 0, intercept: 0 }, 5)).toBe(0);
    });
  });
});

describe('Type Guards', () => {
  describe('isLogEntry', () => {
    it('should return true for valid LogEntry', () => {
      expect(isLogEntry({ id: 1, date: '2024-01-01', total: 100 })).toBe(true);
    });

    it('should return false for invalid object', () => {
      expect(isLogEntry(null)).toBe(false);
      expect(isLogEntry({})).toBe(false);
      expect(isLogEntry({ id: '1' })).toBe(false);
    });
  });

  describe('isStore', () => {
    it('should return true for valid Store', () => {
      expect(isStore({ id: 'store1', name: 'Loja Teste' })).toBe(true);
    });

    it('should return false for invalid object', () => {
      expect(isStore(null)).toBe(false);
      expect(isStore({})).toBe(false);
      expect(isStore({ id: 1 })).toBe(false);
    });
  });
});

describe('AppError', () => {
  it('should create error with code', () => {
    const error = new AppError('Test message', 'TEST_ERROR', { foo: 'bar' });
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.data).toEqual({ foo: 'bar' });
    expect(error.name).toBe('AppError');
  });
});
