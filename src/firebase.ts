// ═══════════════════════════════════════════════════════════════
// FIREBASE - Init, Config, Firestore Helpers
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui';
import { LogEntry, Store } from '../types';

declare const firebase: any;

const firebaseConfig = {
    apiKey: "AIzaSyBxRJpmbWWgIcA1KkV4TgM6WLhFyVY6Hm4",
    authDomain: "monitoramento-avaliacoes.firebaseapp.com",
    projectId: "monitoramento-avaliacoes",
    storageBucket: "monitoramento-avaliacoes.firebasestorage.app",
    messagingSenderId: "812869615193",
    appId: "1:812869615193:web:ea98ca5c912d3cfcc53b48",
    measurementId: "G-R8S9L9R2RT"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage ? firebase.storage() : null;

// Modo offline — dados em cache mesmo sem internet
db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence desativada: múltiplas abas abertas.');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence não suportada neste navegador.');
    }
});

let fbListener: (() => void) | null = null;

export function getDB(): any { return db; }

export function storeRef(currentStore: Store | null): any {
    if (!currentStore) return null;
    return db.collection('Lojas').doc(currentStore.name).collection('registros');
}

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

async function uploadImageToStorage(base64: string, entryId: number | string, storeName: string): Promise<string | null> {
    if (!storage || !base64) return null;
    try {
        const [meta, data] = base64.split(',');
        const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });

        const path = `lojas/${storeName}/${entryId}.jpg`;
        const ref = storage.ref(path);
        
        await withTimeout(ref.put(blob), 8000);
        return await withTimeout(ref.getDownloadURL(), 5000);
    } catch (err: any) {
        if (err.message === 'Timeout') {
            console.error(`Storage upload timeout: Possível erro de CORS ou conexão lenta.`);
        } else {
            console.error('Storage upload error:', err);
        }
        return null;
    }
}

export async function saveLogEntry(entry: LogEntry, currentStore: Store): Promise<void> {
    const ref = storeRef(currentStore);
    if (!ref) return;
    const docData: any = { ...entry };

    if (entry.image) {
        if (storage) {
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
}

export function listenToStore(store: Store, onUpdate: (logs: LogEntry[]) => void): void {
    if (fbListener) { fbListener(); fbListener = null; }
    const ref = db.collection('Lojas').doc(store.name).collection('registros');
    showToast('⏳ Carregando dados da loja...', 'info');
    fbListener = ref.onSnapshot((snap: any) => {
        const logs = snap.docs.map((d: any) => d.data()) as LogEntry[];
        logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        onUpdate(logs);
    }, (err: any) => {
        console.error('Firestore listener error:', err);
        showToast('❌ Erro ao conectar ao Firestore.', 'error');
    });
}

export function stopListener(): void {
    if (fbListener) { fbListener(); fbListener = null; }
}

export function deleteRecordFromDB(id: string | number, currentStore: Store): void {
    const ref = storeRef(currentStore);
    if (ref) ref.doc(String(id)).delete().catch((err: any) => {
        console.error('Firestore delete error:', err);
        showToast('❌ Erro ao remover registro.', 'error');
    });
}

export async function clearAllDataFromDB(currentStore: Store): Promise<void> {
    const ref = storeRef(currentStore);
    if (!ref) return;
    const snap = await ref.get();
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 499) {
        const batch = db.batch();
        docs.slice(i, i + 499).forEach((d: any) => batch.delete(d.ref));
        await batch.commit().catch((err: any) => console.error('Firestore clearAll error:', err));
    }
}
