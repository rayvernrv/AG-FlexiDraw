import React from 'react';
import { Team, EliminationBracket, BracketSlot } from '../types';

interface EliminationConfigProps {
    teams: Team[];
    eliminationBracket: EliminationBracket;
    setEliminationBracket: (bracket: EliminationBracket) => void;
}

const ELIMINATION_ROUNDS = [
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
    teams,
    eliminationBracket,
    setEliminationBracket
}) => {
    const currentRound = ELIMINATION_ROUNDS.find(r => r.label === eliminationBracket.roundName) || ELIMINATION_ROUNDS[1];

    const handleRoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const round = ELIMINATION_ROUNDS.find(r => r.value === e.target.value);
        if (round) {
            setEliminationBracket({
                roundName: round.label,
                totalSlots: round.slots,
                slots: generateSlots(round.slots)
            });
        }
    };

    const handleSlotTeamChange = (slotId: string, teamId: string | null) => {
        const team = teamId ? teams.find(t => t.id === teamId) || null : null;
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s =>
                s.id === slotId
                    ? { ...s, team, isFixed: team !== null }
                    : s
            )
        });
    };

    const handleToggleFixed = (slotId: string) => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s =>
                s.id === slotId
                    ? { ...s, isFixed: s.team ? !s.isFixed : false }
                    : s
            )
        });
    };

    const clearAllSlots = () => {
        setEliminationBracket({
            ...eliminationBracket,
            slots: eliminationBracket.slots.map(s => ({ ...s, team: null, isFixed: false }))
        });
    };

    const assignedTeamIds = new Set(
        eliminationBracket.slots
            .filter(s => s.team)
            .map(s => s.team!.id)
    );

    const isValidSetup = teams.length === eliminationBracket.totalSlots;
    const halfwayPoint = eliminationBracket.totalSlots / 2;

    return (
        <div className="space-y-6">

            {/* Round Selection */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">1. Select Starting Round</h3>
                <p className="text-sm text-slate-500 mb-4">Choose which round the elimination bracket starts at.</p>

                <div className="flex items-center gap-4">
                    <select
                        className="p-3 border border-slate-300 rounded-lg bg-white text-lg font-medium"
                        value={currentRound.value}
                        onChange={handleRoundChange}
                    >
                        {ELIMINATION_ROUNDS.map(r => (
                            <option key={r.value} value={r.value}>{r.label} ({r.slots} teams)</option>
                        ))}
                    </select>

                    <div className={`px-4 py-2 rounded-lg ${isValidSetup ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isValidSetup
                            ? `✓ ${teams.length} teams matches ${eliminationBracket.totalSlots} slots`
                            : `⚠ Need ${eliminationBracket.totalSlots} teams (have ${teams.length})`
                        }
                    </div>
                </div>
            </div>

            {/* Slot Assignment */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">2. Assign Teams to Bracket Slots</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Fix specific teams to slots, or leave empty for random draw.
                            Fixed slots won't be changed during the draw.
                        </p>
                    </div>
                    <button
                        onClick={clearAllSlots}
                        className="text-slate-500 text-sm hover:text-red-600 hover:underline"
                    >
                        Clear All
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Top Half */}
                    <div className="border border-blue-200 rounded-lg overflow-hidden">
                        <div className="bg-blue-50 p-3 border-b border-blue-200 font-semibold text-blue-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            Top Half
                            <span className="text-xs font-normal text-blue-600 ml-auto">
                                {eliminationBracket.slots.filter(s => s.position < halfwayPoint && s.isFixed).length} fixed
                            </span>
                        </div>
                        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto bg-slate-50">
                            {eliminationBracket.slots
                                .filter(s => s.position < halfwayPoint)
                                .map((slot, idx) => (
                                    <SlotRow
                                        key={slot.id}
                                        slot={slot}
                                        index={idx + 1}
                                        teams={teams}
                                        assignedTeamIds={assignedTeamIds}
                                        onTeamChange={handleSlotTeamChange}
                                        onToggleFixed={handleToggleFixed}
                                    />
                                ))}
                        </div>
                    </div>

                    {/* Bottom Half */}
                    <div className="border border-purple-200 rounded-lg overflow-hidden">
                        <div className="bg-purple-50 p-3 border-b border-purple-200 font-semibold text-purple-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            Bottom Half
                            <span className="text-xs font-normal text-purple-600 ml-auto">
                                {eliminationBracket.slots.filter(s => s.position >= halfwayPoint && s.isFixed).length} fixed
                            </span>
                        </div>
                        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto bg-slate-50">
                            {eliminationBracket.slots
                                .filter(s => s.position >= halfwayPoint)
                                .map((slot, idx) => (
                                    <SlotRow
                                        key={slot.id}
                                        slot={slot}
                                        index={halfwayPoint + idx + 1}
                                        teams={teams}
                                        assignedTeamIds={assignedTeamIds}
                                        onTeamChange={handleSlotTeamChange}
                                        onToggleFixed={handleToggleFixed}
                                    />
                                ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <strong>How it works:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Teams assigned to slots and marked as <strong>Fixed</strong> will stay in their position.</li>
                    <li>Empty slots will be filled randomly from remaining teams when you run the draw.</li>
                    <li>Use <strong>Half Separation</strong> rules to ensure certain teams are in different halves.</li>
                </ul>
            </div>
        </div>
    );
};

interface SlotRowProps {
    slot: BracketSlot;
    index: number;
    teams: Team[];
    assignedTeamIds: Set<string>;
    onTeamChange: (slotId: string, teamId: string | null) => void;
    onToggleFixed: (slotId: string) => void;
}

const SlotRow: React.FC<SlotRowProps> = ({
    slot,
    index,
    teams,
    assignedTeamIds,
    onTeamChange,
    onToggleFixed
}) => {
    return (
        <div className={`flex items-center gap-2 p-2 rounded border transition ${slot.isFixed
            ? 'bg-yellow-50 border-yellow-300 shadow-sm'
            : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
            <span className="text-xs text-slate-400 w-6">{index}</span>

            <select
                className="flex-1 p-2 border border-slate-200 rounded bg-white text-sm"
                value={slot.team?.id || ''}
                onChange={(e) => onTeamChange(slot.id, e.target.value || null)}
            >
                <option value="">— Random Draw —</option>
                {teams.map(t => (
                    <option
                        key={t.id}
                        value={t.id}
                        disabled={assignedTeamIds.has(t.id) && slot.team?.id !== t.id}
                    >
                        {t.name} ({t.organization})
                        {t.seed ? ` [Seed ${t.seed}]` : ''}
                    </option>
                ))}
            </select>

            <button
                onClick={() => onToggleFixed(slot.id)}
                disabled={!slot.team}
                className={`px-2 py-1 rounded text-xs font-medium transition ${slot.isFixed
                    ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                    : slot.team
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    }`}
                title={slot.isFixed ? 'Click to unlock' : 'Click to lock this slot'}
            >
                {slot.isFixed ? '🔒 Fixed' : '🔓'}
            </button>
        </div>
    );
};
