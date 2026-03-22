import { SavedMatchupSchedule, SavedEliminationSchedule, MatchResult, RankingEntry, GameCategory } from '../types';

/**
 * Utility to trigger a browser download of a CSV file.
 */
const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/**
 * Escapes a string for CSV format.
 */
const escapeCSV = (str: string | number | null | undefined) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
};

/**
 * Exports Group Stage results to CSV.
 */
export const exportGroupResultsToCSV = (
    schedule: SavedMatchupSchedule,
    results: Record<string, MatchResult>,
    groupRankings: Record<string, RankingEntry[]>,
    categories: GameCategory[]
) => {
    let csv = `Tournament Results: ${schedule.name}\n\n`;

    // 1. Rankings Section
    csv += `--- RANKINGS BY GROUP ---\n`;
    Object.entries(groupRankings).forEach(([groupId, entries]) => {
        const groupName = entries[0]?.groupName || 'Group';
        csv += `\n${escapeCSV(groupName)}\n`;
        csv += `Rank,Team,Org,GP,W,L,Set W,Set L,Set Diff,Pts W,Pts L,Pts Diff,DPG,Tiebreaker\n`;
        
        entries.forEach((entry, idx) => {
            csv += [
                idx + 1,
                escapeCSV(entry.teamName),
                escapeCSV(entry.teamOrganization),
                entry.gamesPlayed,
                entry.gamesWon,
                entry.gamesLost,
                entry.setsWon,
                entry.setsLost,
                entry.setDifference,
                entry.totalPointsWon.toFixed(2),
                entry.totalPointsLost.toFixed(2),
                entry.totalPointsDifference.toFixed(2),
                entry.deltaPointsPerGame.toFixed(2),
                escapeCSV(entry.tiebreakerNote)
            ].join(',') + '\n';
        });
    });

    // 2. Matchups Section
    csv += `\n\n--- MATCH RESULTS ---\n`;
    csv += `Group,Team A,Team B,Winner,Overall Score,Details\n`;

    schedule.matchups.forEach(match => {
        const group = schedule.groups.find(g => g.id === match.groupId);
        const matchResult = results[match.id];
        
        let winner = 'TBD';
        let score = '0 - 0';
        let details = '';

        if (matchResult && matchResult.isComplete) {
            let teamAWins = 0;
            let teamBWins = 0;
            
            const detailParts: string[] = [];
            matchResult.games.forEach(g => {
                const cat = categories.find(c => c.id === g.categoryId);
                const catName = cat?.name || 'Game';
                detailParts.push(`${catName}: ${g.teamASets}-${g.teamBSets} (${g.teamAPoints}-${g.teamBPoints})`);
                
                if (g.teamASets > g.teamBSets) teamAWins++;
                else if (g.teamBSets > g.teamASets) teamBWins++;
            });

            if (teamAWins > teamBWins) winner = match.teamA.name;
            else if (teamBWins > teamAWins) winner = match.teamB.name;
            else winner = 'Draw';

            score = `${teamAWins} - ${teamBWins}`;
            details = detailParts.join(' | ');
        }

        csv += [
            escapeCSV(group?.name),
            escapeCSV(match.teamA.name),
            escapeCSV(match.teamB.name),
            escapeCSV(winner),
            escapeCSV(score),
            escapeCSV(details)
        ].join(',') + '\n';
    });

    downloadCSV(`${schedule.name.replace(/\s+/g, '_')}_results.csv`, csv);
};

/**
 * Exports Elimination Bracket results to CSV.
 */
export const exportEliminationResultsToCSV = (
    schedule: SavedEliminationSchedule,
    results: Record<string, MatchResult>,
    roundCategories: Record<number, GameCategory[]>
) => {
    let csv = `Elimination Bracket Results: ${schedule.name}\n\n`;

    // 1. Champion Section
    if (schedule.isComplete) {
        // Find winner of the final match
        const finalMatch = schedule.history?.[schedule.history.length - 1]?.[0];
        if (finalMatch) {
            const res = results[finalMatch.id];
            const winner = res?.teamAMatchWins > res?.teamBMatchWins ? finalMatch.slot1.team?.name : finalMatch.slot2.team?.name;
            csv += `CHAMPION,${escapeCSV(winner)}\n\n`;
        }
    } else {
        csv += `STATUS,In Progress (Round ${schedule.currentRoundIndex + 1})\n\n`;
    }

    // 2. Bracket View Section (By Round)
    csv += `--- TOURNAMENT BRACKET ---\n`;
    csv += `Round,Matchup,Winner,Match Score,Game Details\n`;

    const history = schedule.history || [schedule.matchups];
    history.forEach((roundMatchups, rIdx) => {
        const roundName = rIdx === history.length - 1 && schedule.isComplete ? 'Finals' : `Round ${rIdx + 1}`;
        const cats = roundCategories[rIdx] || [];

        roundMatchups.forEach(match => {
            const matchResult = results[match.id];
            let winner = 'TBD';
            let score = '0 - 0';
            let details = '';

            if (matchResult && matchResult.isComplete) {
                if (matchResult.teamAMatchWins > matchResult.teamBMatchWins) winner = match.slot1.team?.name || 'Team A';
                else if (matchResult.teamBMatchWins > matchResult.teamAMatchWins) winner = match.slot2.team?.name || 'Team B';
                else winner = 'Draw';

                score = `${matchResult.teamAMatchWins} - ${matchResult.teamBMatchWins}`;
                
                const detailParts: string[] = [];
                matchResult.games.forEach(g => {
                    const cat = cats.find(c => c.id === g.categoryId);
                    const catName = cat?.name || 'Game';
                    detailParts.push(`${catName}: ${g.teamASets}-${g.teamBSets}`);
                });
                details = detailParts.join(' | ');
            } else if (!match.slot1.team || !match.slot2.team) {
                winner = match.slot1.team?.name || match.slot2.team?.name || 'Bye';
                score = 'BYE';
            }

            csv += [
                escapeCSV(roundName),
                escapeCSV(`${match.slot1.team?.name || 'TBD'} vs ${match.slot2.team?.name || 'TBD'}`),
                escapeCSV(winner),
                escapeCSV(score),
                escapeCSV(details)
            ].join(',') + '\n';
        });
    });

    downloadCSV(`${schedule.name.replace(/\s+/g, '_')}_bracket.csv`, csv);
};
