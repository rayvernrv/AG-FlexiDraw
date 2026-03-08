import { Matchup, MatchResult, RankingEntry, RankingRule, Team } from '../types';

export const DEFAULT_RANKING_RULES: RankingRule[] = [
    { id: '1', field: 'gamesWonLostDiff', direction: 'desc' },
    { id: '2', field: 'setWonLostDiff', direction: 'desc' },
    { id: '3', field: 'deltaPointsPerGame', direction: 'desc' },
    { id: '4', field: 'headToHead', direction: 'desc' }
];

export function computeRankings(
    matchups: Matchup[],
    results: Record<string, MatchResult>, // matchId -> MatchResult
    rules: RankingRule[]
): { groupRankings: Record<string, RankingEntry[]>; overallRankings: RankingEntry[] } {

    // 1. Initialize empty ranking entries for all teams in all matchups
    const entriesMap = new Map<string, RankingEntry>();

    for (const matchup of matchups) {
        if (!entriesMap.has(matchup.teamA.id)) {
            entriesMap.set(matchup.teamA.id, createEmptyEntry(matchup.teamA, matchup.groupId, matchup.groupName));
        }
        if (!entriesMap.has(matchup.teamB.id)) {
            entriesMap.set(matchup.teamB.id, createEmptyEntry(matchup.teamB, matchup.groupId, matchup.groupName));
        }
    }

    // 2. Accumulate stats from completed matches
    for (const matchup of matchups) {
        const result = results[matchup.id];
        if (!result || !result.isComplete) continue;

        const entryA = entriesMap.get(matchup.teamA.id)!;
        const entryB = entriesMap.get(matchup.teamB.id)!;

        // A "Match" consists of multiple "Games" (Categories)
        // The winner of the match is whoever won the most games inside the match

        let teamAGamesWon = 0;
        let teamBGamesWon = 0;

        for (const game of result.games) {
            // Sets
            entryA.setsWon += game.teamASets;
            entryA.setsLost += game.teamBSets;
            entryB.setsWon += game.teamBSets;
            entryB.setsLost += game.teamASets;

            // Points
            entryA.totalPointsWon += game.teamAPoints;
            entryA.totalPointsLost += game.teamBPoints;
            entryB.totalPointsWon += game.teamBPoints;
            entryB.totalPointsLost += game.teamAPoints;

            // Game (Category) Winner
            if (game.teamASets > game.teamBSets) {
                teamAGamesWon++;
            } else if (game.teamBSets > game.teamASets) {
                teamBGamesWon++;
            } else {
                // If sets are tied, points decide the game
                if (game.teamAPoints > game.teamBPoints) {
                    teamAGamesWon++;
                } else if (game.teamBPoints > game.teamAPoints) {
                    teamBGamesWon++;
                }
            }
        }

        // Match Winner (Overall)
        entryA.gamesPlayed++;
        entryB.gamesPlayed++;

        if (teamAGamesWon > teamBGamesWon) {
            entryA.gamesWon++;
            entryB.gamesLost++;
        } else if (teamBGamesWon > teamAGamesWon) {
            entryB.gamesWon++;
            entryA.gamesLost++;
        } else {
            // Tie match - for simplicity in this system we won't add a 'drawn' column unless requested, 
            // but gamesWon/Lost remain unchanged.
        }
    }

    // 3. Compute derived stats
    const allEntries = Array.from(entriesMap.values());
    for (const entry of allEntries) {
        entry.setDifference = entry.setsWon - entry.setsLost;
        entry.totalPointsDifference = entry.totalPointsWon - entry.totalPointsLost;
        entry.deltaPointsPerGame = entry.gamesPlayed > 0
            ? Number((entry.totalPointsDifference / entry.gamesPlayed).toFixed(2))
            : 0;
    }

    // Helper function to sort entries based on rules
    const sortEntries = (entries: RankingEntry[]) => {
        return entries.sort((a, b) => {
            for (const rule of rules) {
                if (rule.field === 'headToHead') {
                    // Check if they played each other
                    const h2hMatchups = matchups.filter(m =>
                        (m.teamA.id === a.teamId && m.teamB.id === b.teamId) ||
                        (m.teamA.id === b.teamId && m.teamB.id === a.teamId)
                    );

                    let aWinsH2H = 0;
                    let bWinsH2H = 0;

                    for (const m of h2hMatchups) {
                        const res = results[m.id];
                        if (!res || !res.isComplete) continue;

                        // Re-calculate who won this specific matchup
                        let aGames = 0, bGames = 0;
                        const isATeamA = m.teamA.id === a.teamId;

                        for (const g of res.games) {
                            const aSets = isATeamA ? g.teamASets : g.teamBSets;
                            const bSets = isATeamA ? g.teamBSets : g.teamASets;
                            if (aSets > bSets) aGames++;
                            else if (bSets > aSets) bGames++;
                        }

                        if (aGames > bGames) aWinsH2H++;
                        else if (bGames > aGames) bWinsH2H++;
                    }

                    if (aWinsH2H !== bWinsH2H) {
                        // we found a winner in H2H
                        a.tiebreakerNote = `H2H vs ${b.teamName}`;
                        b.tiebreakerNote = `H2H vs ${a.teamName}`;
                        return rule.direction === 'desc' ? bWinsH2H - aWinsH2H : aWinsH2H - bWinsH2H;
                    }
                    continue; // tied in H2H, move to next rule
                }

                // Numeric fields
                let valA = 0;
                let valB = 0;

                switch (rule.field) {
                    case 'gamesWonLostDiff':
                        valA = a.gamesWon - a.gamesLost;
                        valB = b.gamesWon - b.gamesLost;
                        break;
                    case 'setWonLostDiff':
                        valA = a.setDifference;
                        valB = b.setDifference;
                        break;
                    case 'totalPointsDifference':
                        valA = a.totalPointsDifference;
                        valB = b.totalPointsDifference;
                        break;
                    case 'deltaPointsPerGame':
                        valA = a.deltaPointsPerGame;
                        valB = b.deltaPointsPerGame;
                        break;
                }

                if (valA !== valB) {
                    return rule.direction === 'desc' ? valB - valA : valA - valB;
                }
            }

            // If all rules are exhausted and still tied
            a.tiebreakerNote = 'Manual Tiebreak Needed';
            b.tiebreakerNote = 'Manual Tiebreak Needed';
            return 0;
        });
    };

    // 4. Group Rankings
    const groupRankings: Record<string, RankingEntry[]> = {};

    // Bucket by group
    for (const entry of allEntries) {
        if (!groupRankings[entry.groupId]) groupRankings[entry.groupId] = [];
        groupRankings[entry.groupId].push({ ...entry }); // copy so we can sort independently
    }

    // Sort each group
    for (const groupId in groupRankings) {
        groupRankings[groupId] = sortEntries(groupRankings[groupId]);
    }

    // 5. Overall Rankings
    const overallRankings = sortEntries([...allEntries]);

    return { groupRankings, overallRankings };
}

function createEmptyEntry(team: Team, groupId: string, groupName: string): RankingEntry {
    return {
        teamId: team.id,
        teamName: team.name,
        teamOrganization: team.organization,
        groupId,
        groupName,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        setsWon: 0,
        setsLost: 0,
        setDifference: 0,
        totalPointsWon: 0,
        totalPointsLost: 0,
        totalPointsDifference: 0,
        deltaPointsPerGame: 0,
    };
}
