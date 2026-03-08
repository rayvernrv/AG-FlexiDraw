import { Group, Matchup } from '../types';

const uuid = () => Math.random().toString(36).substring(2, 9);

/**
 * Generate round-robin matchups for all groups.
 * Each pair plays `roundRobinCount` times.
 */
export function generateMatchups(groups: Group[], roundRobinCount: number): Matchup[] {
    const matchups: Matchup[] = [];

    for (const group of groups) {
        const teams = group.teams;

        for (let round = 1; round <= roundRobinCount; round++) {
            // Generate all pairings within the group
            for (let i = 0; i < teams.length; i++) {
                for (let j = i + 1; j < teams.length; j++) {
                    matchups.push({
                        id: uuid(),
                        groupId: group.id,
                        groupName: group.name,
                        teamA: teams[i],
                        teamB: teams[j],
                        round,
                    });
                }
            }
        }
    }

    return matchups;
}
