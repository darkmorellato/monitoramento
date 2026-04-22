import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializeFirebase,
  getDB,
  getStorage,
  storeRef,
  compressImage,
  saveLogEntry,
  deleteRecordFromDB,
  clearAllDataFromDB,
  auditLogger,
  RateLimiter,
} from '../firebase';
import type { LogEntry, Store } from '../../types';

// Mock Firebase
declare global {
  interface Window {
    firebase: {
      initializeApp: (config: any) => void;
      firestore: () => {
        collection: (path: string) => any;
        doc: (path: string) => any;
        batch: () => any;
        enablePersistence: (opts: any) => Promise<void>;
      };
      storage: () => {
        ref: (path: string) => any;
      };
    };
  }
}

const mockFirebase = {
  initializeApp: vi.fn(),
  firestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            set: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue({ docs: [] }),
          })),
          get: vi.fn().mockResolvedValue({ docs: [] }),
          onSnapshot: vi.fn(() => vi.fn()),
        })),
      })),
    })),
    doc: vi.fn(() => ({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          set: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    })),
    batch: vi.fn(() => ({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
    enablePersistence: vi.fn().mockResolvedValue(undefined),
  })),
  storage: vi.fn(() => ({
    ref: vi.fn(() => ({
      put: vi.fn().mockResolvedValue(undefined),
      getDownloadURL: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
    })),
  })),
};

describe('Firebase Module', () => {
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
    vi.resetAllMocks();
    // @ts-ignore - global firebase mock
    window.firebase = mockFirebase;
    // @ts-ignore - env variables
    import.meta.env = {
      VITE_FIREBASE_API_KEY: 'test-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
      VITE_FIREBASE_APP_ID: '1:123456:web:test',
      VITE_FIREBASE_MEASUREMENT_ID: 'G-TEST',
      VITE_FIREBASE_RATE_LIMIT_MAX_REQUESTS: '100',
      VITE_FIREBASE_RATE_LIMIT_WINDOW_MS: '60000',
      VITE_ENABLE_AUDIT_LOG: 'true',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize Firebase with config', () => {
      initializeFirebase();
      expect(mockFirebase.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-key',
          projectId: 'test-project',
        })
      );
    });

    it('should throw on missing config', () => {
      // @ts-ignore
      import.meta.env.VITE_FIREBASE_API_KEY = '';
      expect(() => initializeFirebase()).toThrow('Missing Firebase configuration');
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });
      limiter.canProceed();
      limiter.canProceed();
      expect(limiter.canProceed()).toBe(false);
    });

    it('should calculate retry after time', () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60000 });
      limiter.canProceed();
      const retryAfter = limiter.getRetryAfter();
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('Audit Logger', () => {
    it('should log actions', () => {
      auditLogger.log('test_action', { storeName: 'test' });
      const logs = auditLogger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('test_action');
      expect(logs[0].storeName).toBe('test');
    });

    it('should limit log size', () => {
      // Add more than max logs
      for (let i = 0; i < 1100; i++) {
        auditLogger.log(`action_${i}`);
      }
      const logs = auditLogger.getRecentLogs(1100);
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Image Compression', () => {
    it('should return null for empty input', async () => {
      const result = await compressImage(null);
      expect(result).toBeNull();
    });

    it('should return null for invalid base64', async () => {
      const result = await compressImage('invalid');
      expect(result).toBeNull();
    });
  });

  describe('Store Reference', () => {
    it('should return null for null store', () => {
      const ref = storeRef(null);
      expect(ref).toBeNull();
    });

    it('should return reference for valid store', () => {
      initializeFirebase();
      const ref = storeRef(mockStore);
      expect(ref).toBeDefined();
    });
  });
});
