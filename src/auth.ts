// ═══════════════════════════════════════════════════════════════
// AUTH - Password, Login, Logout, Stores
// ═══════════════════════════════════════════════════════════════

import { showToast } from './ui';
import { listenToStore, stopListener } from './firebase';
import { 
    getCurrentStore, 
    setCurrentStore, 
    isDateUnlocked, 
    setDateUnlocked 
} from './state';
import { Store, LogEntry } from '../types';

const _pwHash = '53b0564c5f33ac0aaaae2b0fea3538643cf723f1f8c0f6d3e2560bf1484abd59';

async function _hashPw(str: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _checkPw(val: string): Promise<boolean> {
    return (await _hashPw(val)) === _pwHash;
}

export let selectedStoreId: string | null = null;

export const STORES: Store[] = [
    { id: 'honor',   name: 'Miplace Honor',   logo: '/assets/dp.jpg',     color: '#2563eb' },
    { id: 'realme',  name: 'Miplace Realme',  logo: '/assets/realme.jpg', color: '#16a34a' },
    { id: 'xv',      name: 'Miplace XV',      logo: '/assets/xv.jpg',     color: '#9333ea' },
    { id: 'premium', name: 'Miplace Premium', logo: '/assets/pr.jpg',     color: '#b45309' },
    { id: 'kassouf', name: 'Miplace Kassouf', logo: '/assets/kf.jpg',     color: '#0891b2' },
];

// Re-bind callback stored globally to allow re-attachment on logout
let _activeSelectCallback: ((id: string) => void) | null = null;

export function requestDateUnlock(): void {
    if (isDateUnlocked()) { lockDate(); return; }
    const pwInput = document.getElementById('pwInput') as HTMLInputElement;
    const pwError = document.getElementById('pwError');
    const pwModal = document.getElementById('pwModal');
    if(pwInput) pwInput.value = '';
    if(pwError) pwError.classList.add('hidden');
    if(pwModal) pwModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { if(pwInput) pwInput.focus(); }, 100);
}

export async function checkDatePw(): Promise<void> {
    const pwInput = document.getElementById('pwInput') as HTMLInputElement;
    const pwError = document.getElementById('pwError');
    if (!pwInput) return;
    const ok = await _checkPw(pwInput.value);
    if (ok) {
        setDateUnlocked(true);
        unlockDate();
        closePwModal();
        showToast('🔓 Data desbloqueada!', 'success');
    } else {
        if(pwError) pwError.classList.remove('hidden');
        pwInput.value = '';
        pwInput.focus();
    }
}

export function closePwModal(): void {
    const pwModal = document.getElementById('pwModal');
    if(pwModal) pwModal.classList.add('hidden');
    document.body.style.overflow = '';
}

export function togglePwVisibility(): void {
    const pwInput = document.getElementById('pwInput') as HTMLInputElement;
    const pwToggleIcon = document.getElementById('pwToggleIcon');
    if (!pwInput) return;
    if (pwInput.type === 'password') {
        pwInput.type = 'text';
        if(pwToggleIcon) pwToggleIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        pwInput.type = 'password';
        if(pwToggleIcon) pwToggleIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

let _unlockTimeout: ReturnType<typeof setTimeout> | null = null;

export function unlockDate(): void {
    const dd = document.getElementById('dateDisplay') as HTMLInputElement;
    const di = document.getElementById('dateInput') as HTMLInputElement;
    const lockLabel = document.getElementById('lockLabel');
    const unlockBtn = document.getElementById('unlockDateBtn');
    const lockIcon = document.getElementById('lockIcon');

    if(dd) {
        dd.readOnly = false;
        dd.style.pointerEvents = 'auto';
        dd.style.cursor = 'pointer';
        dd.onclick = () => { if(di && typeof di.showPicker === 'function') di.showPicker(); };
        
        // Update di when dd changes (manual typing)
        dd.oninput = (e: any) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length >= 8) {
                const d = v.substring(0, 2), m = v.substring(2, 4), y = v.substring(4, 8);
                const realDate = `${y}-${m}-${d}`;
                if(di) di.value = realDate;
            }
        };

        // Update dd when di changes (calendar picker)
        if(di) {
            di.onchange = (e: any) => {
                const [y, m, d] = e.target.value.split('-');
                if(y && m && d) dd.value = `${d}/${m}/${y}`;
            };
        }

        dd.style.borderColor = 'rgba(34,197,94,0.4)';
        dd.style.background = 'rgba(34,197,94,0.1) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2322c55e\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3\' y=\'4\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\'/%3E%3Cline x1=\'16\' y1=\'2\' x2=\'16\' y2=\'6\'/%3E%3Cline x1=\'8\' y1=\'2\' x2=\'8\' y2=\'6\'/%3E%3Cline x1=\'3\' y1=\'10\' x2=\'21\' y2=\'10\'/%3E%3C/svg%3E") no-repeat right 12px center';
        dd.style.color = '#86efac';
        dd.style.paddingRight = '36px';
    }

    if(lockIcon) {
        lockIcon.innerHTML = '<path d="M7 11V7a5 5 0 0 1 10 0v4" /><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><circle cx="12" cy="16" r="1" />';
        lockIcon.style.color = '#22c55e';
    }
    if(lockLabel) lockLabel.textContent = 'Desbloqueado';
    if(unlockBtn) {
        unlockBtn.classList.remove('text-amber-600');
        unlockBtn.classList.add('text-green-500');
    }

    // Auto-lock after 1 minute
    if(_unlockTimeout) clearTimeout(_unlockTimeout);
    _unlockTimeout = setTimeout(() => {
        if(isDateUnlocked()) lockDate();
    }, 60000);
}

export function lockDate(): void {
    setDateUnlocked(false);
    if(_unlockTimeout) { clearTimeout(_unlockTimeout); _unlockTimeout = null; }

    const dd = document.getElementById('dateDisplay') as HTMLInputElement;
    const di = document.getElementById('dateInput') as HTMLInputElement;
    const lockLabel = document.getElementById('lockLabel');
    const unlockBtn = document.getElementById('unlockDateBtn');
    const lockIcon = document.getElementById('lockIcon');

    if(dd) {
        dd.readOnly = true;
        dd.style.pointerEvents = 'none';
        dd.style.cursor = 'not-allowed';
        dd.onclick = null;
        dd.oninput = null;
        dd.style.borderColor = 'rgba(245,158,11,0.3)';
        dd.style.background = 'rgba(245,158,11,0.1)';
        dd.style.color = '#fde68a';
        dd.style.paddingRight = '';
    }
    if(di) di.onchange = null;

    if(lockIcon) {
        lockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />';
        lockIcon.style.color = 'currentColor';
    }
    if(lockLabel) lockLabel.textContent = 'Bloqueado';
    if(unlockBtn) {
        unlockBtn.classList.remove('text-green-500');
        unlockBtn.classList.add('text-amber-600');
    }
    
    showToast('🔒 Data bloqueada novamente.', 'success');
}

export function renderStoreList(onSelect?: (id: string) => void): void {
    const list = document.getElementById('storeList');
    if(!list) return;
    
    if (onSelect) _activeSelectCallback = onSelect;
    const callback = _activeSelectCallback;
    if (!callback) return;

    list.innerHTML = STORES.map(s => `
        <button data-store-id="${s.id}" type="button"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-white/20 hover:border-white/40 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-sm hover:shadow-md"
            style="background:rgba(255,255,255,0.1);">
            <img src="${s.logo}" alt="${s.name}" style="width:36px;height:36px;object-fit:cover;border-radius:10px;flex-shrink:0;" onerror="this.style.display='none'">
            <span class="flex-1 text-white font-bold text-sm line-clamp-1">${s.name}</span>
            <svg class="text-white/40 group-hover:text-white/70 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18l6-6-6-6"></path>
            </svg>
        </button>
    `).join('');

    list.querySelectorAll('button[data-store-id]').forEach(btn => {
        (btn as HTMLButtonElement).onclick = (e) => {
            e.preventDefault();
            const id = (btn as HTMLElement).getAttribute('data-store-id');
            if(id) {
                console.log(`[auth] clique detectado na loja: ${id}`);
                callback(id);
            }
        };
    });
}

export function doLogout(onReset: () => void): void {
    stopListener();
    setCurrentStore(null);
    selectedStoreId = null;
    setDateUnlocked(false);
    localStorage.removeItem('lastStoreId');
    onReset();
    
    // Re-render the list and re-attach listeners
    renderStoreList();

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        loginScreen.style.opacity = '0';
        loginScreen.style.transform = 'scale(1)';
        loginScreen.style.pointerEvents = 'auto';
        loginScreen.classList.remove('hidden');
        setTimeout(() => { if(loginScreen) loginScreen.style.opacity = '1'; }, 10);
    }
    const badge = document.getElementById('storeBadge');
    if (badge) badge.classList.add('hidden');
    document.title = 'Monitor de Avaliações - Google';
}

export function selectStore(id: string, onInit: (logs: LogEntry[]) => void): void {
    const store = STORES.find(s => s.id === id);
    if (!store) return;
    
    console.log(`[auth] processando login para: ${store.name}`);
    setCurrentStore(store);
    selectedStoreId = id;
    localStorage.setItem('lastStoreId', id);
    
    const loginScreen = document.getElementById('loginScreen');
    if(loginScreen) {
        loginScreen.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        loginScreen.style.opacity = '0';
        loginScreen.style.transform = 'scale(0.98)';
        loginScreen.style.pointerEvents = 'none';
        
        setTimeout(() => { 
            if(loginScreen) {
                loginScreen.style.display = 'none';
                loginScreen.classList.add('hidden');
            }
        }, 450);
    }
    
    document.body.style.overflow = '';
    document.title = `Monitoramento - ${store.name}`;

    // Show store badge in header with logo
    const badge = document.getElementById('storeBadge');
    const badgeIcon = document.getElementById('storeBadgeIcon') as HTMLImageElement;
    const badgeName = document.getElementById('storeBadgeName');
    if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    }
    if (badgeIcon) {
        badgeIcon.src = store.logo;
        badgeIcon.alt = store.name;
        badgeIcon.style.display = '';
    }
    if (badgeName) badgeName.textContent = store.name;
    
    stopListener();
    listenToStore(store, (newLogs) => {
        onInit(newLogs);
    });
}
