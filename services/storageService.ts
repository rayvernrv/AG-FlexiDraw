import { SavedMatchupSchedule } from '../types';

const STORAGE_KEY = 'flexidraw_saved_schedules';

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
