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

        // Ctrl+S - Salvar registro
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            onSave();
            return;
        }

        // Ctrl+E - Exportar CSV
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            onExportCSV();
            return;
        }

        // Ctrl+P - Exportar PDF (sobrescreve print nativo)
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            onExportPDF();
            return;
        }
    });
}
