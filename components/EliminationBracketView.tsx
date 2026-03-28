import React from 'react';
import { EliminationBracket, BracketSlot } from '../types';

interface EliminationBracketViewProps {
    bracket: EliminationBracket;
    showResult?: boolean;
    getMatchScore?: (roundIndex: number, matchIndex: number) => { teamAScore?: number; teamBScore?: number; matchId?: string } | null;
    onMatchClick?: (matchId: string) => void;
}

interface MatchScore {
    teamAScore?: number;
    teamBScore?: number;
    matchId?: string;
}

interface MatchupData {
    slot1: BracketSlot | null;
    slot2: BracketSlot | null;
    matchNumber: number;
}

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

const getMatchups = (slots: BracketSlot[]): MatchupData[] => {
    const matchups: MatchupData[] = [];
    for (let i = 0; i < slots.length; i += 2) {
        matchups.push({ slot1: slots[i] || null, slot2: slots[i + 1] || null, matchNumber: Math.floor(i / 2) + 1 });
    }
    return matchups;
};

export const EliminationBracketView: React.FC<EliminationBracketViewProps> = ({
    bracket, showResult = false, getMatchScore, onMatchClick
}) => {
    const totalSlots = bracket.totalSlots;
    const halfwayPoint = totalSlots / 2;
    const topHalfSlots = bracket.slots.filter(s => s.position < halfwayPoint);
    const bottomHalfSlots = bracket.slots.filter(s => s.position >= halfwayPoint);
    const topHalfMatchups = getMatchups(topHalfSlots);
    const bottomHalfMatchups = getMatchups(bottomHalfSlots);
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
                            <MatchupCard key={idx} matchup={matchup} half="top" />
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
                            <MatchupCard key={idx} matchup={matchup} half="bottom" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Mirrored Full Bracket View */}
            <div className="mt-8 pt-6 border-t border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2 text-center">Full Bracket View</h4>
                {onMatchClick && (
                    <div className="text-center mb-6">
                        <span className="text-xs font-bold text-brand-600 bg-brand-50 py-1.5 px-4 rounded-full border border-brand-100 shadow-sm animate-pulse-slow">
                            👆 Click on any match to view detailed scores
                        </span>
                    </div>
                )}
                <div className="overflow-x-auto pb-4">
                    <MirroredBracketVisualization bracket={bracket} numRounds={numRounds} getMatchScore={getMatchScore} onMatchClick={onMatchClick} />
                </div>
            </div>
        </div>
    );
};

// ──── Matchup Cards (top section) ────

const MatchupCard: React.FC<{ matchup: MatchupData; half: 'top' | 'bottom' }> = ({ matchup, half }) => {
    const borderColor = half === 'top' ? 'border-blue-200' : 'border-purple-200';
    const bgColor = half === 'top' ? 'bg-blue-50' : 'bg-purple-50';
    return (
        <div className={`border ${borderColor} rounded-lg overflow-hidden ${bgColor}`}>
            <TeamSlot slot={matchup.slot1} />
            <div className="h-px bg-slate-200"></div>
            <TeamSlot slot={matchup.slot2} />
        </div>
    );
};

const TeamSlot: React.FC<{ slot: BracketSlot | null }> = ({ slot }) => {
    if (!slot || !slot.team) {
        return (
            <div className="p-3 bg-white flex items-center gap-3">
                <span className="text-xs text-slate-400 w-6">{slot?.position !== undefined ? slot.position + 1 : '?'}</span>
                <span className="text-sm text-slate-400 italic">TBD</span>
            </div>
        );
    }
    return (
        <div className={`p-3 bg-white flex items-center gap-3 group hover:bg-slate-50 transition ${slot.isFixed ? 'ring-1 ring-yellow-300 ring-inset' : ''}`}>
            <span className="text-xs text-slate-400 w-6">{slot.position + 1}</span>
            <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">{slot.team.name}</div>
                {slot.team.organization && <div className="text-xs text-slate-500 truncate">{slot.team.organization}</div>}
            </div>
            {slot.team.seed && (
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold border border-yellow-200">{slot.team.seed}</span>
            )}
            {slot.isFixed && <span className="text-xs text-yellow-600" title="Fixed position">🔒</span>}
        </div>
    );
};

// ──── Mirrored Bracket Visualization ────

interface MirroredBracketProps {
    bracket: EliminationBracket;
    numRounds: number;
    getMatchScore?: (roundIndex: number, matchIndex: number) => { teamAScore?: number; teamBScore?: number; matchId?: string } | null;
    onMatchClick?: (matchId: string) => void;
}

const MirroredBracketVisualization: React.FC<MirroredBracketProps> = ({ bracket, numRounds, getMatchScore, onMatchClick }) => {
    const totalSlots = bracket.totalSlots;
    const halfwayPoint = totalSlots / 2;
    // Base rounds mapping
    const roundsData = bracket.rounds || [bracket.slots];

    // Half-specific rounds (excluding the final)
    const halfRounds = numRounds - 1;

    // Build round structure for each half
    const buildHalfRoundStructure = () => {
        const rounds: Array<{ name: string; matchCount: number }> = [];
        let mc = halfwayPoint / 2; // matches in first round of each half
        for (let r = 0; r < halfRounds; r++) {
            rounds.push({ name: getRoundName(r + 1, numRounds), matchCount: mc });
            mc = mc / 2;
        }
        return rounds;
    };

    const halfRoundStructure = buildHalfRoundStructure();

    // Special case: Finals (2 teams, numRounds=1, no halves)
    if (numRounds <= 1) {
        return (
            <div className="flex items-center gap-8 p-4 w-full">
                <div className="flex-1">
                    <MiniMatchupCardStatic slot={roundsData[0][0]} />
                </div>
                <div className="text-center">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Final</div>
                    <ChampionCard slot={roundsData[1] ? roundsData[1][0] : undefined} />
                </div>
                <div className="flex-1">
                    <MiniMatchupCardStatic slot={roundsData[0][1]} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-stretch w-full min-w-max mx-auto p-4 gap-2 md:gap-4 lg:gap-8">
            {/* ──── LEFT SIDE: Top Half (flows left → right) ──── */}
            {halfRoundStructure.map((round, ri) => {
                const roundSlots = roundsData[ri];
                const halfCountIfAny = (totalSlots / 2) / Math.pow(2, ri);
                const topSlots = roundSlots ? roundSlots.filter(s => s.position < halfCountIfAny) : null;
                const topMatchups = topSlots ? getMatchups(topSlots) : [];

                return (
                    <div key={`left-${ri}`} className="flex flex-col justify-around flex-1 min-w-[112px] md:min-w-[160px] max-w-[280px] shrink-0">
                        <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{round.name}</div>
                        <div className="flex flex-col justify-around flex-1">
                            {topMatchups.length > 0 ? (
                                topMatchups.map((matchup, idx) => (
                                    <div key={idx} className="mb-2" style={{ marginTop: ri * 10, marginBottom: ri * 10 }}>
                                        <MiniMatchupCard matchup={matchup} score={getMatchScore?.(ri, idx)} onMatchClick={onMatchClick} />
                                    </div>
                                ))
                            ) : (
                                Array.from({ length: round.matchCount }).map((_, idx) => (
                                    <div key={idx} className="mb-2" style={{ marginTop: ri * 20, marginBottom: ri * 20 }}>
                                        <EmptyMatchupCard />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}

            {/* ──── CENTER: Final + Champion ──── */}
            <div className="flex flex-col justify-center items-center px-4 shrink-0">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">Final</div>
                <div className="mb-6">
                    {roundsData[halfRounds] ? (
                        <GrandMatchupCard matchup={getMatchups(roundsData[halfRounds])[0]} score={getMatchScore?.(halfRounds, 0)} onMatchClick={onMatchClick} />
                    ) : (
                        <div className="border border-slate-200 rounded bg-slate-50 shadow-sm w-48">
                            <div className="px-2 py-3 text-sm font-bold text-slate-400 border-b border-slate-200 text-center">—</div>
                            <div className="px-2 py-3 text-sm font-bold text-slate-400 text-center">—</div>
                        </div>
                    )}
                </div>
                <ChampionCard slot={roundsData[halfRounds + 1] ? roundsData[halfRounds + 1][0] : undefined} />
            </div>

            {/* ──── RIGHT SIDE: Bottom Half (flows right → left, reversed columns) ──── */}
            {[...halfRoundStructure].reverse().map((round, ri) => {
                const actualRoundIdx = halfRounds - 1 - ri; // reverse index
                const roundSlots = roundsData[actualRoundIdx];
                const halfCountIfAny = (totalSlots / 2) / Math.pow(2, actualRoundIdx);
                const topSlots = roundSlots ? roundSlots.filter(s => s.position < halfCountIfAny) : null;
                const topMatchCount = topSlots ? getMatchups(topSlots).length : 0;
                const bottomSlots = roundSlots ? roundSlots.filter(s => s.position >= halfCountIfAny) : null;
                const bottomMatchups = bottomSlots ? getMatchups(bottomSlots) : [];

                return (
                    <div key={`right-${ri}`} className="flex flex-col justify-around flex-1 min-w-[112px] md:min-w-[160px] max-w-[280px] shrink-0">
                        <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{round.name}</div>
                        <div className="flex flex-col justify-around flex-1">
                            {bottomMatchups.length > 0 ? (
                                bottomMatchups.map((matchup, idx) => (
                                    <div key={idx} className="mb-2" style={{ marginTop: actualRoundIdx * 10, marginBottom: actualRoundIdx * 10 }}>
                                        <MiniMatchupCard matchup={matchup} score={getMatchScore?.(actualRoundIdx, topMatchCount + idx)} onMatchClick={onMatchClick} />
                                    </div>
                                ))
                            ) : (
                                Array.from({ length: round.matchCount }).map((_, idx) => (
                                    <div key={idx} className="mb-2" style={{ marginTop: actualRoundIdx * 20, marginBottom: actualRoundIdx * 20 }}>
                                        <EmptyMatchupCard />
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

// ──── Mini Components ────

const MiniMatchupCard: React.FC<{ matchup: MatchupData, score?: MatchScore | null, onMatchClick?: (matchId: string) => void }> = ({ matchup, score, onMatchClick }) => {
    const isClickable = !!score?.matchId && !!onMatchClick;
    return (
        <div 
            className={`border border-slate-200 rounded bg-white shadow-sm flex flex-col ${isClickable ? 'cursor-pointer hover:border-brand-500 hover:shadow-md transition' : ''}`}
            onClick={() => { if (isClickable && score.matchId) onMatchClick(score.matchId); }}
        >
            <MiniTeamSlot slot={matchup.slot1} score={score?.teamAScore} />
            <div className="h-px bg-slate-200"></div>
            <MiniTeamSlot slot={matchup.slot2} score={score?.teamBScore} />
        </div>
    );
};

const MiniTeamSlot: React.FC<{ slot: BracketSlot | null, score?: number | null }> = ({ slot, score }) => {
    if (!slot || !slot.team) {
        return <div className="px-2 py-1.5 text-xs text-slate-400 bg-slate-50 flex justify-between h-[30px] items-center"><span>TBD</span></div>;
    }
    return (
        <div className={`px-2 py-1.5 text-xs flex justify-between items-center gap-1 h-[30px] ${slot.isFixed ? 'bg-yellow-50' : ''}`}>
            <div className="flex items-center gap-1 overflow-hidden">
                {slot.team.seed && (
                    <span className="bg-yellow-200 text-yellow-800 px-1 rounded text-[10px] font-bold shrink-0">{slot.team.seed}</span>
                )}
                <span className="font-medium truncate">{slot.team.name}</span>
            </div>
            {score !== null && score !== undefined && (
                <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 rounded ml-1 shrink-0">{score}</span>
            )}
        </div>
    );
};

const MiniMatchupCardStatic: React.FC<{ slot: BracketSlot | null }> = ({ slot }) => (
    <div className="border border-slate-200 rounded bg-white shadow-sm">
        <MiniTeamSlot slot={slot} />
    </div>
);

const EmptyMatchupCard: React.FC = () => (
    <div className="border border-slate-200 rounded bg-slate-50 shadow-sm">
        <div className="px-2 py-1.5 text-xs text-slate-400 border-b border-slate-200 text-center">—</div>
        <div className="px-2 py-1.5 text-xs text-slate-400 text-center">—</div>
    </div>
);

const GrandMatchupCard: React.FC<{ matchup: MatchupData, score?: MatchScore | null, onMatchClick?: (matchId: string) => void }> = ({ matchup, score, onMatchClick }) => {
    const isClickable = !!score?.matchId && !!onMatchClick;
    return (
        <div 
            className={`border-2 border-orange-300 rounded-xl bg-gradient-to-br from-white to-orange-50 shadow-md overflow-hidden min-w-[12rem] md:min-w-[16rem] ${isClickable ? 'cursor-pointer hover:border-orange-500 hover:shadow-lg transition transform active:scale-95' : ''}`}
            onClick={() => { if (isClickable && score.matchId) onMatchClick(score.matchId); }}
        >
            <GrandTeamSlot slot={matchup.slot1} score={score?.teamAScore} />
            <div className="h-0.5 bg-orange-200"></div>
            <GrandTeamSlot slot={matchup.slot2} score={score?.teamBScore} />
        </div>
    );
};

const GrandTeamSlot: React.FC<{ slot: BracketSlot | null, score?: number | null }> = ({ slot, score }) => {
    if (!slot || !slot.team) {
        return <div className="px-4 py-3 text-sm font-bold text-slate-400 flex justify-center uppercase tracking-wider h-[46px] items-center">TBD</div>;
    }
    return (
        <div className={`px-4 py-3 flex items-center justify-between gap-2 h-[46px] ${slot.isFixed ? 'bg-yellow-100/50' : ''}`}>
            <div className="flex gap-2 items-center overflow-hidden">
                {slot.team.seed && (
                    <span className="bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded text-xs font-black shrink-0">{slot.team.seed}</span>
                )}
                <span className="font-bold text-lg text-slate-800 truncate">{slot.team.name}</span>
            </div>
            {score !== null && score !== undefined && (
                <span className="font-black text-slate-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded ml-1 shrink-0">{score}</span>
            )}
        </div>
    );
};

const ChampionCard: React.FC<{ slot: BracketSlot | null | undefined }> = ({ slot }) => (
    <div className="border-[3px] border-yellow-400 bg-gradient-to-br from-yellow-100 to-amber-50 rounded-2xl p-4 md:p-6 text-center shadow-lg min-w-[11rem] md:min-w-[14rem] mt-4 ring-4 ring-yellow-400/20 mx-auto">
        <span className="text-4xl md:text-5xl block mb-2 drop-shadow-md">🏆</span>
        <div className="text-sm md:text-base font-black text-amber-700 uppercase tracking-widest mb-2 border-b-2 border-amber-200/50 pb-1.5 inline-block px-3">Champion</div>
        {slot?.team ? (
            <div className="text-xl md:text-2xl font-black text-slate-900 truncate px-2 mt-1">{slot.team.name}</div>
        ) : (
            <div className="text-lg md:text-xl font-bold text-amber-600/30 uppercase tracking-widest mt-1">TBD</div>
        )}
    </div>
);
