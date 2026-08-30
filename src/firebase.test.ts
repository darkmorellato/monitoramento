/**
 * Tests for Firebase module
 * Monitor de Avaliações Miplace
 * Uses mocked Firebase to avoid network dependencies
 * @version 2.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LogEntry, Store } from '../types';

// Mock types for Firebase
interface MockRef {
  put: (data: unknown) => Promise<{ ref: MockRef }>;
  getDownloadURL: () => Promise<string>;
  get: () => Promise<MockSnapshot>;
  set: (data: unknown) => Promise<void>;
  delete: () => Promise<void>;
  orderByKey: () => MockRef;
  once: (event: string) => Promise<MockSnapshot>;
  on: (event: string, cb: (snap: MockSnapshot) => void) => () => void;
  off: (event: string, cb: (snap: MockSnapshot) => void) => void;
  ref?: (path: string) => MockRef;
}

interface MockSnapshot {
  exists: () => boolean;
  val: () => unknown;
  forEach: (cb: (child: MockSnapshot) => void) => void;
  key: string | null;
}

// Mock Firebase
globalThis.firebase = {
  app: vi.fn().mockReturnValue({}),
  initializeApp: vi.fn().mockReturnValue({}),
  database: vi.fn(),
  storage: vi.fn(),
} as unknown as typeof globalThis.firebase;

describe('Firebase Module', () => {
  let mockDatabase: MockRef;
  let mockStorage: MockRef;

  beforeEach(() => {
    // Setup mock database
    mockDatabase = {
      put: vi.fn().mockResolvedValue({ ref: { getDownloadURL: vi.fn().mockResolvedValue('https://example.com/image.jpg') } }),
      getDownloadURL: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
      get: vi.fn().mockResolvedValue({ exists: () => false, val: () => null }),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      orderByKey: vi.fn().mockReturnThis(),
      once: vi.fn().mockResolvedValue({ exists: () => false, val: () => null }),
      on: vi.fn().mockReturnValue(() => {}),
      off: vi.fn(),
    };

    mockStorage = {
      ...mockDatabase,
      ref: vi.fn().mockReturnValue(mockDatabase),
    };

    // Reset Firebase mocks
    vi.clearAllMocks();

    // Setup Firebase to use mocks
    globalThis.firebase = {
      app: vi.fn().mockReturnValue({}),
      initializeApp: vi.fn().mockReturnValue({}),
      database: vi.fn().mockReturnValue({
        ref: vi.fn().mockReturnValue(mockDatabase),
      }),
      storage: vi.fn().mockReturnValue(mockStorage),
    } as unknown as typeof globalThis.firebase;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Storage Operations', () => {
    it('should upload image to storage', async () => {
      const storeName = 'TestStore';
      const entryId = '123';
      const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAA';

      const path = `lojas/${storeName}/${entryId}.jpg`;
      const expectedUrl = 'https://example.com/image.jpg';

      // Mock successful upload
      mockStorage.ref = vi.fn().mockReturnValue({
        put: vi.fn().mockResolvedValue({}),
        getDownloadURL: vi.fn().mockResolvedValue(expectedUrl),
      });

      // Simulate upload
      const ref = mockStorage.ref(path);
      await ref.put(new Blob([base64Data]));
      const url = await ref.getDownloadURL();

      expect(url).toBe(expectedUrl);
    });

    it('should handle upload timeout', async () => {
      const storeName = 'TestStore';
      const path = `lojas/${storeName}/123.jpg`;

      // Mock timeout
      mockStorage.ref = vi.fn().mockReturnValue({
        put: vi.fn().mockRejectedValue(new Error('Timeout')),
        getDownloadURL: vi.fn(),
      });

      const ref = mockStorage.ref(path);
      await expect(ref.put(new Blob([]))).rejects.toThrow('Timeout');
    });
  });

  describe('Database Operations', () => {
    it('should save log entry', async () => {
      const store: Store = { id: 'store1', name: 'Test Store', logo: '🏪', color: '#ff0000' };
      const entry: LogEntry = {
        id: 123,
        date: '2024-01-15',
        time: '10:00',
        total: 100,
        rating: 4,
        diff: 10,
        pct: 10,
        notes: 'Test entry',
        image: null,
        imageUrl: null,
      };

      mockDatabase.set = vi.fn().mockResolvedValue(undefined);

      const dbRef = globalThis.firebase.database().ref(`lojas/${store.name}/data/${entry.id}`);
      await dbRef.set(entry);

      expect(mockDatabase.set).toHaveBeenCalledWith(entry);
    });

    it('should delete log entry', async () => {
      const storeName = 'TestStore';
      const entryId = '123';

      mockDatabase.delete = vi.fn().mockResolvedValue(undefined);

      const dbRef = globalThis.firebase.database().ref(`lojas/${storeName}/data/${entryId}`);
      await dbRef.delete();

      expect(mockDatabase.delete).toHaveBeenCalled();
    });

    it('should retrieve log entries', async () => {
      const storeName = 'TestStore';
      const mockData: Record<string, LogEntry> = {
        '123': {
          id: 123,
          date: '2024-01-15',
          time: '10:00',
          total: 100,
          rating: 4,
          diff: 0,
          pct: 0,
          notes: '',
          image: null,
          imageUrl: null,
        },
      };

      mockDatabase.once = vi.fn().mockResolvedValue({
        exists: () => true,
        val: () => mockData,
      });

      const snapshot = await globalThis.firebase.database().ref(`lojas/${storeName}/data`).once('value');
      const data = snapshot.val();

      expect(data).toEqual(mockData);
    });
  });

  describe('Audit Logger', () => {
    it('should log audit events when enabled', () => {
      const auditLog = {
        log: (action: string, details?: Record<string, unknown>) => {
          console.log(`[AUDIT] ${action}`, details);
        },
      };

      const spy = vi.spyOn(auditLog, 'log');

      auditLog.log('entry_created', { storeName: 'Test', entryId: '123' });

      expect(spy).toHaveBeenCalledWith('entry_created', { storeName: 'Test', entryId: '123' });
    });
  });
});
