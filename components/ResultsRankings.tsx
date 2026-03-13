import React, { useState, useEffect, useMemo } from 'react';
import { SavedMatchupSchedule, GameCategory, MatchResult, GameResult, RankingRule, RankingEntry } from '../types';
import { loadMatchupSchedules, loadResultsState, saveResultsState, clearResultsState } from '../services/storageService';
import { computeRankings, DEFAULT_RANKING_RULES } from '../services/rankingEngine';

export const ResultsRankings: React.FC = () => {
    const [schedules, setSchedules] = useState<SavedMatchupSchedule[]>([]);
    const [activeScheduleId, setActiveScheduleId] = useState<string>('');

    // Game Categories Setup
    const [categories, setCategories] = useState<GameCategory[]>([]);
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState<GameCategory['type']>('best_of_3');

    // Match Results State: matchId -> MatchResult
    const [results, setResults] = useState<Record<string, MatchResult>>({});

    // Ranking Rules State
    const [rules, setRules] = useState<RankingRule[]>(DEFAULT_RANKING_RULES);

    useEffect(() => {
        setSchedules(loadMatchupSchedules());
    }, []);

    useEffect(() => {
        if (activeScheduleId) {
            const savedState = loadResultsState(activeScheduleId);
            if (savedState) {
                setCategories(savedState.categories || []);
                setResults(savedState.results || {});
                setRules(savedState.rules || DEFAULT_RANKING_RULES);
            } else {
                setCategories([]);
                setResults({});
                setRules(DEFAULT_RANKING_RULES);
            }
        } else {
            setCategories([]);
            setResults({});
            setRules(DEFAULT_RANKING_RULES);
        }
    }, [activeScheduleId]);

    useEffect(() => {
        if (activeScheduleId) {
            saveResultsState(activeScheduleId, {
                categories,
                results,
                rules
            });
        }
    }, [categories, results, rules, activeScheduleId]);

    const activeSchedule = schedules.find(s => s.id === activeScheduleId);

    // --- Category Management ---
    const addCategory = () => {
        if (!newCatName.trim()) return;
        setCategories([...categories, {
            id: Math.random().toString(36).substr(2, 9),
            name: newCatName.trim(),
            type: newCatType
        }]);
        setNewCatName('');
        // Removed resetting type to improve UX
    };

    const removeCategory = (id: string) => {
        setCategories(categories.filter(c => c.id !== id));
    };

    const handleClearData = () => {
        if (!activeScheduleId) return;
        if (confirm('Are you sure you want to clear all recorded results and categories for this schedule?')) {
            clearResultsState(activeScheduleId);
            setCategories([]);
            setResults({});
            setRules(DEFAULT_RANKING_RULES);
        }
    };

    const getMaxSets = (type: GameCategory['type']) => {
        switch (type) {
            case 'best_of_1': return 1;
            case 'best_of_3': return 3;
            case 'best_of_5': return 5;
            case 'best_of_7': return 7;
            default: return 3;
        }
    };

    // --- Results Management ---
    const handleSetScoreChange = (matchId: string, catId: string, setIndex: number, field: 'teamAPoints' | 'teamBPoints', value: number | null) => {
        setResults(prev => {
            const matchResult = prev[matchId] || {
                matchupId: matchId,
                games: categories.map(c => ({
                    categoryId: c.id,
                    teamASets: 0,
                    teamBSets: 0,
                    teamAPoints: 0,
                    teamBPoints: 0,
                    setScores: Array.from({ length: getMaxSets(c.type) }, () => ({ teamAPoints: null, teamBPoints: null }))
                })),
                isComplete: false,
                teamAMatchWins: 0,
                teamBMatchWins: 0
            };

            const games = matchResult.games.map(g => {
                if (g.categoryId !== catId) return g;

                const cat = categories.find(c => c.id === catId);
                const maxSets = cat ? getMaxSets(cat.type) : 3;
                let currentSetScores = g.setScores ? [...g.setScores] : [];
                while (currentSetScores.length < maxSets) {
                    currentSetScores.push({ teamAPoints: null, teamBPoints: null });
                }

                currentSetScores[setIndex] = { ...currentSetScores[setIndex], [field]: value };

                let teamASets = 0;
                let teamBSets = 0;
                let teamAPoints = 0;
                let teamBPoints = 0;

                currentSetScores.forEach(set => {
                    teamAPoints += set.teamAPoints || 0;
                    teamBPoints += set.teamBPoints || 0;

                    if ((set.teamAPoints || 0) > (set.teamBPoints || 0)) teamASets++;
                    else if ((set.teamBPoints || 0) > (set.teamAPoints || 0)) teamBSets++;
                });

                return { ...g, setScores: currentSetScores, teamASets, teamBSets, teamAPoints, teamBPoints };
            });

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
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-800">2. Define Match Categories</h2>
                            <button onClick={handleClearData} className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded text-sm font-medium transition">
                                Clear All Data
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">Define the games played within each match (e.g. Men Singles, Women Doubles). Every match will consist of these categories.</p>

                        <div className="flex flex-col md:flex-row gap-2 mb-4">
                            <input
                                type="text"
                                className="flex-1 p-2 border border-slate-300 rounded focus:ring-brand-500"
                                placeholder="e.g. Men Singles"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                            />
                            <select
                                className="p-2 border border-slate-300 rounded focus:ring-brand-500 text-slate-700 font-medium"
                                value={newCatType}
                                onChange={(e) => setNewCatType(e.target.value as GameCategory['type'])}
                            >
                                <option value="best_of_1">Best of 1</option>
                                <option value="best_of_3">Best of 3</option>
                                <option value="best_of_5">Best of 5</option>
                                <option value="best_of_7">Best of 7</option>
                            </select>
                            <button onClick={addCategory} className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700">Add Category</button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <div key={cat.id} className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium text-slate-700">
                                    {cat.name} <span className="text-xs text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{cat.type.replace(/_/g, ' ').toUpperCase()}</span>
                                    <button onClick={() => removeCategory(cat.id)} className="text-slate-400 hover:text-red-500">&times;</button>
                                </div>
                            ))}
                            {categories.length === 0 && <span className="text-sm text-slate-400 italic">No categories defined yet. Matches will just be 1 generic game.</span>}
                        </div>
                    </div>

                    {categories.length > 0 && (
                        <div className="flex flex-col xl:flex-row gap-6 items-start">
                            {/* 3. Record Results (Left Side) */}
                            <div className="bg-white p-6 rounded-lg shadow border border-slate-200 xl:w-1/2 w-full sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                                <h2 className="text-xl font-bold text-slate-800 mb-4 sticky top-0 bg-white z-10 py-2 border-b border-white">3. Record Results</h2>

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
                                                            <div className="space-y-4">
                                                                {categories.map(cat => {
                                                                    const maxSets = getMaxSets(cat.type);
                                                                    const gameRes = results[match.id]?.games.find(g => g.categoryId === cat.id) ||
                                                                        { teamASets: 0, teamBSets: 0, teamAPoints: 0, teamBPoints: 0, setScores: Array.from({ length: maxSets }, () => ({ teamAPoints: null, teamBPoints: null })) };

                                                                    const setScores = gameRes.setScores || Array.from({ length: maxSets }, () => ({ teamAPoints: null, teamBPoints: null }));

                                                                    return (
                                                                        <div key={cat.id} className="bg-slate-50 p-3 rounded border border-slate-100">
                                                                            <div className="text-center font-bold text-sm text-slate-700 mb-3">{cat.name} <span className="text-xs font-normal text-slate-500">({cat.type.replace(/_/g, ' ').toUpperCase()})</span></div>
                                                                            <div className="flex flex-col gap-2">
                                                                                {Array.from({ length: maxSets }).map((_, setIdx) => {
                                                                                    const setScore = setScores[setIdx] || { teamAPoints: null, teamBPoints: null };
                                                                                    return (
                                                                                        <div key={setIdx} className="flex justify-center items-center gap-4">
                                                                                            <div className="text-xs font-bold text-slate-400 w-12 text-right">Set {setIdx + 1}</div>
                                                                                            <input type="number" min="0" className="w-16 p-1 border rounded text-center font-mono"
                                                                                                value={setScore.teamAPoints !== undefined && setScore.teamAPoints !== null ? setScore.teamAPoints : ''}
                                                                                                onChange={e => handleSetScoreChange(match.id, cat.id, setIdx, 'teamAPoints', e.target.value === '' ? null : parseInt(e.target.value, 10))} />
                                                                                            <div className="text-slate-300 font-bold">-</div>
                                                                                            <input type="number" min="0" className="w-16 p-1 border rounded text-center font-mono"
                                                                                                value={setScore.teamBPoints !== undefined && setScore.teamBPoints !== null ? setScore.teamBPoints : ''}
                                                                                                onChange={e => handleSetScoreChange(match.id, cat.id, setIdx, 'teamBPoints', e.target.value === '' ? null : parseInt(e.target.value, 10))} />
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            <div className="mt-3 pt-2 border-t border-slate-200 flex justify-center gap-6 text-xs font-medium text-slate-500">
                                                                                <div>Sets: <span className="text-blue-700 font-bold">{gameRes.teamASets}</span> - <span className="text-purple-700 font-bold">{gameRes.teamBSets}</span></div>
                                                                                <div>Total Pts: <span className="font-bold">{gameRes.teamAPoints}</span> - <span className="font-bold">{gameRes.teamBPoints}</span></div>
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

                            {/* 4. Ranking Config & Tables (Right Side) */}
                            <div className="bg-white p-6 rounded-lg shadow border border-slate-200 xl:w-1/2 w-full">
                                <div className="flex justify-between items-start mb-6 sticky top-24 bg-white z-10 py-2 border-b border-white">
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
                                                        <th className="px-4 py-3 text-center" title="Total Points Won">Pts W</th>
                                                        <th className="px-4 py-3 text-center" title="Total Points Lost">Pts L</th>
                                                        <th className="px-4 py-3 text-center" title="Points Difference">Pts Diff</th>
                                                        <th className="px-4 py-3 text-center" title="Delta Points Per Game">DPG</th>
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
                                                            <td className="px-4 py-2 text-center font-mono text-xs">
                                                                <span className={entry.setDifference > 0 ? 'text-green-600' : entry.setDifference < 0 ? 'text-red-500' : 'text-slate-400'}>
                                                                    {entry.setDifference > 0 ? '+' : ''}{entry.setDifference}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center text-xs text-slate-500">{entry.totalPointsWon}</td>
                                                            <td className="px-4 py-2 text-center text-xs text-slate-500">{entry.totalPointsLost}</td>
                                                            <td className="px-4 py-2 text-center font-mono text-xs">
                                                                <span className={entry.totalPointsDifference > 0 ? 'text-green-600' : entry.totalPointsDifference < 0 ? 'text-red-500' : 'text-slate-400'}>
                                                                    {entry.totalPointsDifference > 0 ? '+' : ''}{entry.totalPointsDifference}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center font-bold text-xs text-slate-700">{entry.deltaPointsPerGame}</td>
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
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
