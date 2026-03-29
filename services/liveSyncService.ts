import { supabase } from './supabaseClient';
import { SavedMatchupSchedule, SavedEliminationSchedule, MatchResult, GameCategory, RankingRule } from '../types';

export interface ResultsState {
    categories?: GameCategory[];
    roundCategories?: Record<number, GameCategory[]>;
    results: Record<string, MatchResult>;
    rules: RankingRule[];
}

export interface LiveTournamentData {
    schedule: SavedMatchupSchedule | SavedEliminationSchedule;
    resultsState: ResultsState;
}

export const liveSyncService = {
    /**
     * Publish a new live tournament or update if id exists
     */
    async publishTournament(name: string, type: 'group' | 'elimination', data: LiveTournamentData, existingId?: string) {
        if (existingId) {
            const { error } = await supabase
                .from('live_tournaments')
                .update({ name, type, data, updated_at: new Date().toISOString() })
                .eq('id', existingId);
            
            if (error) throw error;
            return existingId;
        } else {
            const { data: inserted, error } = await supabase
                .from('live_tournaments')
                .insert([{ name, type, data }])
                .select();
            
            if (error) throw error;
            return inserted[0].id;
        }
    },

    /**
     * Subscribe to real-time changes for a specific tournament
     */
    subscribe(id: string, onUpdate: (data: LiveTournamentData | null) => void) {
        return supabase
            .channel(`tournament-${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'live_tournaments', filter: `id=eq.${id}` },
                (payload) => {
                    onUpdate(payload.new.data as LiveTournamentData);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'live_tournaments', filter: `id=eq.${id}` },
                () => {
                    onUpdate(null); // Signal that it's gone
                }
            )
            .subscribe();
    },

    /**
     * Terminate a live tournament (delete from Supabase)
     */
    async terminateTournament(id: string) {
        const { error } = await supabase
            .from('live_tournaments')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    /**
     * Fetch the current state of a live tournament
     */
    async fetchTournament(id: string): Promise<LiveTournamentData | null> {
        const { data, error } = await supabase
            .from('live_tournaments')
            .select('data')
            .eq('id', id)
            .single();
        
        if (error || !data) return null;
        return data.data as LiveTournamentData;
    }
};
