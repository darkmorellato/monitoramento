import { Store, LogEntry } from '../types';

interface AppState {
    currentStore: Store | null;
    logs: LogEntry[];
    currentDateUnlocked: boolean;
    datePasswordResolved: ((value: boolean) => void) | null;
}

const state: AppState = {
    currentStore: null,
    logs: [],
    currentDateUnlocked: false,
    datePasswordResolved: null
};

export function getCurrentStore(): Store | null {
    return state.currentStore;
}

export function setCurrentStore(store: Store | null): void {
    state.currentStore = store;
}

export function getLogs(): LogEntry[] {
    return state.logs;
}

export function setLogs(logs: LogEntry[]): void {
    state.logs = logs;
}

export function isDateUnlocked(): boolean {
    return state.currentDateUnlocked;
}

export function setDateUnlocked(unlocked: boolean): void {
    state.currentDateUnlocked = unlocked;
}

export function setDatePasswordResolve(resolveFn: ((value: boolean) => void) | null): void {
    state.datePasswordResolved = resolveFn;
}

export function getDatePasswordResolve(): ((value: boolean) => void) | null {
    return state.datePasswordResolved;
}
