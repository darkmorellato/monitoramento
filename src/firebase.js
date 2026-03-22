// ═══════════════════════════════════════════════════════════════
// FIREBASE - Init, Config, Firestore Helpers
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui.js';

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
let fbListener = null;

export function getDB() { return db; }

export function storeRef(currentStore) {
    if (!currentStore) return null;
    return db.collection('Lojas').doc(currentStore.name).collection('registros');
}

export function compressImage(base64, maxKB = 700) {
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
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
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

export async function saveLogEntry(entry, currentStore) {
    const ref = storeRef(currentStore);
    if (!ref) return;
    const docData = { ...entry };
    if (entry.image) {
        const compressed = await compressImage(entry.image);
        if (compressed) {
            docData.image = compressed;
        } else {
            docData.image = null;
            showToast('⚠️ Imagem muito grande para salvar na nuvem. Registro salvo sem imagem.', 'error');
        }
    } else {
        docData.image = null;
    }
    await ref.doc(String(entry.id)).set(docData);
}

export function listenToStore(store, onUpdate) {
    if (fbListener) { fbListener(); fbListener = null; }
    const ref = db.collection('Lojas').doc(store.name).collection('registros');
    showToast('⏳ Carregando dados da loja...', 'success');
    fbListener = ref.onSnapshot(snap => {
        const logs = snap.docs.map(d => d.data());
        logs.sort((a, b) => new Date(a.date) - new Date(b.date));
        onUpdate(logs);
    }, err => {
        console.error('Firestore listener error:', err);
        showToast('❌ Erro ao conectar ao Firestore.', 'error');
    });
}

export function stopListener() {
    if (fbListener) { fbListener(); fbListener = null; }
}

export function deleteRecordFromDB(id, currentStore) {
    const ref = storeRef(currentStore);
    if (ref) ref.doc(String(id)).delete().catch(err => console.error('Firestore delete error:', err));
}

export async function clearAllDataFromDB(currentStore) {
    const ref = storeRef(currentStore);
    if (ref) {
        const snap = await ref.get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit().catch(err => console.error('Firestore clearAll error:', err));
    }
}
