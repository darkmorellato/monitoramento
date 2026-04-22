import { describe, it, expect, beforeEach } from 'vitest';
import {
  state,
  setCurrentStore,
  addLog,
  updateLog,
  deleteLog,
  clearLogs,
  setLoading,
  setError,
  getStoreById,
  calculateStoreAverage,
  hasSufficientData,
} from '../state';
import type { Store, LogEntry } from '../../types';

describe('State Management', () => {
  const mockStore: Store = {
    id: 'test-store',
    name: 'Loja Teste',
    logo: '🏪',
    color: '#3b82f6',
  };

  const mockLog: LogEntry = {
    id: 1,
    date: '2024-01-15',
    time: '14:30',
    total: 150.5,
    rating: 4,
    diff: 0,
    pct: 0,
    notes: 'Test note',
    image: null,
    imageUrl: null,
  };

  beforeEach(() => {
    // Reset state
    clearLogs();
    setCurrentStore(null);
    setLoading(false);
    setError(null);
  });

  describe('Store Management', () => {
    it('should set current store', () => {
      setCurrentStore(mockStore);
      expect(state.currentStore).toEqual(mockStore);
    });

    it('should clear current store', () => {
      setCurrentStore(mockStore);
      setCurrentStore(null);
      expect(state.currentStore).toBeNull();
    });
  });

  describe('Log Management', () => {
    it('should add a log', () => {
      addLog(mockLog);
      expect(state.logs).toHaveLength(1);
      expect(state.logs[0]).toEqual(mockLog);
    });

    it('should update a log', () => {
      addLog(mockLog);
      const updated = { ...mockLog, total: 200 };
      updateLog(updated);
      expect(state.logs[0].total).toBe(200);
    });

    it('should delete a log by id', () => {
      addLog(mockLog);
      deleteLog(1);
      expect(state.logs).toHaveLength(0);
    });

    it('should clear all logs', () => {
      addLog(mockLog);
      addLog({ ...mockLog, id: 2 });
      clearLogs();
      expect(state.logs).toHaveLength(0);
    });
  });

  describe('Loading & Error States', () => {
    it('should set loading state', () => {
      setLoading(true);
      expect(state.isLoading).toBe(true);
      setLoading(false);
      expect(state.isLoading).toBe(false);
    });

    it('should set error state', () => {
      setError('Test error');
      expect(state.error).toBe('Test error');
      setError(null);
      expect(state.error).toBeNull();
    });
  });

  describe('Derived State', () => {
    it('should calculate store average', () => {
      addLog(mockLog);
      addLog({ ...mockLog, id: 2, total: 200 });
      const avg = calculateStoreAverage('test-store');
      expect(avg).toBe(175.25);
    });

    it('should check sufficient data', () => {
      expect(hasSufficientData()).toBe(false);
      addLog(mockLog);
      addLog({ ...mockLog, id: 2 });
      addLog({ ...mockLog, id: 3 });
      expect(hasSufficientData()).toBe(true);
    });
  });
});
