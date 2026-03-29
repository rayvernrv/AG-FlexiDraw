import React, { useState, useEffect } from 'react';
import { EliminationBracket, SavedEliminationSchedule, GameCategory, MatchResult, EliminationMatchup, BracketSlot } from '../types';
import { loadEliminationSchedules, saveEliminationSchedule, updateEliminationSchedule, deleteEliminationSchedule, loadResultsState, saveResultsState, clearResultsState } from '../services/storageService';
import { EliminationBracketView } from './EliminationBracketView';
import { exportEliminationResultsToCSV } from '../services/exportService';
import { liveSyncService } from '../services/liveSyncService';
import { LiveLink } from './LiveLink';

export const EliminationMatchManager: React.FC = () => {
    const [schedules, setSchedules] = useState<SavedEliminationSchedule[]>([]);
    const [activeScheduleId, setActiveScheduleId] = useState<string>('');
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [editingScheduleName, setEditingScheduleName] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showRewindConfirm, setShowRewindConfirm] = useState(false);

    // Game Categories State: roundIndex -> GameCategory[]
    const [roundCategories, setRoundCategories] = useState<Record<number, GameCategory[]>>({});
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState<GameCategory['type']>('best_of_3');

    // Filtering state
    const [selectedFilters, setSelectedFilters] = useState<string[]>(['all']);
    // Match Results State: matchId -> MatchResult
    const [results, setResults] = useState<Record<string, MatchResult>>({});

    useEffect(() => {
        setSchedules(loadEliminationSchedules());
    }, []);

    useEffect(() => {
        if (activeScheduleId) {
            const savedState = loadResultsState(activeScheduleId);
            if (savedState) {
                // Migrate old flat categories to round-specific if needed
                let rc = savedState.roundCategories || {};
                if (Object.keys(rc).length === 0 && savedState.categories) {
                    rc[0] = savedState.categories;
                }
                setRoundCategories(rc);
                setResults(savedState.results || {});
            } else {
                setRoundCategories({});
                setResults({});
            }
            setSelectedFilters(['all']);
        } else {
            setRoundCategories({});
            setResults({});
            setSelectedFilters(['all']);
        }
        setShowDeleteConfirm(false);
        setShowRewindConfirm(false);
    }, [activeScheduleId]);

    useEffect(() => {
        if (activeScheduleId) {
            saveResultsState(activeScheduleId, {
                roundCategories,
                results,
                rules: []
            });
        }
    }, [roundCategories, results, activeScheduleId]);

    const activeSchedule = schedules.find(s => s.id === activeScheduleId);

    const currentRoundIndex = activeSchedule?.currentRoundIndex ?? 0;
    const currentCategories = roundCategories[currentRoundIndex] || [];

    // Recalculate match wins when categories change (e.g. category removed/added)
    useEffect(() => {
        if (!activeSchedule || Object.keys(results).length === 0) return;
        const matchCategories = roundCategories[currentRoundIndex] || [];
        const catIds = new Set(matchCategories.map(c => c.id));

        let changed = false;
        const updated = { ...results };
        for (const matchId of Object.keys(updated)) {
            const mr = updated[matchId];
            // Only recalc matches belonging to the current round
            const match = activeSchedule.matchups.find(m => m.id === matchId);
            if (!match) continue;

            let teamAMatchWins = 0;
            let teamBMatchWins = 0;
            mr.games.forEach(g => {
                if (!catIds.has(g.categoryId)) return; // skip removed categories
                const cat = matchCategories.find(c => c.id === g.categoryId);
                const maxSets = cat ? getMaxSets(cat.type) : 3;
                const setsToWin = Math.floor(maxSets / 2) + 1;
                if (g.teamASets >= setsToWin) teamAMatchWins++;
                else if (g.teamBSets >= setsToWin) teamBMatchWins++;
            });

            if (mr.teamAMatchWins !== teamAMatchWins || mr.teamBMatchWins !== teamBMatchWins) {
                updated[matchId] = { ...mr, teamAMatchWins, teamBMatchWins };
                changed = true;
            }
        }
        if (changed) setResults(updated);
    }, [roundCategories, currentRoundIndex]);

    // --- Category Management ---
    const addCategory = () => {
        if (!newCatName.trim()) return;
        setRoundCategories(prev => ({
            ...prev,
            [currentRoundIndex]: [...(prev[currentRoundIndex] || []), {
                id: Math.random().toString(36).substr(2, 9),
                name: newCatName.trim(),
                type: newCatType
            }]
        }));
        setNewCatName('');
    };

    const removeCategory = (id: string) => {
        setRoundCategories(prev => ({
            ...prev,
            [currentRoundIndex]: (prev[currentRoundIndex] || []).filter(c => c.id !== id)
        }));
    };

    const handleClearData = () => {
        if (!activeScheduleId) return;
        if (confirm('Are you sure you want to clear all recorded results and categories for this schedule?')) {
            clearResultsState(activeScheduleId);
            setRoundCategories({});
            setResults({});
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
            const currentMatch = activeSchedule?.matchups.find(m => m.id === matchId);
            const matchRoundIndex = currentMatch?.roundIndex ?? 0;
            const matchCategories = roundCategories[matchRoundIndex] || [];

            const matchResult = prev[matchId] || {
                matchupId: matchId,
                teamAId: currentMatch?.slot1.team?.id,
                teamBId: currentMatch?.slot2.team?.id,
                games: matchCategories.map(c => ({
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

            // Maintain team IDs to track if matchup changes later (for highlighting)
            if (currentMatch) {
                matchResult.teamAId = currentMatch.slot1.team?.id;
                matchResult.teamBId = currentMatch.slot2.team?.id;
            }

            // Ensure game entries exist for all current categories (handles categories added after initial scoring)
            let currentGames = [...matchResult.games];
            for (const cat of matchCategories) {
                if (!currentGames.find(g => g.categoryId === cat.id)) {
                    currentGames.push({
                        categoryId: cat.id,
                        teamASets: 0,
                        teamBSets: 0,
                        teamAPoints: 0,
                        teamBPoints: 0,
                        setScores: Array.from({ length: getMaxSets(cat.type) }, () => ({ teamAPoints: null, teamBPoints: null }))
                    });
                }
            }

            const games = currentGames.map(g => {
                if (g.categoryId !== catId) return g;

                const cat = matchCategories.find(c => c.id === catId);
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

            // Calculate overall Match Wins (only for currently defined categories):
            const activeCatIds = new Set(matchCategories.map(c => c.id));
            let teamAMatchWins = 0;
            let teamBMatchWins = 0;
            games.forEach(g => {
                if (!activeCatIds.has(g.categoryId)) return; // skip removed categories
                const cat = matchCategories.find(c => c.id === g.categoryId);
                const maxSets = cat ? getMaxSets(cat.type) : 3;
                const setsToWin = Math.floor(maxSets / 2) + 1;
                if (g.teamASets >= setsToWin) {
                    teamAMatchWins++;
                } else if (g.teamBSets >= setsToWin) {
                    teamBMatchWins++;
                }
            });

            const isComplete = games.some(g => activeCatIds.has(g.categoryId) && (g.teamASets > 0 || g.teamBSets > 0));

            return { ...prev, [matchId]: { ...matchResult, games, isComplete, teamAMatchWins, teamBMatchWins } };
        });
    };

    // Advancing logic
    const handleAdvanceRound = () => {
        if (!activeSchedule) return;

        // Verify all matchups are complete (have a clear winner based on categories)
        const categoriesCount = currentCategories.length;
        if (categoriesCount === 0) {
            alert("No categories defined. Please define categories and record scores before advancing.");
            return;
        }

        const matchesToWin = Math.floor(categoriesCount / 2) + 1;
        const currentMatchups = activeSchedule.matchups;
        const nextRoundSlots: BracketSlot[] = [];

        for (const match of currentMatchups) {
            let winnerTeam = null;

            // If it's a BYE (one slot is TBD without a team), auto-advance the other
            if (!match.slot1.team) {
                winnerTeam = match.slot2.team;
            } else if (!match.slot2.team) {
                winnerTeam = match.slot1.team;
            } else {
                // Determine by results
                const matchResult = results[match.id];
                if (!matchResult) {
                    alert(`Match ${match.slot1.team.name} vs ${match.slot2.team.name} has no results.`);
                    return;
                }

                if (matchResult.teamAMatchWins >= matchesToWin) {
                    winnerTeam = match.slot1.team;
                } else if (matchResult.teamBMatchWins >= matchesToWin) {
                    winnerTeam = match.slot2.team;
                } else {
                    alert(`Match ${match.slot1.team.name} vs ${match.slot2.team.name} does not have a clear winner yet. Required wins: ${matchesToWin}`);
                    return;
                }
            }

            nextRoundSlots.push({
                id: Math.random().toString(36).substr(2, 9),
                position: match.matchIndex,
                team: winnerTeam,
                isFixed: false
            });
        }

        const newBracket = { ...activeSchedule.bracket };
        const newRounds = newBracket.rounds ? [...newBracket.rounds] : [newBracket.slots];
        newRounds.push(nextRoundSlots);
        newBracket.rounds = newRounds;

        const isFinal = nextRoundSlots.length === 1;

        // Generate matchups for the next round if not final
        const nextMatchups: EliminationMatchup[] = [];
        const nextRoundIndex = activeSchedule.currentRoundIndex + 1;
        if (!isFinal) {
            for (let i = 0; i < nextRoundSlots.length; i += 2) {
                const matchIndex = Math.floor(i / 2);
                nextMatchups.push({
                    id: `match-R${nextRoundIndex}-M${matchIndex}`, // Deterministic ID
                    roundIndex: nextRoundIndex,
                    matchIndex,
                    slot1: nextRoundSlots[i],
                    slot2: nextRoundSlots[i + 1]
                });
            }
        }

        const nextHistory = [...(activeSchedule.history || [activeSchedule.matchups])];
        if (!isFinal) {
            nextHistory.push(nextMatchups);
        }

        const updatedSchedule: SavedEliminationSchedule = {
            ...activeSchedule,
            bracket: newBracket,
            currentRoundIndex: activeSchedule.currentRoundIndex + 1,
            matchups: isFinal ? [] : nextMatchups,
            isComplete: isFinal,
            history: nextHistory
        };

        updateEliminationSchedule(activeSchedule.id, updatedSchedule);
        
        // Inherit categories to next round if they don't exist
        if (!isFinal && (!roundCategories[nextRoundIndex] || roundCategories[nextRoundIndex].length === 0)) {
            setRoundCategories(prev => ({
                ...prev,
                [nextRoundIndex]: currentCategories.map(c => ({...c}))
            }));
        }

        setSchedules(loadEliminationSchedules());

        alert(isFinal ? "Tournament Complete! Showing Champion." : "Advanced to next round! New matchups generated.");
    };

    const handleRewindRound = () => {
        if (!activeSchedule || activeSchedule.currentRoundIndex === 0) return;

        const newBracket = { ...activeSchedule.bracket };
        const newRounds = newBracket.rounds ? [...newBracket.rounds] : [];
        if (newRounds.length > 1) {
            newRounds.pop(); // Remove the deepest round
        }
        newBracket.rounds = newRounds;

        const prevRoundIndex = activeSchedule.currentRoundIndex - 1;
        const history = activeSchedule.history || [];
        
        // Restore matchups perfectly from history to preserve results mapped to their unique ID
        let restoredMatchups: EliminationMatchup[] = [];
        if (history && history[prevRoundIndex]) {
            restoredMatchups = history[prevRoundIndex];
        } else {
            // Fallback generation for older saves that didn't have history array
            const prevSlots = newRounds[prevRoundIndex];
            for (let i = 0; i < prevSlots.length; i += 2) {
                const matchIndex = Math.floor(i / 2);
                restoredMatchups.push({
                    id: `match-R${prevRoundIndex}-M${matchIndex}`,
                    roundIndex: prevRoundIndex,
                    matchIndex,
                    slot1: prevSlots[i],
                    slot2: prevSlots[i + 1]
                });
            }
        }

        // Drop the latest history entry
        const nextHistory = history.slice(0, prevRoundIndex + 1);

        const updatedSchedule: SavedEliminationSchedule = {
            ...activeSchedule,
            bracket: newBracket,
            currentRoundIndex: prevRoundIndex,
            matchups: restoredMatchups,
            isComplete: false, // Ensure we exit completed view
            history: nextHistory.length > 0 ? nextHistory : [restoredMatchups]
        };

        updateEliminationSchedule(activeSchedule.id, updatedSchedule);
        setSchedules(loadEliminationSchedules());
    };

    const getMatchScore = (roundIndex: number, matchIndex: number) => {
        if (!activeSchedule) return null;
        const history = activeSchedule.history || [];
        // If we are looking at a past round
        if (roundIndex < history.length) {
            const matchups = history[roundIndex];
            if (matchups && matchups[matchIndex]) {
                const matchId = matchups[matchIndex].id;
                const matchResult = results[matchId];
                if (matchResult && matchResult.isComplete) {
                    return {
                        teamAScore: matchResult.teamAMatchWins,
                        teamBScore: matchResult.teamBMatchWins
                    };
                }
            }
        }
        return null;
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">1. Select Saved Bracket Matchups</h2>
                {schedules.length === 0 ? (
                    <p className="text-slate-500 italic">No saved bracket schedules found. Please generate and save a schedule from the Draw tab first.</p>
                ) : (
                    <select
                        className="w-full md:w-1/2 p-3 border border-slate-300 rounded-lg"
                        value={activeScheduleId}
                        onChange={(e) => setActiveScheduleId(e.target.value)}
                    >
                        <option value="">-- Select a saved schedule --</option>
                        {schedules.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.isComplete ? 'Completed' : 'Round ' + (s.currentRoundIndex + 1)})</option>
                        ))}
                    </select>
                )}

                {activeSchedule && (
                    <div className="mt-6">
                        <LiveLink 
                            name={activeSchedule.name}
                            type="elimination"
                            schedule={activeSchedule}
                            resultsState={{ roundCategories, results, rules: [] }}
                            currentLiveId={activeSchedule.liveId}
                            onLiveIdCreated={(id) => {
                                updateEliminationSchedule(activeSchedule.id, { ...activeSchedule, liveId: id });
                                setSchedules(loadEliminationSchedules());
                            }}
                        />
                    </div>
                )}
                {activeScheduleId && (
                    <div className="mt-4">
                        {editingScheduleId === activeScheduleId ? (
                            <div className="flex gap-2 w-full md:w-1/2">
                                <input type="text" className="p-2 border rounded-lg flex-1" value={editingScheduleName} onChange={e => setEditingScheduleName(e.target.value)} />
                                <button type="button" onClick={(e) => { 
                                    e.preventDefault();
                                    if (activeSchedule) {
                                        updateEliminationSchedule(activeScheduleId, { ...activeSchedule, name: editingScheduleName }); 
                                        setSchedules(loadEliminationSchedules()); 
                                    }
                                    setEditingScheduleId(null); 
                                }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Save</button>
                                <button type="button" onClick={(e) => { e.preventDefault(); setEditingScheduleId(null); }} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm">Cancel</button>
                            </div>
                        ) : showDeleteConfirm ? (
                            <div className="flex gap-3 items-center bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                                <span className="text-sm font-bold text-red-700">Are you sure?</span>
                                <button type="button" onClick={async () => {
                                    if (activeSchedule?.liveId) {
                                        try { await liveSyncService.terminateTournament(activeSchedule.liveId); } catch(e) { console.error(e); }
                                    }
                                    deleteEliminationSchedule(activeScheduleId);
                                    clearResultsState(activeScheduleId);
                                    setSchedules(loadEliminationSchedules());
                                    setActiveScheduleId('');
                                    setShowDeleteConfirm(false);
                                }} className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-red-700 shadow-sm">Yes, Delete</button>
                                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="text-slate-600 hover:text-slate-800 hover:underline text-sm font-medium px-2">Cancel</button>
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                <button type="button" onClick={(e) => { e.preventDefault(); setEditingScheduleId(activeScheduleId); setEditingScheduleName(activeSchedule?.name || ''); }} className="text-blue-600 font-semibold hover:underline px-3 py-1.5 text-sm border bg-blue-50 border-blue-200 rounded-lg">Rename</button>
                                <button type="button" onClick={(e) => { e.preventDefault(); setShowDeleteConfirm(true); }} className="text-red-600 font-semibold hover:underline px-3 py-1.5 text-sm border bg-red-50 border-red-200 rounded-lg">Delete</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {activeSchedule && (
                <>
                    <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                            <h2 className="text-xl font-bold text-slate-800">Full Bracket View</h2>
                            <button 
                                onClick={() => activeSchedule && exportEliminationResultsToCSV(activeSchedule, results, roundCategories)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2"
                            >
                                <span>📥 Export to Excel (CSV)</span>
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <EliminationBracketView bracket={activeSchedule.bracket} showResult={true} getMatchScore={getMatchScore} />
                        </div>
                    </div>

                    {activeSchedule.isComplete && (
                        <div className="bg-white p-6 rounded-lg shadow border border-slate-200 text-center">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">🏆 Tournament Completed!</h2>
                            <p className="text-slate-600 mb-6 font-medium">The tournament champion has been mathematically crowned.</p>
                            {showRewindConfirm ? (
                                <div className="flex justify-center flex-col md:flex-row gap-3 items-center bg-yellow-50 p-4 rounded-lg border border-yellow-200 inline-flex">
                                    <span className="text-sm font-bold text-yellow-800">Are you sure? Subsequent scores will be lost.</span>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => { setShowRewindConfirm(false); handleRewindRound(); }} className="bg-yellow-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-yellow-700 shadow-sm">Yes, Rewind</button>
                                        <button type="button" onClick={() => setShowRewindConfirm(false)} className="text-slate-600 hover:text-slate-800 hover:underline px-2 text-sm font-medium">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowRewindConfirm(true)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-bold shadow transition inline-flex items-center gap-2"
                                >
                                    <span>&larr;</span> Undo Final Result (Rewind to fix scores)
                                </button>
                            )}
                        </div>
                    )}

                    {!activeSchedule.isComplete && (
                        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-slate-800">2. Define Match Categories for Current Round</h2>
                                <button onClick={handleClearData} className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded text-sm font-medium transition">
                                    Clear All Data
                                </button>
                            </div>

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
                                {currentCategories.map(cat => (
                                    <div key={cat.id} className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium text-slate-700">
                                        {cat.name} <span className="text-xs text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{cat.type.replace(/_/g, ' ').toUpperCase()}</span>
                                        <button onClick={() => removeCategory(cat.id)} className="text-slate-400 hover:text-red-500">&times;</button>
                                    </div>
                                ))}
                                {currentCategories.length === 0 && <span className="text-sm text-slate-400 italic">No categories defined yet. Add some to record scores.</span>}
                            </div>
                        </div>
                    )}

                    {!activeSchedule.isComplete && currentCategories.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <div className="flex flex-wrap items-center gap-4">
                                    <h2 className="text-xl font-bold text-slate-800">3. Record Results (Current Round)</h2>
                                    
                                    {/* Matchup Filter Dropdown */}
                                    <div className="relative">
                                        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1">
                                            <button 
                                                onClick={() => {
                                                    const dropdown = document.getElementById('filter-dropdown');
                                                    if (dropdown) dropdown.classList.toggle('hidden');
                                                }}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-700 flex items-center gap-2 hover:bg-slate-200 rounded transition"
                                            >
                                                <span>🔍 Filter Matchups</span>
                                                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {selectedFilters.includes('all') ? 'All' : selectedFilters.length}
                                                </span>
                                            </button>
                                        </div>
                                        
                                        <div id="filter-dropdown" className="hidden absolute left-0 md:left-auto mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto p-2">
                                            <label className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded border-b border-slate-100 mb-1">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedFilters.includes('all')} 
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedFilters(['all']);
                                                        else setSelectedFilters([]);
                                                    }}
                                                />
                                                <span className="text-sm font-bold text-slate-800">Select All Matchups</span>
                                            </label>
                                            {activeSchedule.matchups.map(m => (
                                                <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedFilters.includes('all') || selectedFilters.includes(m.id)} 
                                                        onChange={(e) => {
                                                            let next;
                                                            if (e.target.checked) {
                                                                const base = selectedFilters.filter(f => f !== 'all');
                                                                next = [...base, m.id];
                                                                if (next.length === activeSchedule.matchups.length) next = ['all'];
                                                                setSelectedFilters(next);
                                                            } else {
                                                                const base = selectedFilters.filter(f => f !== 'all');
                                                                if (selectedFilters.includes('all')) {
                                                                    next = activeSchedule.matchups.map(match => match.id).filter(id => id !== m.id);
                                                                } else {
                                                                    next = base.filter(id => id !== m.id);
                                                                }
                                                                setSelectedFilters(next);
                                                            }
                                                        }}
                                                    />
                                                    <span className="text-sm text-slate-700 truncate">
                                                        {m.slot1.team?.name || 'TBD'} vs {m.slot2.team?.name || 'TBD'}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-3">
                                    {activeSchedule.currentRoundIndex > 0 && (
                                        showRewindConfirm ? (
                                            <div className="flex gap-2 items-center bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-200">
                                                <span className="text-sm font-bold text-yellow-800">Rewind?</span>
                                                <button type="button" onClick={() => { setShowRewindConfirm(false); handleRewindRound(); }} className="bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-yellow-700 shadow">Yes</button>
                                                <button type="button" onClick={() => setShowRewindConfirm(false)} className="text-slate-600 hover:text-slate-800 hover:underline px-2 text-sm font-medium">Cancel</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowRewindConfirm(true)}
                                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold shadow transition"
                                            >
                                                &larr; Undo Advance
                                            </button>
                                        )
                                    )}
                                    {!showRewindConfirm && (
                                        <button
                                            onClick={handleAdvanceRound}
                                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition"
                                        >
                                            Advance Winners
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mb-6">
                                <span className="bg-brand-100 text-brand-800 text-sm font-black px-4 py-1.5 rounded-full border border-brand-200 uppercase tracking-widest shadow-sm">
                                    {(() => {
                                        const totalTeams = activeSchedule.bracket.slots.length;
                                        const totalRounds = Math.ceil(Math.log2(totalTeams));
                                        const roundsRemaining = totalRounds - activeSchedule.currentRoundIndex;
                                        switch (roundsRemaining) {
                                            case 1: return "Finals";
                                            case 2: return "Semi Finals";
                                            case 3: return "Quarter Finals";
                                            case 4: return "Round of 16";
                                            case 5: return "Round of 32";
                                            case 6: return "Round of 64";
                                            default: return `Round ${activeSchedule.currentRoundIndex + 1}`;
                                        }
                                    })()}
                                </span>
                            </div>

                            <div className="space-y-6">
                                {activeSchedule.matchups.filter(m => selectedFilters.includes('all') || selectedFilters.includes(m.id)).map(match => {
                                    // if bye, show empty
                                    if (!match.slot1.team || !match.slot2.team) {
                                        return (
                                            <div key={match.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-center text-slate-500 italic">
                                                {match.slot1.team?.name || match.slot2.team?.name || 'TBD'} automatically advances (BYE).
                                            </div>
                                        );
                                    }

                                    const matchResult = results[match.id] || { teamAMatchWins: 0, teamBMatchWins: 0 };
                                    
                                    // Highlighting logic for affected matches (winning team changed in previous round)
                                    const isStale = matchResult.isComplete && (
                                        (matchResult.teamAId && matchResult.teamAId !== match.slot1.team.id) || 
                                        (matchResult.teamBId && matchResult.teamBId !== match.slot2.team.id)
                                    );

                                    const matchWinner = matchResult.teamAMatchWins > matchResult.teamBMatchWins
                                        ? match.slot1.team.name
                                        : matchResult.teamBMatchWins > matchResult.teamAMatchWins
                                            ? match.slot2.team.name
                                            : null;

                                    return (
                                        <div key={match.id} className={`border rounded-lg overflow-hidden bg-white transition-all ${isStale ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}>
                                            {isStale && (
                                                <div className="bg-amber-100 px-4 py-1 text-[10px] font-bold text-amber-800 uppercase tracking-widest text-center">
                                                    ⚠️ Affected by score change in previous round
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center mb-3 p-4 border-b border-slate-100">
                                                <div className="flex-1 text-right font-bold text-blue-800 text-lg">
                                                    {match.slot1.team.name}
                                                    {matchWinner === match.slot1.team.name && <span className="ml-2 text-green-500">✓</span>}
                                                </div>
                                                <div className="px-4 text-slate-400 font-bold text-sm bg-slate-100 rounded-full mx-2 py-1 flex flex-col items-center">
                                                    <span>VS</span>
                                                    <span className="text-xs text-blue-800">{matchResult.teamAMatchWins} - {matchResult.teamBMatchWins}</span>
                                                </div>
                                                <div className="flex-1 text-left font-bold text-purple-800 text-lg">
                                                    {matchWinner === match.slot2.team.name && <span className="mr-2 text-green-500">✓</span>}
                                                    {match.slot2.team.name}
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-4">
                                                {currentCategories.map(cat => {
                                                    const maxSets = getMaxSets(cat.type);
                                                    const gameRes = results[match.id]?.games.find(g => g.categoryId === cat.id) ||
                                                        { teamASets: 0, teamBSets: 0, setScores: Array.from({ length: maxSets }, () => ({ teamAPoints: null, teamBPoints: null })) };
                                                    const setScores = gameRes.setScores || Array.from({ length: maxSets }, () => ({ teamAPoints: null, teamBPoints: null }));

                                                    const setsToWin = Math.floor(maxSets / 2) + 1;
                                                    const catWinner = gameRes.teamASets >= setsToWin ? 'A' : gameRes.teamBSets >= setsToWin ? 'B' : null;

                                                    return (
                                                        <div key={cat.id} className="bg-slate-50 p-3 rounded border border-slate-100">
                                                            <div className="text-center font-bold text-sm text-slate-700 mb-3 flex items-center justify-center gap-2">
                                                                {catWinner === 'A' && <span className="text-green-500 text-xs">✓ Winner</span>}
                                                                {cat.name} <span className="text-xs font-normal text-slate-500">({cat.type.replace(/_/g, ' ').toUpperCase()})</span>
                                                                {catWinner === 'B' && <span className="text-green-500 text-xs text-right">✓ Winner</span>}
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                {Array.from({ length: maxSets }).map((_, setIdx) => {
                                                                    const setScore = setScores[setIdx] || { teamAPoints: null, teamBPoints: null };
                                                                    return (
                                                                        <div key={setIdx} className="flex justify-center items-center gap-4">
                                                                            <div className="text-xs font-bold text-slate-400 w-12 text-right">Set {setIdx + 1}</div>
                                                                            <DecimalInput 
                                                                                value={setScore.teamAPoints !== undefined ? setScore.teamAPoints : null}
                                                                                onChange={val => handleSetScoreChange(match.id, cat.id, setIdx, 'teamAPoints', val)} 
                                                                            />
                                                                            <div className="text-slate-300 font-bold">-</div>
                                                                            <DecimalInput 
                                                                                value={setScore.teamBPoints !== undefined ? setScore.teamBPoints : null}
                                                                                onChange={val => handleSetScoreChange(match.id, cat.id, setIdx, 'teamBPoints', val)} 
                                                                            />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="mt-3 pt-2 border-t border-slate-200 flex justify-center gap-6 text-xs font-medium text-slate-500">
                                                                <div>Sets: <span className="text-blue-700 font-bold">{gameRes.teamASets}</span> - <span className="text-purple-700 font-bold">{gameRes.teamBSets}</span></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const DecimalInput: React.FC<{ value: number | null, onChange: (val: number | null) => void }> = ({ value, onChange }) => {
    const [local, setLocal] = useState(value !== null ? String(value) : '');
    useEffect(() => {
        if (value === null) setLocal('');
        else if (parseInt(local) !== value) {
            setLocal(String(value));
        }
    }, [value]);
    
    return <input type="number" step="1" min="0" className="w-16 p-1 border rounded text-center font-mono focus:ring-2 focus:ring-brand-500 outline-none" 
        value={local} 
        onKeyDown={e => {
            if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === '.') {
                e.preventDefault();
            }
        }}
        onChange={e => {
            const v = e.target.value;
            if (v !== '' && !/^\d+$/.test(v)) return;
            setLocal(v);
            onChange(v === '' ? null : parseInt(v, 10));
        }} 
    />;
};
