// ═══════════════════════════════════════════════════════════════
// KEYS - Atalhos de teclado
// ═══════════════════════════════════════════════════════════════

import { closeAllModals } from './ui.js';

export function initKeyboardShortcuts(onSave, onExportCSV, onExportPDF) {
    document.addEventListener('keydown', e => {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

        // Esc - fechar modais
        if (e.key === 'Escape') {
            closeAllModals();
            return;
        }

        // Ignorar atalhos se estiver digitando em input (exceto Esc)
        if (isInput) return;

        // Ctrl+Shift+S - Salvar registro (evita conflito com "Salvar página")
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            onSave();
            return;
        }

        // Ctrl+Shift+E - Exportar CSV
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            onExportCSV();
            return;
        }

        // Ctrl+Shift+P - Exportar PDF (evita conflito com "Imprimir")
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            onExportPDF();
            return;
        }
    });
}
