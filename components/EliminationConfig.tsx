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

const generateSlots = (count: number): BracketSlot[] => {
    return Array.from({ length: count }, (_, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        position: i,
        team: null,
        isFixed: false
    }));
};

export const EliminationConfig: React.FC<EliminationConfigProps> = ({
    eliminationBracket,
    setEliminationBracket,
    onFinalizeDrawMode
}) => {
    const [teamListText, setTeamListText] = useState('');
    const [showTeamListPanel, setShowTeamListPanel] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentRound = ELIMINATION_ROUNDS.find(r => r.label === eliminationBracket.roundName) || ELIMINATION_ROUNDS[2];
    const halfwayPoint = eliminationBracket.totalSlots / 2;

    // ──── Round Selection ────
    const handleRoundChange = (value: string) => {
        const round = ELIMINATION_ROUNDS.find(r => r.value === value);
        if (round) {
            setEliminationBracket({
                roundName: round.label,
                totalSlots: round.slots,
                slots: generateSlots(round.slots)
            });
            setTeamListText('');
        }
    };

    // ──── Slot team name change (inline typing) ────
    const handleSlotNameChange = (slotId: string, name: string) => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s =>
                s.id === slotId
                    ? {
                        ...s,
                        team: name.trim()
                            ? {
                                id: s.team?.id || Math.random().toString(36).substr(2, 9),
                                name: name,
                                organization: '',
                                tags: []
                            }
                            : null
                    }
                    : s
            )
        });
    };

    // ──── Toggle lock ────
    const handleToggleLock = (slotId: string) => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s =>
                s.id === slotId
                    ? { ...s, isFixed: s.team ? !s.isFixed : false }
                    : s
            )
        });
    };

    // ──── Clear All ────
    const clearAllSlots = () => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s => ({ ...s, team: null, isFixed: false }))
        });
    };

    // ──── Parse team list (text or CSV) ────
    const parseTeamNames = (text: string): string[] => {
        return text
            .split(/[\n,]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    };

    // ──── Auto-populate empty slots from team list ────
    const autoPopulateFromList = (teamNames: string[]) => {
        const emptySlots = eliminationBracket.slots.filter(s => !s.team && !s.isFixed);
        const newSlots = eliminationBracket.slots.map(s => {
            if (s.team || s.isFixed) return s; // already filled or locked
            const nextName = teamNames.shift();
            if (!nextName) return s; // no more names
            return {
                ...s,
                team: {
                    id: Math.random().toString(36).substr(2, 9),
                    name: nextName,
                    organization: '',
                    tags: [] as string[]
                }
            };
        });

        setEliminationBracket({
            ...eliminationBracket,
            slots: newSlots
        });
    };

    // ──── Randomly fill empty slots from team list ────
    const randomFillFromList = (teamNames: string[]) => {
        // Shuffle the team names
        const shuffled = [...teamNames];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        autoPopulateFromList(shuffled);
    };

    // ──── Handle CSV Upload ────
    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            const teamNames: string[] = [];

            lines.forEach((line, index) => {
                const parts = line.split(',');
                // Skip header row
                if (index === 0 && parts[0].toLowerCase().includes('name')) {
                    return;
                }
                const name = parts[0].trim();
                if (name) teamNames.push(name);
            });

            setTeamListText(teamNames.join('\n'));
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ──── Apply team list ────
    const handleApplyTeamList = (mode: 'sequential' | 'random') => {
        const names = parseTeamNames(teamListText);
        if (names.length === 0) {
            alert('No team names found in the list.');
            return;
        }

        if (mode === 'sequential') {
            autoPopulateFromList([...names]);
        } else {
            randomFillFromList([...names]);
        }
    };

    // ──── Stats ────
    const filledSlots = eliminationBracket.slots.filter(s => s.team).length;
    const emptySlots = eliminationBracket.totalSlots - filledSlots;
    const lockedSlots = eliminationBracket.slots.filter(s => s.isFixed).length;

    const leftSlots = eliminationBracket.slots.filter(s => s.position < halfwayPoint);
    const rightSlots = eliminationBracket.slots.filter(s => s.position >= halfwayPoint);

    return (
        <div className="space-y-6">

            {/* ──── Step 1: Bracket Size Selection ──── */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-2">1. Choose Elimination Bracket</h3>
                <p className="text-sm text-slate-500 mb-4">Select the bracket size for your tournament.</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {ELIMINATION_ROUNDS.map(r => (
                        <button
                            key={r.value}
                            onClick={() => handleRoundChange(r.value)}
                            className={`p-4 rounded-lg border-2 text-center transition-all duration-200 ${
                                currentRound.value === r.value
                                    ? 'border-orange-500 bg-orange-50 text-orange-800 shadow-md ring-2 ring-orange-200'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50/50'
                            }`}
                        >
                            <div className="text-2xl font-bold">{r.slots}</div>
                            <div className="text-xs font-medium mt-1">{r.label}</div>
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className={`px-3 py-1 rounded-full font-medium ${
                        filledSlots === eliminationBracket.totalSlots
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                    }`}>
                        {filledSlots}/{eliminationBracket.totalSlots} slots filled
                    </span>
                    {lockedSlots > 0 && (
                        <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                            🔒 {lockedSlots} locked
                        </span>
                    )}
                    {emptySlots > 0 && (
                        <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                            {emptySlots} empty
                        </span>
                    )}
                </div>
            </div>

            {/* ──── Step 2: Bracket View with Inline Inputs ──── */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">2. Set Up Bracket</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Type team names directly into brackets, or use the team list to auto-fill.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowTeamListPanel(!showTeamListPanel)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                showTeamListPanel
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                            }`}
                        >
                            📋 {showTeamListPanel ? 'Hide' : 'Show'} Team List
                        </button>
                        <button
                            onClick={clearAllSlots}
                            className="text-slate-500 text-sm hover:text-red-600 hover:underline px-3 py-2"
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                {/* Team List Panel */}
                {showTeamListPanel && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-2">Team List Import</h4>
                        <p className="text-xs text-blue-600 mb-3">
                            Add a list of team names (one per line, or comma-separated). These will fill empty/unlocked bracket slots.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-blue-700 mb-1">Type or paste team names</label>
                                <textarea
                                    className="w-full h-40 p-3 border border-blue-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                                    placeholder={"Team Alpha\nTeam Beta\nTeam Charlie\n..."}
                                    value={teamListText}
                                    onChange={(e) => setTeamListText(e.target.value)}
                                />
                                <p className="text-xs text-blue-500 mt-1">
                                    {parseTeamNames(teamListText).length} team(s) detected
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-blue-700 mb-1">Or upload CSV</label>
                                    <input
                                        type="file"
                                        accept=".csv,.txt"
                                        ref={fileInputRef}
                                        onChange={handleCSVUpload}
                                        className="block w-full text-sm text-slate-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-100 file:text-blue-700
                                            hover:file:bg-blue-200"
                                    />
                                    <p className="text-xs text-blue-500 mt-1">First column = team name. Header row auto-skipped.</p>
                                </div>

                                <div className="pt-2 space-y-2">
                                    <button
                                        onClick={() => handleApplyTeamList('sequential')}
                                        disabled={parseTeamNames(teamListText).length === 0}
                                        className="w-full py-2 px-4 rounded-lg text-sm font-medium transition bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                    >
                                        Fill Empty Slots (Sequential Order)
                                    </button>
                                    <button
                                        onClick={() => handleApplyTeamList('random')}
                                        disabled={parseTeamNames(teamListText).length === 0}
                                        className="w-full py-2 px-4 rounded-lg text-sm font-medium transition bg-purple-600 text-white hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                    >
                                        Fill Empty Slots (Random Order)
                                    </button>
                                </div>

                                <p className="text-xs text-blue-500 italic">
                                    💡 Tip: Fill some brackets manually and lock them, then use team list to fill the rest.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bracket Halves */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Left Half */}
                    <div className="border border-blue-200 rounded-lg overflow-hidden">
                        <div className="bg-blue-50 p-3 border-b border-blue-200 font-semibold text-blue-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            Left Half
                            <span className="text-xs font-normal text-blue-600 ml-auto">
                                {leftSlots.filter(s => s.team).length}/{halfwayPoint} filled
                                {leftSlots.filter(s => s.isFixed).length > 0 && ` · ${leftSlots.filter(s => s.isFixed).length} locked`}
                            </span>
                        </div>
                        <div className="p-3 space-y-1 max-h-[500px] overflow-y-auto bg-slate-50">
                            {leftSlots.map((slot, idx) => (
                                <BracketSlotRow
                                    key={slot.id}
                                    slot={slot}
                                    index={idx + 1}
                                    onNameChange={handleSlotNameChange}
                                    onToggleLock={handleToggleLock}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Right Half */}
                    <div className="border border-purple-200 rounded-lg overflow-hidden">
                        <div className="bg-purple-50 p-3 border-b border-purple-200 font-semibold text-purple-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            Right Half
                            <span className="text-xs font-normal text-purple-600 ml-auto">
                                {rightSlots.filter(s => s.team).length}/{halfwayPoint} filled
                                {rightSlots.filter(s => s.isFixed).length > 0 && ` · ${rightSlots.filter(s => s.isFixed).length} locked`}
                            </span>
                        </div>
                        <div className="p-3 space-y-1 max-h-[500px] overflow-y-auto bg-slate-50">
                            {rightSlots.map((slot, idx) => (
                                <BracketSlotRow
                                    key={slot.id}
                                    slot={slot}
                                    index={halfwayPoint + idx + 1}
                                    onNameChange={handleSlotNameChange}
                                    onToggleLock={handleToggleLock}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Empty slot warning */}
                {emptySlots > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                            <strong>{emptySlots} bracket slot{emptySlots > 1 ? 's are' : ' is'} empty.</strong>{' '}
                            Type team names directly or use the Team List to fill them.
                        </span>
                    </div>
                )}
            </div>

            {/* ──── Step 3: Finalize ──── */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-2">3. Finalize Bracket</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Choose to randomize the unlocked teams or use the current bracket as-is.
                    {lockedSlots > 0 && (
                        <span className="ml-1 text-yellow-700 font-medium">
                            🔒 {lockedSlots} team{lockedSlots > 1 ? 's' : ''} locked — won't be affected by randomization.
                        </span>
                    )}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => onFinalizeDrawMode('randomize')}
                        disabled={filledSlots < 2}
                        className="p-6 rounded-lg border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="text-3xl mb-2 group-hover:animate-bounce">🎲</div>
                        <div className="font-bold text-orange-800 text-lg">Randomize Bracket</div>
                        <p className="text-xs text-orange-600 mt-1">
                            Shuffle all unlocked teams into random positions.
                            {lockedSlots > 0 && ' Locked teams stay in place.'}
                        </p>
                    </button>

                    <button
                        onClick={() => onFinalizeDrawMode('use_as_is')}
                        disabled={filledSlots === 0}
                        className="p-6 rounded-lg border-2 border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="text-3xl mb-2">✅</div>
                        <div className="font-bold text-green-800 text-lg">Use Current Bracket</div>
                        <p className="text-xs text-green-600 mt-1">
                            Keep the bracket exactly as you've set it up.
                        </p>
                    </button>
                </div>
            </div>

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

// ──── Bracket Slot Row Component ────

interface BracketSlotRowProps {
    slot: BracketSlot;
    index: number;
    onNameChange: (slotId: string, name: string) => void;
    onToggleLock: (slotId: string) => void;
}

const BracketSlotRow: React.FC<BracketSlotRowProps> = ({
    slot,
    index,
    onNameChange,
    onToggleLock
}) => {
    const isEmpty = !slot.team;
    const isLocked = slot.isFixed;

    return (
        <div className={`flex items-center gap-2 p-2 rounded border transition-all duration-150 ${
            isLocked
                ? 'bg-yellow-50 border-yellow-300 shadow-sm'
                : isEmpty
                    ? 'bg-red-50/50 border-red-200 border-dashed'
                    : 'bg-white border-slate-200 hover:border-slate-300'
        }`}>
            <span className="text-xs text-slate-400 w-6 text-right font-mono">{index}</span>

            <input
                type="text"
                className={`flex-1 p-2 border rounded text-sm outline-none transition ${
                    isLocked
                        ? 'bg-yellow-50 border-yellow-200 text-yellow-900 font-medium'
                        : isEmpty
                            ? 'bg-white border-red-200 placeholder:text-red-300'
                            : 'bg-white border-slate-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400'
                }`}
                placeholder={`Slot ${index} — enter team name`}
                value={slot.team?.name || ''}
                onChange={(e) => onNameChange(slot.id, e.target.value)}
                disabled={isLocked}
            />

            <button
                onClick={() => onToggleLock(slot.id)}
                disabled={!slot.team}
                className={`p-2 rounded transition-all duration-150 ${
                    isLocked
                        ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300 shadow-sm'
                        : slot.team
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                            : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
                title={isLocked ? 'Unlock this slot' : 'Lock this slot'}
            >
                {isLocked ? '🔒' : '🔓'}
            </button>
        </div>
    );
};
