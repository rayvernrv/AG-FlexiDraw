import React, { useEffect, useState } from 'react';
import { liveSyncService, LiveTournamentData } from '../services/liveSyncService';
import { EliminationBracketView } from './EliminationBracketView';
import { computeRankings, DEFAULT_RANKING_RULES } from '../services/rankingEngine';
import { RankingEntry, MatchResult } from '../types';

interface LiveViewerProps {
    tournamentId: string;
}

export const LiveViewer: React.FC<LiveViewerProps> = ({ tournamentId }) => {
    const [data, setData] = useState<LiveTournamentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let subscription: { unsubscribe: () => void } | null = null;

        const loadData = async () => {
            try {
                const initialData = await liveSyncService.fetchTournament(tournamentId);
                if (initialData) {
                    setData(initialData);
                    
                    // Subscribe to real-time updates
                    subscription = liveSyncService.subscribe(tournamentId, (updatedData) => {
                        setData(updatedData);
                    });
                } else {
                    setError('Tournament not found or is no longer live.');
                }
            } catch (err) {
                setError('Failed to connect to live services.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [tournamentId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium italic">Connecting to live tournament data...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center my-12 mx-auto max-w-2xl">
                <span className="text-4xl block mb-4">📡</span>
                <h2 className="text-xl font-bold text-red-800 mb-2">Live Link Unavailable</h2>
                <p className="text-red-600 mb-6">{error || 'This tournament link is invalid.'}</p>
                <button 
                    onClick={() => window.location.href = window.location.pathname}
                    className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:bg-red-100 transition"
                >
                    Return to Main App
                </button>
            </div>
        );
    }

    const { schedule, resultsState } = data;
    const isElimination = 'bracket' in schedule;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Live Updates Enabled</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800">{schedule.name}</h1>
                    <p className="text-sm text-slate-500 font-medium">
                        {isElimination ? 'Direct Bracket Tournament' : 'Group Stage Tournament'}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Last Updated</div>
                    <div className="text-slate-600 font-mono text-sm">{new Date().toLocaleTimeString()}</div>
                </div>
            </header>

            {isElimination ? (
                <div className="space-y-8">
                    {/* Live Match Summary (Ticker) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.keys(resultsState.results)
                            .filter((matchId) => {
                                const res = resultsState.results[matchId];
                                // Find if this match belongs to the current round or is recent
                                const isRelevant = (schedule.matchups as any[]).some(m => m.id === matchId);
                                const hasScores = res.games.some(g => g.teamASets > 0 || g.teamBSets > 0 || g.setScores.some(s => s.teamAPoints !== null));
                                return isRelevant && hasScores;
                            })
                            .map((matchId) => {
                                const res = resultsState.results[matchId];
                                const match = (schedule.matchups as any[]).find(m => m.id === matchId);
                                if (!match) return null;
                                return (
                                    <div key={matchId} className="bg-white p-4 rounded-xl border-l-4 border-l-brand-500 shadow-sm border border-slate-200 animate-pulse-slow">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
                                            <span>Match In Progress</span>
                                            <span className="text-brand-600">Live</span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="text-right flex-1">
                                                <div className="font-black text-slate-800 text-sm truncate">{match.slot1.team?.name || 'TBD'}</div>
                                                <div className="text-[10px] text-slate-400 font-bold">{match.slot1.team?.organization || ''}</div>
                                            </div>
                                            <div className="px-4 text-xs font-black text-slate-300 italic">VS</div>
                                            <div className="text-left flex-1">
                                                <div className="font-black text-slate-800 text-sm truncate">{match.slot2.team?.name || 'TBD'}</div>
                                                <div className="text-[10px] text-slate-400 font-bold">{match.slot2.team?.organization || ''}</div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-2 space-y-2">
                                            {res.games.map((game, i) => {
                                                const cat = (resultsState.roundCategories?.[(schedule as any).currentRoundIndex] || []).find((c: any) => c.id === game.categoryId);
                                                if (!game.teamASets && !game.teamBSets && !game.setScores.some(s => s.teamAPoints !== null)) return null;
                                                return (
                                                    <div key={i} className="flex justify-between items-center text-[10px] font-bold">
                                                        <span className="text-slate-500 truncate max-w-[80px]">{cat?.name || 'Set'}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={game.teamASets > game.teamBSets ? 'text-brand-600' : 'text-slate-400'}>{game.teamASets}</span>
                                                            <span className="text-slate-200">-</span>
                                                            <span className={game.teamBSets > game.teamASets ? 'text-brand-600' : 'text-slate-400'}>{game.teamBSets}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 text-center text-xs font-black text-slate-800">
                                            Match Score: {res.teamAMatchWins} - {res.teamBMatchWins}
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                        <div className="min-w-[800px]">
                            <EliminationBracketView 
                                bracket={(schedule as any).bracket} 
                                showResult={true} 
                                getMatchScore={(roundIndex, matchIndex) => {
                                    const history = (schedule as any).history || [];
                                    if (roundIndex < history.length) {
                                        const matchups = history[roundIndex];
                                        if (matchups && matchups[matchIndex]) {
                                            const matchId = matchups[matchIndex].id;
                                            const res = resultsState.results[matchId];
                                            if (res && res.isComplete) {
                                                return { teamAScore: res.teamAMatchWins, teamBScore: res.teamBMatchWins };
                                            }
                                        }
                                    }
                                    // Also show live scores for the CURRENT round in the bracket!
                                    if (roundIndex === (schedule as any).currentRoundIndex) {
                                        const matchups = (schedule as any).matchups;
                                        if (matchups && matchups[matchIndex]) {
                                            const matchId = matchups[matchIndex].id;
                                            const res = resultsState.results[matchId];
                                            if (res) {
                                                return { teamAScore: res.teamAMatchWins, teamBScore: res.teamBMatchWins };
                                            }
                                        }
                                    }
                                    return null;
                                }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <LiveGroupResults schedule={schedule as any} resultsState={resultsState} />
            )}

            <footer className="text-center py-8 text-slate-400">
                <p className="text-xs font-medium">Powered by <span className="font-bold text-slate-600">FlexiDraw Live Sync</span> • Built with React & Supabase</p>
            </footer>
        </div>
    );
};

const LiveGroupResults: React.FC<{ schedule: any, resultsState: any }> = ({ schedule, resultsState }) => {
    // Re-use logic for rankings
    const rankings = React.useMemo(() => {
        const { groupRankings } = computeRankings(schedule.matchups, resultsState.results, resultsState.rules || DEFAULT_RANKING_RULES);
        return groupRankings;
    }, [schedule, resultsState]);

    return (
        <div className="space-y-8">
            {Object.entries(rankings).map(([groupId, entries]: [string, any]) => (
                <div key={groupId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 font-black text-slate-700 flex justify-between">
                        <span>{entries[0]?.groupName || 'Group'} Ranking</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 w-8">#</th>
                                    <th className="px-6 py-4">Team</th>
                                    <th className="px-6 py-4 text-center">W/L</th>
                                    <th className="px-6 py-4 text-center">Sets Diff</th>
                                    <th className="px-6 py-4 text-center">Pts Diff</th>
                                    <th className="px-6 py-4 text-center font-bold">DPG</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 italic">
                                {entries.map((entry: any, idx: number) => (
                                    <tr key={entry.teamId} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{entry.teamName}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{entry.teamOrganization}</div>
                                        </td>
                                        <td className={`px-6 py-4 text-center font-mono font-bold ${entry.gamesWon > entry.gamesLost ? 'text-green-600' : 'text-slate-600'}`}>
                                            {entry.gamesWon}-{entry.gamesLost}
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono">
                                            <span className={entry.setDifference > 0 ? 'text-green-600' : entry.setDifference < 0 ? 'text-red-500' : 'text-slate-400'}>
                                                {entry.setDifference > 0 ? '+' : ''}{entry.setDifference}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono">
                                            <span className={entry.totalPointsDifference > 0 ? 'text-blue-600' : entry.totalPointsDifference < 0 ? 'text-orange-500' : 'text-slate-400'}>
                                                {entry.totalPointsDifference > 0 ? '+' : ''}{entry.totalPointsDifference}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-black text-slate-800">{entry.deltaPointsPerGame}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};
