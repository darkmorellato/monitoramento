// ═══════════════════════════════════════════════════════════════
// FIREBASE - Init, Config, Firestore Helpers (Secure)
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui';
import { LogEntry, Store } from '../types';

declare const firebase: any;

// ═══════════════════════════════════════════════════════════════
// ENV CONFIGURATION
// ═══════════════════════════════════════════════════════════════

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

function getFirebaseConfig(): FirebaseConfig {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  // Validate all required fields
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missing.join(', ')}\n` +
      `Please check your .env file and ensure all VITE_FIREBASE_* variables are set.`
    );
  }

  return config as FirebaseConfig;
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.config.windowMs);

    if (this.requests.length >= this.config.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getRetryAfter(): number {
    const now = Date.now();
    const oldest = this.requests[0];
    return oldest ? Math.ceil((this.config.windowMs - (now - oldest)) / 1000) : 0;
  }
}

const rateLimiter = new RateLimiter({
  maxRequests: Number(import.meta.env.VITE_FIREBASE_RATE_LIMIT_MAX_REQUESTS) || 100,
  windowMs: Number(import.meta.env.VITE_FIREBASE_RATE_LIMIT_WINDOW_MS) || 60000,
});

// ═══════════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════════════════════

interface AuditLogEntry {
  timestamp: number;
  action: string;
  storeName?: string;
  recordId?: string | number;
  details?: Record<string, unknown>;
  userAgent: string;
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 1000;
  private enabled: boolean = import.meta.env.VITE_ENABLE_AUDIT_LOG === 'true';

  log(action: string, details?: Omit<AuditLogEntry, 'timestamp' | 'action' | 'userAgent'>): void {
    if (!this.enabled) return;

    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      action,
      userAgent: navigator.userAgent,
      ...details,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // In production, send to secure logging endpoint
    if (import.meta.env.PROD) {
      console.log('[AUDIT]', entry);
    }
  }

  getRecentLogs(limit: number = 50): AuditLogEntry[] {
    return this.logs.slice(-limit);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const auditLogger = new AuditLogger();

// ═══════════════════════════════════════════════════════════════
// FIREBASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════

let db: any = null;
let storage: any = null;
let fbListener: (() => void) | null = null;

export function initializeFirebase(): void {
  if (db) return; // Already initialized

  try {
    const config = getFirebaseConfig();
    firebase.initializeApp(config);
    db = firebase.firestore();
    storage = firebase.storage ? firebase.storage() : null;

    // Modo offline — dados em cache mesmo sem internet
    db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence desativada: múltiplas abas abertas.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence não suportada neste navegador.');
      }
    });

    auditLogger.log('firebase_initialized', { projectId: config.projectId });
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    showToast('❌ Erro ao inicializar Firebase. Verifique a configuração.', 'error');
    throw error;
  }
}

export function getDB(): any {
  if (!db) initializeFirebase();
  return db;
}

export function getStorage(): any {
  if (!storage) initializeFirebase();
  return storage;
}

export function storeRef(currentStore: Store | null): any {
  if (!currentStore) return null;
  const database = getDB();
  return database.collection('Lojas').doc(currentStore.name).collection('registros');
}

// ═══════════════════════════════════════════════════════════════
// IMAGE HANDLING
// ═══════════════════════════════════════════════════════════════

export function compressImage(base64: string | null, maxKB = 700): Promise<string | null> {
  return new Promise(resolve => {
    if (!base64) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const maxDim = 1200;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if(ctx) ctx.drawImage(img, 0, 0, w, h);

      let quality = 0.8;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > maxKB * 1024 * 1.37 && quality > 0.2) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result.length > maxKB * 1024 * 1.37 ? null : result);
    };
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

async function uploadImageToStorage(
  base64: string,
  entryId: number | string,
  storeName: string
): Promise<string | null> {
  const storageInstance = getStorage();
  if (!storageInstance || !base64) return null;

  // Rate limiting check
  if (!rateLimiter.canProceed()) {
    const retryAfter = rateLimiter.getRetryAfter();
    showToast(`⏳ Muitas requisições. Tente novamente em ${retryAfter}s.`, 'warning');
    return null;
  }

  try {
    const [meta, data] = base64.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });

    const path = `lojas/${storeName}/${entryId}.jpg`;
    const ref = storageInstance.ref(path);

    await withTimeout(ref.put(blob), 8000);
    const url = await withTimeout(ref.getDownloadURL(), 5000);

    auditLogger.log('image_uploaded', { storeName, entryId: String(entryId), path });
    return url;
  } catch (err: any) {
    if (err.message === 'Timeout') {
      console.error(`Storage upload timeout: Possível erro de CORS ou conexão lenta.`);
    } else {
      console.error('Storage upload error:', err);
    }
    auditLogger.log('image_upload_failed', { storeName, entryId: String(entryId), error: err.message });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function saveLogEntry(entry: LogEntry, currentStore: Store): Promise<void> {
  // Rate limiting check
  if (!rateLimiter.canProceed()) {
    const retryAfter = rateLimiter.getRetryAfter();
    showToast(`⏳ Muitas requisições. Tente novamente em ${retryAfter}s.`, 'warning');
    return;
  }

  const ref = storeRef(currentStore);
  if (!ref) return;

  const docData: LogEntry & { imageUrl?: string | null } = { ...entry };

  if (entry.image) {
    const storageInstance = getStorage();
    if (storageInstance) {
      const compressed = await compressImage(entry.image);
      const imageSource = compressed || entry.image;
      const url = await uploadImageToStorage(imageSource, entry.id, currentStore.name);
      if (url) {
        docData.image = null;
        docData.imageUrl = url;
      } else {
        docData.image = compressed || null;
        if (!compressed) showToast('⚠️ Imagem muito grande para salvar. Registro salvo sem imagem.', 'error');
      }
    } else {
      const compressed = await compressImage(entry.image);
      if (compressed) {
        docData.image = compressed;
      } else {
        docData.image = null;
        showToast('⚠️ Imagem muito grande para salvar na nuvem. Registro salvo sem imagem.', 'error');
      }
    }
  } else {
    docData.image = null;
  }

  await ref.doc(String(entry.id)).set(docData);
  auditLogger.log('log_entry_saved', { storeName: currentStore.name, recordId: entry.id });
}

export function listenToStore(store: Store, onUpdate: (logs: LogEntry[]) => void): void {
  const database = getDB();

  if (fbListener) { fbListener(); fbListener = null; }
  const ref = database.collection('Lojas').doc(store.name).collection('registros');
  showToast('⏳ Carregando dados da loja...', 'info');

  fbListener = ref.onSnapshot((snap: any) => {
    const logs = snap.docs.map((d: any) => d.data()) as LogEntry[];
    logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    onUpdate(logs);
    auditLogger.log('store_data_loaded', { storeName: store.name, count: logs.length });
  }, (err: any) => {
    console.error('Firestore listener error:', err);
    showToast('❌ Erro ao conectar ao Firestore.', 'error');
    auditLogger.log('store_data_load_failed', { storeName: store.name, error: err.message });
  });
}

export function stopListener(): void {
  if (fbListener) { fbListener(); fbListener = null; }
}

export function deleteRecordFromDB(id: string | number, currentStore: Store): void {
  // Rate limiting check
  if (!rateLimiter.canProceed()) {
    const retryAfter = rateLimiter.getRetryAfter();
    showToast(`⏳ Muitas requisições. Tente novamente em ${retryAfter}s.`, 'warning');
    return;
  }

  const ref = storeRef(currentStore);
  if (ref) {
    ref.doc(String(id)).delete().then(() => {
      auditLogger.log('record_deleted', { storeName: currentStore.name, recordId: String(id) });
    }).catch((err: any) => {
      console.error('Firestore delete error:', err);
      showToast('❌ Erro ao remover registro.', 'error');
      auditLogger.log('record_delete_failed', { storeName: currentStore.name, recordId: String(id), error: err.message });
    });
  }
}

export async function clearAllDataFromDB(currentStore: Store): Promise<void> {
  // Rate limiting check
  if (!rateLimiter.canProceed()) {
    const retryAfter = rateLimiter.getRetryAfter();
    showToast(`⏳ Muitas requisições. Tente novamente em ${retryAfter}s.`, 'warning');
    return;
  }

  const database = getDB();
  const ref = storeRef(currentStore);
  if (!ref) return;

  auditLogger.log('clear_all_started', { storeName: currentStore.name });
  const snap = await ref.get();
  const docs = snap.docs;
  let deletedCount = 0;

  for (let i = 0; i < docs.length; i += 499) {
    const batch = database.batch();
    docs.slice(i, i + 499).forEach((d: any) => batch.delete(d.ref));
    await batch.commit().catch((err: any) => {
      console.error('Firestore clearAll error:', err);
    });
    deletedCount += Math.min(499, docs.length - i);
  }

  auditLogger.log('clear_all_completed', { storeName: currentStore.name, deletedCount });
}
