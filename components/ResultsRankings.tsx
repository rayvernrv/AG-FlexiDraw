import React, { useState, useEffect, useMemo } from 'react';
import { SavedMatchupSchedule, GameCategory, MatchResult, GameResult, RankingRule, RankingEntry } from '../types';
import { loadMatchupSchedules } from '../services/storageService';
import { computeRankings, DEFAULT_RANKING_RULES } from '../services/rankingEngine';

export const ResultsRankings: React.FC = () => {
    const [schedules, setSchedules] = useState<SavedMatchupSchedule[]>([]);
    const [activeScheduleId, setActiveScheduleId] = useState<string>('');

    // Game Categories Setup
    const [categories, setCategories] = useState<GameCategory[]>([]);
    const [newCatName, setNewCatName] = useState('');

    // Match Results State: matchId -> MatchResult
    const [results, setResults] = useState<Record<string, MatchResult>>({});

    // Ranking Rules State
    const [rules, setRules] = useState<RankingRule[]>(DEFAULT_RANKING_RULES);

    useEffect(() => {
        setSchedules(loadMatchupSchedules());
    }, []);

    const activeSchedule = schedules.find(s => s.id === activeScheduleId);

    // --- Category Management ---
    const addCategory = () => {
        if (!newCatName.trim()) return;
        setCategories([...categories, {
            id: Math.random().toString(36).substr(2, 9),
            name: newCatName.trim(),
            type: 'best_of_3'
        }]);
        setNewCatName('');
    };

    const removeCategory = (id: string) => {
        setCategories(categories.filter(c => c.id !== id));
    };

    // --- Results Management ---
    const handleScoreChange = (matchId: string, catId: string, field: keyof GameResult, value: number) => {
        setResults(prev => {
            const matchResult = prev[matchId] || {
                matchupId: matchId,
                games: categories.map(c => ({ categoryId: c.id, teamASets: 0, teamBSets: 0, teamAPoints: 0, teamBPoints: 0 })),
                isComplete: false,
                teamAMatchWins: 0,
                teamBMatchWins: 0
            };

            const games = matchResult.games.map(g =>
                g.categoryId === catId ? { ...g, [field]: value } : g
            );

            // Check if all needed games have some result to mark as complete
            // For simplicity, we just check if sets > 0 somewhere, or let user explicitly mark
            const isComplete = games.some(g => g.teamASets > 0 || g.teamBSets > 0);

            return { ...prev, [matchId]: { ...matchResult, games, isComplete } };
        });
    };

    // --- Rankings ---
    const { groupRankings, overallRankings } = useMemo(() => {
        if (!activeSchedule) return { groupRankings: {}, overallRankings: [] };
        return computeRankings(activeSchedule.matchups, results, rules);
    }, [activeSchedule, results, rules]);

    // --- Rule Reordering ---
    const moveRule = (index: number, direction: -1 | 1) => {
        const newRules = [...rules];
        if (index + direction < 0 || index + direction >= newRules.length) return;

        const temp = newRules[index];
        newRules[index] = newRules[index + direction];
        newRules[index + direction] = temp;
        setRules(newRules);
    };

    return (
        <div className="space-y-8">

            {/* 1. Schedule Selection */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">1. Select Matchup Schedule</h2>
                {schedules.length === 0 ? (
                    <p className="text-slate-500 italic">No saved schedules found. Please generate and save a schedule in the Group Stage tab first.</p>
                ) : (
                    <select
                        className="w-full md:w-1/2 p-3 border border-slate-300 rounded-lg"
                        value={activeScheduleId}
                        onChange={(e) => setActiveScheduleId(e.target.value)}
                    >
                        <option value="">-- Select a saved schedule --</option>
                        {schedules.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.groups.length} groups, {s.matchups.length} matches)</option>
                        ))}
                    </select>
                )}
            </div>

            {activeSchedule && (
                <>
                    {/* 2. Game Categories Definition */}
                    <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">2. Define Match Categories</h2>
                        <p className="text-sm text-slate-500 mb-4">Define the games played within each match (e.g. Men Singles, Women Doubles). Every match will consist of these categories.</p>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                className="flex-1 p-2 border border-slate-300 rounded focus:ring-brand-500"
                                placeholder="e.g. Men Singles"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                            />
                            <button onClick={addCategory} className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700">Add Category</button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <div key={cat.id} className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium text-slate-700">
                                    {cat.name}
                                    <button onClick={() => removeCategory(cat.id)} className="text-slate-400 hover:text-red-500">&times;</button>
                                </div>
                            ))}
                            {categories.length === 0 && <span className="text-sm text-slate-400 italic">No categories defined yet. Matches will just be 1 generic game.</span>}
                        </div>
                    </div>

                    {categories.length > 0 && (
                        <>
                            {/* 3. Record Results */}
                            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                                <h2 className="text-xl font-bold text-slate-800 mb-4">3. Record Results</h2>

                                <div className="space-y-6">
                                    {activeSchedule.groups.map(group => {
                                        const groupMatchups = activeSchedule.matchups.filter(m => m.groupId === group.id);
                                        return (
                                            <div key={group.id} className="border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="bg-slate-100 p-3 border-b border-slate-200 font-bold text-slate-700">
                                                    {group.name}
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {groupMatchups.map(match => (
                                                        <div key={match.id} className="p-4 bg-white">
                                                            {/* Match Header */}
                                                            <div className="flex justify-between items-center mb-3">
                                                                <div className="flex-1 text-right font-bold text-blue-800 text-lg">{match.teamA.name}</div>
                                                                <div className="px-4 text-slate-400 font-bold text-sm bg-slate-100 rounded-full mx-2 py-1">VS</div>
                                                                <div className="flex-1 text-left font-bold text-purple-800 text-lg">{match.teamB.name}</div>
                                                            </div>

                                                            {/* Categories Score Input */}
                                                            <div className="space-y-2">
                                                                {categories.map(cat => {
                                                                    // Find existing result or default to 0
                                                                    const gameRes = results[match.id]?.games.find(g => g.categoryId === cat.id) ||
                                                                        { teamASets: 0, ObjectteamBSets: 0, teamAPoints: 0, teamBPoints: 0 };

                                                                    return (
                                                                        <div key={cat.id} className="flex items-center justify-center gap-4 bg-slate-50 p-2 rounded">
                                                                            <div className="w-24 text-right">
                                                                                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Sets</div>
                                                                                <input type="number" min="0" className="w-12 p-1 border rounded text-center"
                                                                                    value={gameRes.teamASets !== undefined ? gameRes.teamASets : ''}
                                                                                    onChange={e => handleScoreChange(match.id, cat.id, 'teamASets', e.target.value === '' ? 0 : parseInt(e.target.value, 10))} />
                                                                            </div>

                                                                            <div className="text-center font-medium text-sm text-slate-600 w-32 truncate" title={cat.name}>
                                                                                {cat.name}
                                                                            </div>

                                                                            <div className="w-24 text-left">
                                                                                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Sets</div>
                                                                                <input type="number" min="0" className="w-12 p-1 border rounded text-center"
                                                                                    value={gameRes.teamBSets !== undefined ? gameRes.teamBSets : ''}
                                                                                    onChange={e => handleScoreChange(match.id, cat.id, 'teamBSets', e.target.value === '' ? 0 : parseInt(e.target.value, 10))} />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 4. Ranking Config & Tables */}
                            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                                <div className="flex justify-between items-start mb-6">
                                    <h2 className="text-xl font-bold text-slate-800">4. Live Rankings</h2>

                                    {/* Rule Priority Configurator */}
                                    <div className="bg-slate-50 border border-slate-200 p-3 rounded text-sm w-72 shadow-sm">
                                        <p className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Tiebreaker Priority</p>
                                        <div className="space-y-1">
                                            {rules.map((rule, idx) => (
                                                <div key={rule.id} className="flex justify-between items-center bg-white border border-slate-200 p-1.5 rounded">
                                                    <span className="text-xs font-medium text-slate-600">
                                                        {idx + 1}. {rule.field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => moveRule(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-brand-600 disabled:opacity-30">↑</button>
                                                        <button onClick={() => moveRule(idx, 1)} disabled={idx === rules.length - 1} className="text-slate-400 hover:text-brand-600 disabled:opacity-30">↓</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {/* Group Rankings Tables */}
                                    {Object.entries(groupRankings).map(([groupId, entries]) => (
                                        <div key={groupId} className="overflow-x-auto border border-slate-200 rounded-lg">
                                            <div className="bg-brand-50 p-3 border-b border-slate-200 font-bold text-brand-800">
                                                {entries[0]?.groupName || 'Group'} Ranking
                                            </div>
                                            <table className="w-full text-sm text-left whitespace-nowrap">
                                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-3 w-8">#</th>
                                                        <th className="px-4 py-3">Team</th>
                                                        <th className="px-4 py-3">Org</th>
                                                        <th className="px-4 py-3 text-center" title="Games Played">GP</th>
                                                        <th className="px-4 py-3 text-center" title="Match Wins / Losses">W/L</th>
                                                        <th className="px-4 py-3 text-center" title="Sets Won / Lost">Set W/L</th>
                                                        <th className="px-4 py-3 text-center" title="Set Difference">Set Diff</th>
                                                        <th className="px-4 py-3 text-center text-xs text-slate-400">Tiebreaker</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {((entries as RankingEntry[]) || []).map((entry, idx) => (
                                                        <tr key={entry.teamId} className="hover:bg-slate-50">
                                                            <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                                                            <td className="px-4 py-2 font-bold text-slate-700">{entry.teamName}</td>
                                                            <td className="px-4 py-2 text-slate-500 text-xs">{entry.teamOrganization}</td>
                                                            <td className="px-4 py-2 text-center">{entry.gamesPlayed}</td>
                                                            <td className={`px-4 py-2 text-center font-medium ${entry.gamesWon > entry.gamesLost ? 'text-green-600' : ''}`}>
                                                                {entry.gamesWon} - {entry.gamesLost}
                                                            </td>
                                                            <td className="px-4 py-2 text-center text-xs text-slate-500">{entry.setsWon} - {entry.setsLost}</td>
                                                            <td className="px-4 py-2 text-center font-mono">
                                                                <span className={entry.setDifference > 0 ? 'text-green-600' : entry.setDifference < 0 ? 'text-red-500' : 'text-slate-400'}>
                                                                    {entry.setDifference > 0 ? '+' : ''}{entry.setDifference}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center text-xs text-orange-600 italic">
                                                                {entry.tiebreakerNote}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
