import { Team, Group, Rule, RuleType } from './types';

// Helper to generate IDs
const uuid = () => Math.random().toString(36).substring(2, 9);

// Default Badminton Scenario: 7 Orgs, 2 Teams each (14 total)
const orgs = ['Org A', 'Org B', 'Org C', 'Org D', 'Org E', 'Org F', 'Org G'];

export const INITIAL_TEAMS: Team[] = orgs.flatMap((org, index) => {
  // Org A is seeded
  const team1: Team = {
    id: uuid(),
    name: `${org} - Team 1`,
    organization: org,
    seed: org === 'Org A' ? 1 : (org === 'Org B' ? 2 : null), 
    tags: ['Team 1']
  };

  const team2: Team = {
    id: uuid(),
    name: `${org} - Team 2`,
    organization: org,
    seed: null,
    tags: ['Team 2']
  };

  return [team1, team2];
});

// 4 Groups: 2 of size 3, 2 of size 4
// Added 'zone' to illustrate Bracket separation (Top/Bottom half)
export const INITIAL_GROUPS: Group[] = [
  { id: uuid(), name: 'Group A', capacity: 3, teams: [], zone: 'Top Half' },
  { id: uuid(), name: 'Group B', capacity: 3, teams: [], zone: 'Top Half' },
  { id: uuid(), name: 'Group C', capacity: 4, teams: [], zone: 'Bottom Half' },
  { id: uuid(), name: 'Group D', capacity: 4, teams: [], zone: 'Bottom Half' },
];

export const INITIAL_RULES: Rule[] = [
  {
    id: uuid(),
    name: 'No same Organization in group',
    type: RuleType.MUTUAL_EXCLUSION,
    isActive: true,
    params: { attribute: 'organization' }
  },
  {
    id: uuid(),
    name: 'Separate Top Seeds (1 & 2) in Groups',
    type: RuleType.SEED_SEPARATION,
    isActive: true,
    params: { seeds: [1, 2] }
  },
  {
    id: uuid(),
    name: 'Separate Top Seeds (1 & 2) in Bracket Zones',
    type: RuleType.ZONE_SEPARATION,
    isActive: true,
    params: { seeds: [1, 2] }
  }
];
