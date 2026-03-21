import { SavedMatchupSchedule, SavedEliminationSchedule, GameCategory, MatchResult, RankingRule } from '../types';

const STORAGE_KEY = 'flexidraw_saved_schedules';
const ELIMINATION_STORAGE_KEY = 'flexidraw_saved_elimination_schedules';
const RESULTS_STORAGE_KEY_PREFIX = 'flexidraw_results_';

export function loadMatchupSchedules(): SavedMatchupSchedule[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveMatchupSchedule(schedule: SavedMatchupSchedule): void {
    const schedules = loadMatchupSchedules();
    schedules.push(schedule);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export function deleteMatchupSchedule(id: string): void {
    const schedules = loadMatchupSchedules().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export function updateMatchupSchedule(id: string, updates: Partial<SavedMatchupSchedule>): void {
    const schedules = loadMatchupSchedules().map(s =>
        s.id === id ? { ...s, ...updates } : s
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export function loadEliminationSchedules(): SavedEliminationSchedule[] {
    try {
        const raw = localStorage.getItem(ELIMINATION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveEliminationSchedule(schedule: SavedEliminationSchedule): void {
    const schedules = loadEliminationSchedules();
    schedules.push(schedule);
    localStorage.setItem(ELIMINATION_STORAGE_KEY, JSON.stringify(schedules));
}

export function deleteEliminationSchedule(id: string): void {
    const schedules = loadEliminationSchedules().filter(s => s.id !== id);
    localStorage.setItem(ELIMINATION_STORAGE_KEY, JSON.stringify(schedules));
}

export function updateEliminationSchedule(id: string, updates: Partial<SavedEliminationSchedule>): void {
    const schedules = loadEliminationSchedules().map(s =>
        s.id === id ? { ...s, ...updates } : s
    );
    localStorage.setItem(ELIMINATION_STORAGE_KEY, JSON.stringify(schedules));
}

export interface ResultsState {
    categories: GameCategory[];
    results: Record<string, MatchResult>;
    rules: RankingRule[];
}

export function loadResultsState(scheduleId: string): ResultsState | null {
    try {
        const raw = localStorage.getItem(`${RESULTS_STORAGE_KEY_PREFIX}${scheduleId}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveResultsState(scheduleId: string, state: ResultsState): void {
    localStorage.setItem(`${RESULTS_STORAGE_KEY_PREFIX}${scheduleId}`, JSON.stringify(state));
}

export function clearResultsState(scheduleId: string): void {
    localStorage.removeItem(`${RESULTS_STORAGE_KEY_PREFIX}${scheduleId}`);
}

