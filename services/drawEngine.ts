import { Team, Group, Rule, RuleType } from '../types';

/**
 * Checks if a specific team placement violates any active rules for a group.
 */
const checkConstraints = (
  team: Team,
  group: Group,
  groupsState: Group[], // Need full state for zone checks
  rules: Rule[]
): { valid: boolean; reason?: string } => {

  // 1. Capacity Check
  if (group.teams.length >= group.capacity) {
    return { valid: false, reason: `Group ${group.name} is full` };
  }

  for (const rule of rules) {
    if (!rule.isActive) continue;

    switch (rule.type) {
      case RuleType.TEAM_LOCK: {
        // If this rule applies to the current team
        if (rule.params.teamId === team.id) {
          // Then the current group MUST be the locked group
          if (group.id !== rule.params.groupId) {
            return {
              valid: false,
              reason: `Rule Violation: Team '${team.name}' is locked to a different group.`
            };
          }
        }
        break;
      }

      case RuleType.MUTUAL_EXCLUSION: {
        const attr = rule.params.attribute as keyof Team;
        if (!attr) continue;

        // Check if any team currently in the group has the same attribute value
        const hasConflict = group.teams.some(
          (t) => t[attr] === team[attr] && t[attr] !== undefined
        );

        if (hasConflict) {
          return {
            valid: false,
            reason: `Rule Violation: Mutual Exclusion on '${attr}' (${team[attr]})`
          };
        }
        break;
      }

      case RuleType.SEED_SEPARATION: {
        const seedsToSeparate = rule.params.seeds || [];
        // If current team is one of the seeds
        if (team.seed && seedsToSeparate.includes(team.seed)) {
          // Check if another restricted seed is already in THIS group
          const hasConflict = group.teams.some(
            (t) => t.seed && seedsToSeparate.includes(t.seed)
          );
          if (hasConflict) {
            return {
              valid: false,
              reason: `Rule Violation: Seed Separation (${team.seed})`
            };
          }
        }
        break;
      }

      case RuleType.ZONE_SEPARATION: {
        const seedsToSeparate = rule.params.seeds || [];
        // Only applies if the current group has a zone defined
        if (group.zone && team.seed && seedsToSeparate.includes(team.seed)) {
          // Check all OTHER groups with the SAME zone to see if they contain a restricted seed
          for (const g of groupsState) {
            if (g.zone === group.zone) {
              // Iterate teams in that group (could be the current group or another one in the zone)
              const hasConflict = g.teams.some(
                (t) => t.seed && seedsToSeparate.includes(t.seed)
              );

              if (hasConflict) {
                return {
                  valid: false,
                  reason: `Rule Violation: Zone Separation. Zone '${group.zone}' already contains a restricted seed.`
                };
              }
            }
          }
        }
        break;
      }

      case RuleType.MAX_PER_GROUP: {
        const attr = rule.params.attribute as keyof Team;
        const max = rule.params.maxCount || 1;
        if (!attr) continue;

        const count = group.teams.filter(t => t[attr] === team[attr]).length;
        if (count >= max) {
          return {
            valid: false,
            reason: `Rule Violation: Max ${max} per group for '${attr}'`
          };
        }
        break;
      }
    }
  }

  return { valid: true };
};

/**
 * Core recursive backtracking algorithm.
 */
const solveDraw = (
  teamsToPlace: Team[],
  groups: Group[],
  rules: Rule[],
  startTime: number,
  timeLimit: number
): boolean => {
  // Timeout safeguard
  if (Date.now() - startTime > timeLimit) return false;

  // Base case: All teams placed
  if (teamsToPlace.length === 0) return true;

  const currentTeam = teamsToPlace[0];
  const remainingTeams = teamsToPlace.slice(1);

  // Shuffle group iteration order to produce varied results across runs
  const shuffledGroupIndices = groups.map((_, i) => i);
  for (let i = shuffledGroupIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledGroupIndices[i], shuffledGroupIndices[j]] = [shuffledGroupIndices[j], shuffledGroupIndices[i]];
  }

  // Try to place currentTeam in each group (randomized order)
  for (const idx of shuffledGroupIndices) {
    const group = groups[idx];
    // Pass 'groups' (the full array) to allow cross-group checks (Zone Separation)
    const check = checkConstraints(currentTeam, group, groups, rules);

    if (check.valid) {
      // PLACEMENT
      group.teams.push(currentTeam);

      // RECURSION
      if (solveDraw(remainingTeams, groups, rules, startTime, timeLimit)) {
        return true;
      }

      // BACKTRACK
      group.teams.pop();
    }
  }

  return false; // Unable to place currentTeam in any group given current state
};

export const runDraw = (
  teams: Team[],
  groupsConfig: Group[],
  rules: Rule[]
): { success: boolean; groups: Group[]; logs: string[] } => {
  const start = Date.now();

  // Deep copy to avoid mutating state directly during calculation
  const workingGroups: Group[] = groupsConfig.map(g => ({ ...g, teams: [] }));
  const workingTeams = [...teams];

  // Shuffle teams for randomness
  for (let i = workingTeams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [workingTeams[i], workingTeams[j]] = [workingTeams[j], workingTeams[i]];
  }

  // OPTIMIZATION: Sort teams so Seeds and Rules with constraints (like Locks) are placed FIRST.
  workingTeams.sort((a, b) => {
    // Check if team has a Lock rule
    const aLocked = rules.some(r => r.type === RuleType.TEAM_LOCK && r.params.teamId === a.id);
    const bLocked = rules.some(r => r.type === RuleType.TEAM_LOCK && r.params.teamId === b.id);

    if (aLocked && !bLocked) return -1;
    if (!aLocked && bLocked) return 1;

    // Then priority: Has Seed
    if (a.seed !== null && b.seed === null) return -1;
    if (a.seed === null && b.seed !== null) return 1;

    return 0;
  });

  const success = solveDraw(workingTeams, workingGroups, rules, start, 2000); // 2s timeout

  const logs = [];
  if (success) {
    logs.push(`Successfully placed ${teams.length} teams into ${groupsConfig.length} groups.`);
    logs.push(`Time taken: ${Date.now() - start}ms`);
  } else {
    logs.push("Failed to find a valid configuration.");
    logs.push("Possible causes: Too many constraints, groups too small, or bad luck in randomization.");
    logs.push(`Time elapsed: ${Date.now() - start}ms`);
  }

  return { success, groups: workingGroups, logs };
};
