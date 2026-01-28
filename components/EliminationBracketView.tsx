import React from 'react';
import { EliminationBracket, BracketSlot } from '../types';

interface EliminationBracketViewProps {
    bracket: EliminationBracket;
    showResult?: boolean;
}

interface MatchupData {
    slot1: BracketSlot | null;
    slot2: BracketSlot | null;
    matchNumber: number;
}

const getRoundName = (round: number, totalRounds: number): string => {
    const roundsFromEnd = totalRounds - round;
    switch (roundsFromEnd) {
        case 0: return 'Final';
        case 1: return 'Semi-Finals';
        case 2: return 'Quarter-Finals';
        case 3: return 'Round of 16';
        case 4: return 'Round of 32';
        default: return `Round ${round}`;
    }
};

const getMatchups = (slots: BracketSlot[]): MatchupData[] => {
    const matchups: MatchupData[] = [];
    for (let i = 0; i < slots.length; i += 2) {
        matchups.push({
            slot1: slots[i] || null,
            slot2: slots[i + 1] || null,
            matchNumber: Math.floor(i / 2) + 1
        });
    }
    return matchups;
};

export const EliminationBracketView: React.FC<EliminationBracketViewProps> = ({
    bracket,
    showResult = false
}) => {
    const totalSlots = bracket.totalSlots;
    const halfwayPoint = totalSlots / 2;

    const topHalfSlots = bracket.slots.filter(s => s.position < halfwayPoint);
    const bottomHalfSlots = bracket.slots.filter(s => s.position >= halfwayPoint);

    const topHalfMatchups = getMatchups(topHalfSlots);
    const bottomHalfMatchups = getMatchups(bottomHalfSlots);

    // Calculate number of rounds
    const numRounds = Math.log2(totalSlots);

    return (
        <div className="space-y-8">
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">{bracket.roundName}</h3>
                <p className="text-sm text-slate-500 mt-1">{totalSlots} Teams • {numRounds} Rounds to Final</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Top Half */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-blue-200">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        <h4 className="font-bold text-blue-800">Top Half</h4>
                    </div>
                    <div className="space-y-1">
                        {topHalfMatchups.map((matchup, idx) => (
                            <MatchupCard key={idx} matchup={matchup} half="top" showResult={showResult} />
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="hidden lg:flex flex-col items-center justify-center px-4">
                    <div className="w-px h-full bg-gradient-to-b from-blue-200 via-slate-300 to-purple-200"></div>
                </div>

                {/* Bottom Half */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-purple-200">
                        <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                        <h4 className="font-bold text-purple-800">Bottom Half</h4>
                    </div>
                    <div className="space-y-1">
                        {bottomHalfMatchups.map((matchup, idx) => (
                            <MatchupCard key={idx} matchup={matchup} half="bottom" showResult={showResult} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Tournament Bracket Visualization */}
            <div className="mt-8 pt-6 border-t border-slate-200">
                <h4 className="font-bold text-slate-700 mb-4 text-center">Full Bracket View</h4>
                <div className="overflow-x-auto">
                    <BracketVisualization bracket={bracket} numRounds={numRounds} />
                </div>
            </div>
        </div>
    );
};

interface MatchupCardProps {
    matchup: MatchupData;
    half: 'top' | 'bottom';
    showResult?: boolean;
}

const MatchupCard: React.FC<MatchupCardProps> = ({ matchup, half, showResult }) => {
    const borderColor = half === 'top' ? 'border-blue-200' : 'border-purple-200';
    const bgColor = half === 'top' ? 'bg-blue-50' : 'bg-purple-50';

    return (
        <div className={`border ${borderColor} rounded-lg overflow-hidden ${bgColor}`}>
            <TeamSlot slot={matchup.slot1} isTop showResult={showResult} />
            <div className="h-px bg-slate-200"></div>
            <TeamSlot slot={matchup.slot2} showResult={showResult} />
        </div>
    );
};

interface TeamSlotProps {
    slot: BracketSlot | null;
    isTop?: boolean;
    showResult?: boolean;
}

const TeamSlot: React.FC<TeamSlotProps> = ({ slot, showResult }) => {
    if (!slot || !slot.team) {
        return (
            <div className="p-3 bg-white flex items-center gap-3">
                <span className="text-xs text-slate-400 w-6">{slot?.position !== undefined ? slot.position + 1 : '?'}</span>
                <span className="text-sm text-slate-400 italic">TBD</span>
            </div>
        );
    }

    return (
        <div className={`p-3 bg-white flex items-center gap-3 group hover:bg-slate-50 transition ${slot.isFixed ? 'ring-1 ring-yellow-300 ring-inset' : ''
            }`}>
            <span className="text-xs text-slate-400 w-6">{slot.position + 1}</span>
            <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">{slot.team.name}</div>
                <div className="text-xs text-slate-500 truncate">{slot.team.organization}</div>
            </div>
            {slot.team.seed && (
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold border border-yellow-200">
                    {slot.team.seed}
                </span>
            )}
            {slot.isFixed && (
                <span className="text-xs text-yellow-600" title="Fixed position">🔒</span>
            )}
        </div>
    );
};

interface BracketVisualizationProps {
    bracket: EliminationBracket;
    numRounds: number;
}

const BracketVisualization: React.FC<BracketVisualizationProps> = ({ bracket, numRounds }) => {
    // Generate round structure
    const rounds: Array<{ name: string; matchCount: number }> = [];
    let matchCount = bracket.totalSlots / 2;

    for (let r = 0; r < numRounds; r++) {
        rounds.push({
            name: getRoundName(r + 1, numRounds),
            matchCount
        });
        matchCount = matchCount / 2;
    }

    // First round matchups from slots
    const firstRoundMatchups = getMatchups(bracket.slots);
    const halfwayMatchup = firstRoundMatchups.length / 2;

    return (
        <div className="flex gap-6 min-w-max p-4">
            {rounds.map((round, roundIndex) => (
                <div key={roundIndex} className="flex flex-col justify-around" style={{ minWidth: '180px' }}>
                    <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        {round.name}
                    </div>
                    <div className="flex flex-col justify-around flex-1">
                        {roundIndex === 0 ? (
                            // First round - show actual teams
                            firstRoundMatchups.map((matchup, idx) => (
                                <div
                                    key={idx}
                                    className={`mb-2 ${idx === halfwayMatchup - 1 ? 'pb-6 mb-6 border-b-2 border-dashed border-slate-300' : ''}`}
                                >
                                    <MiniMatchupCard matchup={matchup} />
                                </div>
                            ))
                        ) : (
                            // Subsequent rounds - show empty placeholders
                            Array.from({ length: round.matchCount }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`mb-2 ${round.matchCount > 1 && idx === round.matchCount / 2 - 1 ? 'pb-6 mb-6 border-b-2 border-dashed border-slate-300' : ''}`}
                                    style={{ marginTop: roundIndex * 20 + 'px', marginBottom: roundIndex * 20 + 'px' }}
                                >
                                    <EmptyMatchupCard roundName={round.name} matchNumber={idx + 1} />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ))}

            {/* Champion */}
            <div className="flex flex-col justify-center" style={{ minWidth: '120px' }}>
                <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Champion
                </div>
                <div className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 text-center shadow-md">
                    <span className="text-2xl">🏆</span>
                    <div className="text-sm font-bold text-amber-800 mt-2">Winner</div>
                </div>
            </div>
        </div>
    );
};

const MiniMatchupCard: React.FC<{ matchup: MatchupData }> = ({ matchup }) => {
    return (
        <div className="border border-slate-200 rounded bg-white shadow-sm">
            <MiniTeamSlot slot={matchup.slot1} />
            <div className="h-px bg-slate-200"></div>
            <MiniTeamSlot slot={matchup.slot2} />
        </div>
    );
};

const MiniTeamSlot: React.FC<{ slot: BracketSlot | null }> = ({ slot }) => {
    if (!slot || !slot.team) {
        return (
            <div className="px-2 py-1.5 text-xs text-slate-400 bg-slate-50">
                TBD
            </div>
        );
    }

    return (
        <div className={`px-2 py-1.5 text-xs flex items-center gap-1 ${slot.isFixed ? 'bg-yellow-50' : ''}`}>
            {slot.team.seed && (
                <span className="bg-yellow-200 text-yellow-800 px-1 rounded text-[10px] font-bold">
                    {slot.team.seed}
                </span>
            )}
            <span className="font-medium truncate flex-1">{slot.team.name}</span>
        </div>
    );
};

const EmptyMatchupCard: React.FC<{ roundName: string; matchNumber: number }> = ({ roundName, matchNumber }) => {
    return (
        <div className="border border-slate-200 rounded bg-slate-50 shadow-sm">
            <div className="px-2 py-1.5 text-xs text-slate-400 border-b border-slate-200">—</div>
            <div className="px-2 py-1.5 text-xs text-slate-400">—</div>
        </div>
    );
};
