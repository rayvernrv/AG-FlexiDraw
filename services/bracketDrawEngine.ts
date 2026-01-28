import { Team, Rule, RuleType, EliminationBracket, EliminationDrawResult, BracketSlot } from '../types';

/**
 * Shuffle array using Fisher-Yates algorithm
 */
const shuffleArray = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

/**
 * Get teams that must be separated into different halves based on HALF_SEPARATION rules
 */
const getHalfSeparationTeamIds = (rules: Rule[]): string[][] => {
    const separationGroups: string[][] = [];

    for (const rule of rules) {
        if (rule.isActive && rule.type === RuleType.HALF_SEPARATION && rule.params.teamIds) {
            separationGroups.push(rule.params.teamIds);
        }
    }

    return separationGroups;
};

/**
 * Get bracket slot locks from rules
 */
const getBracketSlotLocks = (rules: Rule[]): Map<string, number> => {
    const locks = new Map<string, number>();

    for (const rule of rules) {
        if (rule.isActive && rule.type === RuleType.BRACKET_SLOT_LOCK && rule.params.teamId && rule.params.slotPosition !== undefined) {
            locks.set(rule.params.teamId, rule.params.slotPosition);
        }
    }

    return locks;
};

/**
 * Run elimination bracket draw
 */
export const runEliminationDraw = (
    teams: Team[],
    bracket: EliminationBracket,
    rules: Rule[]
): EliminationDrawResult => {
    const logs: string[] = [];

    // Validate team count matches bracket slots
    if (teams.length !== bracket.totalSlots) {
        return {
            success: false,
            bracket,
            logs: [`Error: Team count (${teams.length}) does not match bracket slots (${bracket.totalSlots})`]
        };
    }

    // Create working copy of slots
    const workingSlots: BracketSlot[] = bracket.slots.map(s => ({ ...s }));

    // Collect already fixed teams (from UI)
    const fixedTeamIds = new Set<string>();
    workingSlots.forEach(slot => {
        if (slot.isFixed && slot.team) {
            fixedTeamIds.add(slot.team.id);
        }
    });

    // Get rule-based slot locks
    const slotLocks = getBracketSlotLocks(rules);

    // Apply rule-based locks (override if not already fixed)
    slotLocks.forEach((position, teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (team && !fixedTeamIds.has(teamId)) {
            const slot = workingSlots.find(s => s.position === position);
            if (slot && !slot.isFixed) {
                slot.team = team;
                slot.isFixed = true;
                fixedTeamIds.add(teamId);
                logs.push(`Locked ${team.name} to position ${position + 1} via rule`);
            }
        }
    });

    // Get teams to place (not already fixed)
    const teamsToPlace = teams.filter(t => !fixedTeamIds.has(t.id));

    // Get empty slots
    const topHalfSlots = workingSlots.filter(s => !s.isFixed && s.position < bracket.totalSlots / 2);
    const bottomHalfSlots = workingSlots.filter(s => !s.isFixed && s.position >= bracket.totalSlots / 2);

    // Get half separation rules
    const separationGroups = getHalfSeparationTeamIds(rules);

    // Separate teams that need to be in different halves
    const teamsMustBeInTopHalf: Team[] = [];
    const teamsMustBeInBottomHalf: Team[] = [];
    let remainingTeams = [...teamsToPlace];

    // For each separation group, we need to split teams between halves
    for (const groupTeamIds of separationGroups) {
        const groupTeams = remainingTeams.filter(t => groupTeamIds.includes(t.id));

        if (groupTeams.length >= 2) {
            // Shuffle to randomize which goes where
            const shuffledGroup = shuffleArray(groupTeams);

            // Alternate placing in top/bottom half
            shuffledGroup.forEach((team, index) => {
                if (index % 2 === 0) {
                    if (!teamsMustBeInTopHalf.find(t => t.id === team.id) && !teamsMustBeInBottomHalf.find(t => t.id === team.id)) {
                        teamsMustBeInTopHalf.push(team);
                        logs.push(`Placing ${team.name} in TOP half (half separation rule)`);
                    }
                } else {
                    if (!teamsMustBeInTopHalf.find(t => t.id === team.id) && !teamsMustBeInBottomHalf.find(t => t.id === team.id)) {
                        teamsMustBeInBottomHalf.push(team);
                        logs.push(`Placing ${team.name} in BOTTOM half (half separation rule)`);
                    }
                }
            });
        }
    }

    // Remove already assigned teams from remaining
    const mustPlaceIds = new Set([...teamsMustBeInTopHalf.map(t => t.id), ...teamsMustBeInBottomHalf.map(t => t.id)]);
    remainingTeams = remainingTeams.filter(t => !mustPlaceIds.has(t.id));

    // Shuffle remaining teams
    remainingTeams = shuffleArray(remainingTeams);

    // Calculate how many slots each half needs
    const topHalfNeeded = topHalfSlots.length - teamsMustBeInTopHalf.length;
    const bottomHalfNeeded = bottomHalfSlots.length - teamsMustBeInBottomHalf.length;

    // Distribute remaining teams
    const teamsForTopHalf = remainingTeams.slice(0, topHalfNeeded);
    const teamsForBottomHalf = remainingTeams.slice(topHalfNeeded, topHalfNeeded + bottomHalfNeeded);

    // Combine and shuffle for each half
    const allTopHalfTeams = shuffleArray([...teamsMustBeInTopHalf, ...teamsForTopHalf]);
    const allBottomHalfTeams = shuffleArray([...teamsMustBeInBottomHalf, ...teamsForBottomHalf]);

    // Assign to slots
    let topIndex = 0;
    let bottomIndex = 0;

    for (const slot of workingSlots) {
        if (slot.isFixed) continue;

        if (slot.position < bracket.totalSlots / 2) {
            // Top half
            if (topIndex < allTopHalfTeams.length) {
                slot.team = allTopHalfTeams[topIndex];
                topIndex++;
            }
        } else {
            // Bottom half
            if (bottomIndex < allBottomHalfTeams.length) {
                slot.team = allBottomHalfTeams[bottomIndex];
                bottomIndex++;
            }
        }
    }

    logs.push(`Successfully drew ${teams.length} teams into ${bracket.roundName}`);

    return {
        success: true,
        bracket: {
            ...bracket,
            slots: workingSlots
        },
        logs
    };
};
