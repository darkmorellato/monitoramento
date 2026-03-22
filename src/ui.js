// ═══════════════════════════════════════════════════════════════
// UI - Toast, Modals, Clock, Confirm Modal
// ═══════════════════════════════════════════════════════════════

let _toastTimer = null;
let _clockStarted = false;
let _confirmResolve = null;

const ICONS = {
    success: `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
    </div>`,
    error: `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
    </div>`,
    warn: `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
    </div>`,
    info: `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    </div>`
};

// ── TOAST ───────────────────────────────────────────────────

export function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMessage');
    const iconEl = document.getElementById('toastIcon');
    msgEl.innerHTML = msg;
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
    iconEl.innerHTML = ICONS[type] || ICONS.info;
    toast.classList.remove('translate-y-20', 'opacity-0');
    _toastTimer = setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); _toastTimer = null; }, 3500);
}

// ── CONFIRM MODAL (substitui confirm() nativo) ──────────────

export function showConfirm(title, message) {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });
}

window.confirmAccept = function () {
    document.getElementById('confirmModal').classList.add('hidden');
    document.body.style.overflow = '';
    if (_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
};

window.confirmCancel = function () {
    document.getElementById('confirmModal').classList.add('hidden');
    document.body.style.overflow = '';
    if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
};

// ── MODALS ──────────────────────────────────────────────────

export function showImageById(logId, logs) {
    const entry = logs.find(l => l.id === logId);
    if (entry && entry.image) {
        document.getElementById('modalImg').src = entry.image;
        document.getElementById('imageModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

export function showImage(src) {
    document.getElementById('modalImg').src = src;
    document.getElementById('imageModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function showNotes(encoded) {
    document.getElementById('notesModalContent').textContent = decodeURIComponent(encoded);
    document.getElementById('notesModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function closeModal(el) {
    el.classList.add('hidden');
    document.body.style.overflow = '';
}

export function closeAllModals() {
    ['imageModal', 'notesModal', 'shareModal', 'pwModal', 'confirmModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
        }
    });
    document.body.style.overflow = '';
}

// ── CLOCK ───────────────────────────────────────────────────

export function startClock(dateUnlocked) {
    if (_clockStarted) return;
    _clockStarted = true;
    function tick() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) timeDisplay.value = `${hh}:${mm}:${ss}`;
        const timeInput = document.getElementById('timeInput');
        if (timeInput) timeInput.value = `${hh}:${mm}`;
        const dateDisplay = document.getElementById('dateDisplay');
        if (dateDisplay && !dateUnlocked()) dateDisplay.value = `${dd}/${mo}/${yyyy}`;
        const dateInput = document.getElementById('dateInput');
        if (dateInput && !dateUnlocked()) dateInput.value = `${yyyy}-${mo}-${dd}`;
    }
    tick();
    setInterval(tick, 1000);
}
