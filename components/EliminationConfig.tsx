import React, { useState, useRef } from 'react';
import { EliminationBracket, BracketSlot } from '../types';

interface EliminationConfigProps {
    eliminationBracket: EliminationBracket;
    setEliminationBracket: (bracket: EliminationBracket) => void;
    onFinalizeDrawMode: (mode: 'randomize' | 'use_as_is') => void;
}

const ELIMINATION_ROUNDS = [
    { label: 'Round of 64', value: 'R64', slots: 64 },
    { label: 'Round of 32', value: 'R32', slots: 32 },
    { label: 'Round of 16', value: 'R16', slots: 16 },
    { label: 'Quarter-Finals', value: 'QF', slots: 8 },
    { label: 'Semi-Finals', value: 'SF', slots: 4 },
    { label: 'Finals', value: 'F', slots: 2 },
];

const generateSlots = (count: number): BracketSlot[] =>
    Array.from({ length: count }, (_, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        position: i,
        team: null,
        isFixed: false
    }));

const getRoundName = (round: number, totalRounds: number): string => {
    const d = totalRounds - round;
    if (d === 0) return 'Final';
    if (d === 1) return 'Semi-Finals';
    if (d === 2) return 'Quarter-Finals';
    if (d === 3) return 'Round of 16';
    if (d === 4) return 'Round of 32';
    if (d === 5) return 'Round of 64';
    return `Round ${round}`;
};

interface MatchupData {
    slot1: BracketSlot | null;
    slot2: BracketSlot | null;
    matchNumber: number;
}

const getMatchups = (slots: BracketSlot[]): MatchupData[] => {
    const m: MatchupData[] = [];
    for (let i = 0; i < slots.length; i += 2) {
        m.push({ slot1: slots[i] || null, slot2: slots[i + 1] || null, matchNumber: Math.floor(i / 2) + 1 });
    }
    return m;
};

export const EliminationConfig: React.FC<EliminationConfigProps> = ({
    eliminationBracket,
    setEliminationBracket,
    onFinalizeDrawMode
}) => {
    const [teamListText, setTeamListText] = useState('');
    const [showTeamListPanel, setShowTeamListPanel] = useState(false);
    const [confirmMode, setConfirmMode] = useState<'randomize' | 'use_as_is' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentRound = ELIMINATION_ROUNDS.find(r => r.label === eliminationBracket.roundName) || ELIMINATION_ROUNDS[2];

    const handleRoundChange = (value: string) => {
        const round = ELIMINATION_ROUNDS.find(r => r.value === value);
        if (round) {
            setEliminationBracket({ roundName: round.label, totalSlots: round.slots, slots: generateSlots(round.slots) });
            setTeamListText('');
        }
    };

    const handleSlotNameChange = (slotId: string, name: string) => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s =>
                s.id === slotId
                    ? {
                        ...s,
                        team: name.trim()
                            ? { id: s.team?.id || Math.random().toString(36).substr(2, 9), name, organization: '', tags: [] }
                            : null
                    }
                    : s
            )
        });
    };

    const handleToggleLock = (slotId: string) => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s =>
                s.id === slotId ? { ...s, isFixed: s.team ? !s.isFixed : false } : s
            )
        });
    };

    const clearAllSlots = () => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s => ({ ...s, team: null, isFixed: false }))
        });
    };

    const parseTeamNames = (text: string): string[] =>
        text.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 0);

    const autoPopulateFromList = (teamNames: string[]) => {
        const names = [...teamNames];
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s => {
                // If it's fixed (locked), don't touch it.
                if (s.isFixed) return s;

                // Overwrite all unlocked slots (whether they have a team or not)
                const next = names.shift();

                // If no more names in the list, clear the slot (unless it was already empty)
                if (!next) return { ...s, team: null };

                return { ...s, team: { id: s.team?.id || Math.random().toString(36).substr(2, 9), name: next, organization: '', tags: [] as string[] } };
            })
        });
    };

    const randomFillFromList = (teamNames: string[]) => {
        const shuffled = [...teamNames];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        autoPopulateFromList(shuffled);
    };

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
            const names: string[] = [];
            lines.forEach((line, i) => {
                const parts = line.split(',');
                if (i === 0 && parts[0].toLowerCase().includes('name')) return;
                const name = parts[0].trim();
                if (name) names.push(name);
            });
            setTeamListText(names.join('\n'));
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleApplyTeamList = (mode: 'sequential' | 'random') => {
        const names = parseTeamNames(teamListText);
        if (names.length === 0) { alert('No team names found.'); return; }
        mode === 'sequential' ? autoPopulateFromList(names) : randomFillFromList(names);
    };

    const filledSlots = eliminationBracket.slots.filter(s => s.team).length;
    const emptySlots = eliminationBracket.totalSlots - filledSlots;
    const lockedSlots = eliminationBracket.slots.filter(s => s.isFixed).length;

    return (
        <div className="space-y-6">
            {/* Step 1: Bracket Size */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-2">1. Choose Elimination Bracket</h3>
                <p className="text-sm text-slate-500 mb-4">Select the bracket size for your tournament.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {ELIMINATION_ROUNDS.map(r => (
                        <button key={r.value} onClick={() => handleRoundChange(r.value)}
                            className={`p-4 rounded-lg border-2 text-center transition-all duration-200 ${currentRound.value === r.value
                                ? 'border-orange-500 bg-orange-50 text-orange-800 shadow-md ring-2 ring-orange-200'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50/50'}`}>
                            <div className="text-2xl font-bold">{r.slots}</div>
                            <div className="text-xs font-medium mt-1">{r.label}</div>
                        </button>
                    ))}
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className={`px-3 py-1 rounded-full font-medium ${filledSlots === eliminationBracket.totalSlots ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                        {filledSlots}/{eliminationBracket.totalSlots} slots filled
                    </span>
                    {lockedSlots > 0 && <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">🔒 {lockedSlots} locked</span>}
                    {emptySlots > 0 && <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-medium">{emptySlots} empty</span>}
                </div>
            </div>

            {/* Step 2: Interactive Bracket View */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">2. Set Up Bracket</h3>
                        <p className="text-sm text-slate-500 mt-1">Type team names directly into bracket slots, or use the team list to auto-fill.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowTeamListPanel(!showTeamListPanel)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${showTeamListPanel
                                ? 'bg-blue-600 text-white shadow' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'}`}>
                            📋 {showTeamListPanel ? 'Hide' : 'Show'} Team List
                        </button>
                        <button onClick={clearAllSlots} className="text-slate-500 text-sm hover:text-red-600 hover:underline px-3 py-2">Clear All</button>
                    </div>
                </div>

                {/* Team List Panel */}
                {showTeamListPanel && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-2">Team List Import</h4>
                        <p className="text-xs text-blue-600 mb-3">Add team names (one per line or comma-separated) to fill empty/unlocked bracket slots.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-blue-700 mb-1">Type or paste team names</label>
                                <textarea className="w-full h-40 p-3 border border-blue-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-400 outline-none"
                                    placeholder={"Team Alpha\nTeam Beta\nTeam Charlie\n..."} value={teamListText} onChange={(e) => setTeamListText(e.target.value)} />
                                <p className="text-xs text-blue-500 mt-1">{parseTeamNames(teamListText).length} team(s) detected</p>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-blue-700 mb-1">Or upload CSV</label>
                                    <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleCSVUpload}
                                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" />
                                    <p className="text-xs text-blue-500 mt-1">First column = team name. Header row auto-skipped.</p>
                                </div>
                                <div className="pt-2 space-y-2">
                                    <button onClick={() => handleApplyTeamList('sequential')} disabled={parseTeamNames(teamListText).length === 0}
                                        className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition">
                                        Update Unlocked Slots (Sequential Order)
                                    </button>
                                    <button onClick={() => handleApplyTeamList('random')} disabled={parseTeamNames(teamListText).length === 0}
                                        className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition">
                                        Update Unlocked Slots (Random Order)
                                    </button>
                                </div>
                                <p className="text-xs text-blue-500 italic">💡 Tip: Fill some brackets manually and lock them, then use team list to fill the rest.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Interactive Bracket Visualization */}
                <div className="overflow-x-auto border border-slate-100 rounded-lg bg-slate-50/50">
                    <InteractiveBracketView bracket={eliminationBracket} onNameChange={handleSlotNameChange} onToggleLock={handleToggleLock} />
                </div>

                {emptySlots > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
                        <span>⚠️</span>
                        <span><strong>{emptySlots} bracket slot{emptySlots > 1 ? 's are' : ' is'} empty.</strong> Type team names directly or use the Team List.</span>
                    </div>
                )}
            </div>

            {/* Step 3: Finalize */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-2">3. Finalize Bracket</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Choose to randomize the unlocked teams or use the current bracket as-is.
                    {lockedSlots > 0 && <span className="ml-1 text-yellow-700 font-medium">🔒 {lockedSlots} locked — won't be affected by randomization.</span>}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => setConfirmMode('randomize')} disabled={filledSlots < 2}
                        className="p-6 rounded-lg border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed">
                        <div className="text-3xl mb-2 group-hover:animate-bounce">🎲</div>
                        <div className="font-bold text-orange-800 text-lg">Randomize Bracket</div>
                        <p className="text-xs text-orange-600 mt-1">Shuffle all unlocked teams into random positions.{lockedSlots > 0 && ' Locked teams stay in place.'}</p>
                    </button>
                    <button onClick={() => setConfirmMode('use_as_is')} disabled={filledSlots === 0}
                        className="p-6 rounded-lg border-2 border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed">
                        <div className="text-3xl mb-2">✅</div>
                        <div className="font-bold text-green-800 text-lg">Use Current Bracket</div>
                        <p className="text-xs text-green-600 mt-1">Keep the bracket exactly as you've set it up.</p>
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmMode && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmMode(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 animate-in" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center mb-4">
                            <div className="text-4xl mb-2">{confirmMode === 'randomize' ? '🎲' : '✅'}</div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {confirmMode === 'randomize' ? 'Randomize Bracket?' : 'Use Current Bracket?'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">
                                {confirmMode === 'randomize'
                                    ? `This will shuffle ${filledSlots - lockedSlots} unlocked team(s) into random positions.${lockedSlots > 0 ? ` ${lockedSlots} locked team(s) will stay in place.` : ''}`
                                    : `This will use the bracket exactly as configured with ${filledSlots} team(s).${emptySlots > 0 ? ` ${emptySlots} slot(s) will be empty (BYE).` : ''}`
                                }
                            </p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => { onFinalizeDrawMode(confirmMode); setConfirmMode(null); }}
                                className={`px-6 py-2.5 rounded-lg font-semibold text-white transition ${confirmMode === 'randomize' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                Yes, Proceed
                            </button>
                            <button onClick={() => setConfirmMode(null)}
                                className="px-6 py-2.5 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
                                No, Go Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <strong>How it works:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Type team names directly into bracket slots.</li>
                    <li>Use the <strong>Team List</strong> panel to bulk-import teams via text or CSV.</li>
                    <li>Click the <strong>🔒 lock icon</strong> to prevent a team from being shuffled during randomization.</li>
                    <li>Mix and match: manually place key teams, lock them, then fill the rest from a list.</li>
                    <li>Choose <strong>Randomize</strong> to shuffle unlocked teams, or <strong>Use Current</strong> to keep your arrangement.</li>
                </ul>
            </div>
        </div>
    );
};

// ──── Interactive Bracket View ────

const InteractiveBracketView: React.FC<{
    bracket: EliminationBracket;
    onNameChange: (slotId: string, name: string) => void;
    onToggleLock: (slotId: string) => void;
}> = ({ bracket, onNameChange, onToggleLock }) => {
    // Collect usage counts for duplicate detection
    const teamCounts: Record<string, number> = {};
    bracket.slots.forEach(s => {
        if (s.team?.name) {
            const normalized = s.team.name.toLowerCase().trim();
            teamCounts[normalized] = (teamCounts[normalized] || 0) + 1;
        }
    });

    const totalSlots = bracket.totalSlots;
    const numRounds = Math.log2(totalSlots);
    const halfwayPoint = totalSlots / 2;
    const halfRounds = numRounds - 1;

    const topHalfSlots = bracket.slots.filter(s => s.position < halfwayPoint);
    const bottomHalfSlots = bracket.slots.filter(s => s.position >= halfwayPoint);
    const topMatchups = getMatchups(topHalfSlots);
    const bottomMatchups = getMatchups(bottomHalfSlots);

    // Build half-specific round structure (excluding the final)
    const halfRoundStructure: Array<{ name: string; matchCount: number }> = [];
    let mc = halfwayPoint / 2;
    for (let r = 0; r < halfRounds; r++) {
        halfRoundStructure.push({ name: getRoundName(r + 1, numRounds), matchCount: mc });
        mc = mc / 2;
    }

    // Special case: Finals (2 teams) — no half rounds
    if (numRounds <= 1) {
        return (
            <div className="flex items-center p-4 w-full">
                <div className="flex-1">
                    <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Team 1</div>
                    <EditableMatchupCard matchup={{ slot1: bracket.slots[0], slot2: null, matchNumber: 1 }} onNameChange={onNameChange} onToggleLock={onToggleLock} singleSlot />
                </div>
                <div className="flex flex-col items-center px-6">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Final</div>
                    <div className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 text-center shadow-md">
                        <span className="text-2xl">🏆</span>
                        <div className="text-sm font-bold text-amber-800 mt-2">Champion</div>
                    </div>
                </div>
                <div className="flex-1">
                    <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Team 2</div>
                    <EditableMatchupCard matchup={{ slot1: bracket.slots[1], slot2: null, matchNumber: 2 }} onNameChange={onNameChange} onToggleLock={onToggleLock} singleSlot />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-stretch w-full p-4 gap-3">
            {/* ── LEFT SIDE: Top Half (flows left → right) ── */}
            {halfRoundStructure.map((round, ri) => (
                <div key={`left-${ri}`} className="flex flex-col justify-around flex-1" style={{ minWidth: ri === 0 ? '180px' : '120px' }}>
                    <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{round.name}</div>
                    <div className="flex flex-col justify-around flex-1">
                        {ri === 0 ? (
                            topMatchups.map((matchup, idx) => (
                                <div key={idx} className="mb-2">
                                    <EditableMatchupCard matchup={matchup} onNameChange={onNameChange} onToggleLock={onToggleLock} teamCounts={teamCounts} />
                                </div>
                            ))
                        ) : (
                            Array.from({ length: round.matchCount }).map((_, idx) => (
                                <div key={idx} className="mb-2" style={{ marginTop: ri * 20, marginBottom: ri * 20 }}>
                                    <EmptyCard />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ))}

            {/* ── CENTER: Final + Champion ── */}
            <div className="flex flex-col justify-center items-center px-2" style={{ minWidth: '120px' }}>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Final</div>
                <div className="mb-4"><EmptyCard /></div>
                <div className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 text-center shadow-md">
                    <span className="text-2xl">🏆</span>
                    <div className="text-sm font-bold text-amber-800 mt-2">Champion</div>
                </div>
            </div>

            {/* ── RIGHT SIDE: Bottom Half (flows right → left, reversed columns) ── */}
            {[...halfRoundStructure].reverse().map((round, ri) => {
                const actualRoundIdx = halfRounds - 1 - ri;
                return (
                    <div key={`right-${ri}`} className="flex flex-col justify-around flex-1" style={{ minWidth: actualRoundIdx === 0 ? '180px' : '120px' }}>
                        <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{round.name}</div>
                        <div className="flex flex-col justify-around flex-1">
                            {actualRoundIdx === 0 ? (
                                bottomMatchups.map((matchup, idx) => (
                                    <div key={idx} className="mb-2">
                                        <EditableMatchupCard matchup={matchup} onNameChange={onNameChange} onToggleLock={onToggleLock} teamCounts={teamCounts} />
                                    </div>
                                ))
                            ) : (
                                Array.from({ length: round.matchCount }).map((_, idx) => (
                                    <div key={idx} className="mb-2" style={{ marginTop: actualRoundIdx * 20, marginBottom: actualRoundIdx * 20 }}>
                                        <EmptyCard />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const EditableMatchupCard: React.FC<{
    matchup: MatchupData;
    onNameChange: (slotId: string, name: string) => void;
    onToggleLock: (slotId: string) => void;
    singleSlot?: boolean;
    teamCounts?: Record<string, number>;
}> = ({ matchup, onNameChange, onToggleLock, singleSlot, teamCounts }) => (
    <div className="border border-slate-200 rounded bg-white shadow-sm">
        <EditableSlot slot={matchup.slot1} onNameChange={onNameChange} onToggleLock={onToggleLock} teamCounts={teamCounts} />
        {!singleSlot && matchup.slot2 && (
            <>
                <div className="h-px bg-slate-200" />
                <EditableSlot slot={matchup.slot2} onNameChange={onNameChange} onToggleLock={onToggleLock} teamCounts={teamCounts} />
            </>
        )}
    </div>
);

const EditableSlot: React.FC<{
    slot: BracketSlot | null;
    onNameChange: (slotId: string, name: string) => void;
    onToggleLock: (slotId: string) => void;
    teamCounts?: Record<string, number>;
}> = ({ slot, onNameChange, onToggleLock, teamCounts }) => {
    if (!slot) return <div className="px-2 py-1.5 text-xs text-slate-400 bg-slate-50">—</div>;
    const isEmpty = !slot.team;
    const isLocked = slot.isFixed;
    const isDuplicate = slot.team?.name && teamCounts && teamCounts[slot.team.name.toLowerCase().trim()] > 1;

    return (
        <div className={`flex items-center gap-1 px-1 transition-colors ${
            isLocked ? 'bg-yellow-50' : 
            isDuplicate ? 'bg-red-50 border border-red-200 ring-1 ring-inset ring-red-200' :
            isEmpty ? 'bg-red-50/30' : ''
        }`}>
            <input type="text"
                className={`px-2 py-1.5 text-xs flex-1 bg-transparent outline-none min-w-0 ${
                    isLocked ? 'text-yellow-800 font-medium' : 
                    isDuplicate ? 'text-red-800 font-bold' :
                    isEmpty ? 'placeholder:text-red-300' : 'text-slate-700'
                }`}
                placeholder={`Slot ${slot.position + 1}`}
                value={slot.team?.name || ''}
                onChange={(e) => onNameChange(slot.id, e.target.value)}
                disabled={isLocked} />
            
            {isDuplicate && (
                <span className="text-[10px] text-red-500 font-bold px-1 animate-pulse" title="Duplicate Name detected!">⚠️</span>
            )}

            <button onClick={() => onToggleLock(slot.id)} disabled={!slot.team}
                className={`text-xs px-1 shrink-0 transition ${isLocked ? 'text-yellow-600' : slot.team ? 'text-slate-400 hover:text-slate-600' : 'text-slate-200 cursor-not-allowed'}`}
                title={isLocked ? 'Unlock' : 'Lock'}>
                {isLocked ? '🔒' : '🔓'}
            </button>
        </div>
    );
};

const EmptyCard: React.FC = () => (
    <div className="border border-slate-200 rounded bg-slate-50 shadow-sm">
        <div className="px-2 py-1.5 text-xs text-slate-400 border-b border-slate-200">—</div>
        <div className="px-2 py-1.5 text-xs text-slate-400">—</div>
    </div>
);
