// ═══════════════════════════════════════════════════════════════
// AUTH - Password, Login, Logout, Stores
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui.js';
import { listenToStore, stopListener } from './firebase.js';

const _pwHash = '53b0564c5f33ac0aaaae2b0fea3538643cf723f1f8c0f6d3e2560bf1484abd59';

async function _hashPw(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _checkPw(val) {
    return (await _hashPw(val)) === _pwHash;
}

export let dateUnlocked = false;
export let currentStore = null;
export let selectedStoreId = null;

export const STORES = [
    { id: 'honor',   name: 'Miplace Honor',   logo: 'assets/dp.jpg',     color: '#2563eb' },
    { id: 'realme',  name: 'Miplace Realme',  logo: 'assets/realme.jpg', color: '#16a34a' },
    { id: 'xv',      name: 'Miplace XV',      logo: 'assets/xv.jpg',     color: '#9333ea' },
    { id: 'premium', name: 'Miplace Premium', logo: 'assets/pr.jpg',     color: '#b45309' },
    { id: 'kassouf', name: 'Miplace Kassouf', logo: 'assets/kf.jpg',     color: '#0891b2' },
];

export function setDateUnlocked(val) { dateUnlocked = val; }
export function setCurrentStore(val) { currentStore = val; }

export function requestDateUnlock() {
    if (dateUnlocked) { lockDate(); return; }
    document.getElementById('pwInput').value = '';
    document.getElementById('pwError').classList.add('hidden');
    document.getElementById('pwModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('pwInput').focus(), 100);
}

export async function checkDatePw() {
    const val = document.getElementById('pwInput').value;
    if (await _checkPw(val)) {
        dateUnlocked = true;
        document.getElementById('pwModal').classList.add('hidden');
        document.body.style.overflow = '';
        unlockDate();
        showToast('🔓 Data desbloqueada!', 'success');
    } else {
        document.getElementById('pwError').classList.remove('hidden');
        document.getElementById('pwInput').value = '';
        document.getElementById('pwInput').focus();
        setTimeout(() => document.getElementById('pwError').classList.add('hidden'), 3000);
    }
}

export function closePwModal() {
    document.getElementById('pwModal').classList.add('hidden');
    document.body.style.overflow = '';
}

export function togglePwVisibility() {
    const inp = document.getElementById('pwInput');
    const eye = document.getElementById('pwEye');
    if (inp.type === 'password') {
        inp.type = 'text';
        eye.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        inp.type = 'password';
        eye.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
}

function unlockDate() {
    const dd = document.getElementById('dateDisplay');
    dd.readOnly = false;
    dd.style.pointerEvents = 'auto';
    dd.style.borderColor = 'rgba(34,197,94,0.5)';
    dd.style.background = 'rgba(34,197,94,0.1)';
    dd.style.color = '#86efac';
    dd.oninput = function () {
        const parts = dd.value.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
            document.getElementById('dateInput').value = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    };
    document.getElementById('lockIcon').innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
    document.getElementById('lockLabel').textContent = 'Desbloqueado';
    document.getElementById('unlockDateBtn').className = 'flex items-center gap-1 text-xs font-semibold transition-colors';
    document.getElementById('unlockDateBtn').style.color = '#4ade80';
}

function lockDate() {
    dateUnlocked = false;
    const dd = document.getElementById('dateDisplay');
    dd.readOnly = true;
    dd.style.pointerEvents = 'none';
    dd.oninput = null;
    dd.style.borderColor = 'rgba(245,158,11,0.3)';
    dd.style.background = 'rgba(245,158,11,0.1)';
    dd.style.color = '#fde68a';
    document.getElementById('lockIcon').innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
    document.getElementById('lockLabel').textContent = 'Bloqueado';
    document.getElementById('unlockDateBtn').className = 'flex items-center gap-1 text-xs font-semibold transition-colors';
    document.getElementById('unlockDateBtn').style.color = '#fbbf24';
    showToast('🔒 Data bloqueada novamente.', 'success');
}

export function renderStoreList() {
    const list = document.getElementById('storeList');
    list.innerHTML = STORES.map(s => `
        <button onclick="window.__selectStore('${s.id}')"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-white/20 hover:border-white/40 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group"
            style="background:rgba(255,255,255,0.1);">
            <img src="${s.logo}" alt="${s.name}" style="width:36px;height:36px;object-fit:cover;border-radius:10px;flex-shrink:0;" onerror="this.style.display='none'">
            <span class="flex-1 text-white font-bold text-sm">${s.name}</span>
            <svg class="text-white/40 group-hover:text-white/70 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
    `).join('');
}

export function doLogout(onReset) {
    const storeName = currentStore ? currentStore.name : 'loja';
    if (!confirm(`Sair de ${storeName}?`)) return;
    stopListener();
    currentStore = null;
    selectedStoreId = null;
    dateUnlocked = false;
    localStorage.removeItem('lastStoreId');
    onReset();
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        loginScreen.style.opacity = '0';
        loginScreen.style.transition = 'opacity 0.4s ease';
        setTimeout(() => loginScreen.style.opacity = '1', 10);
    }
    const badge = document.getElementById('storeBadge');
    if (badge) badge.classList.add('hidden');
    document.title = 'Monitor de Avaliações - Google';
}

export function selectStore(id, onInit) {
    const store = STORES.find(s => s.id === id);
    if (!store) return;
    currentStore = store;
    selectedStoreId = id;
    localStorage.setItem('lastStoreId', id);
    const loginScreen = document.getElementById('loginScreen');
    loginScreen.style.transition = 'opacity 0.4s ease';
    loginScreen.style.opacity = '0';
    setTimeout(() => loginScreen.style.display = 'none', 400);
    document.body.style.overflow = '';
    document.getElementById('storeBadge').classList.remove('hidden');
    document.getElementById('storeBadge').classList.add('flex');
    document.getElementById('storeBadgeIcon').innerHTML = `<img src="${store.logo}" alt="${store.name}" style="width:20px;height:20px;object-fit:cover;border-radius:5px;">`;
    document.getElementById('storeBadgeName').textContent = store.name;
    document.title = `Monitor · ${store.name}`;
    onInit();
    listenToStore(store, (logs) => {
        window.__updateAll(logs);
    });
}
