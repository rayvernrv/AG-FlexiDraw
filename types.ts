export interface Team {
  id: string;
  name: string;
  organization: string;
  seed?: number | null;
  tags: string[]; // For custom attribute matching
}

export interface Group {
  id: string;
  name: string;
  capacity: number;
  teams: Team[];
}

export enum RuleType {
  MUTUAL_EXCLUSION = 'MUTUAL_EXCLUSION', // e.g., No two teams from Org A in same group
  SEED_SEPARATION = 'SEED_SEPARATION',   // e.g., Seed 1 and 2 cannot meet in same group
  MAX_PER_GROUP = 'MAX_PER_GROUP',       // e.g., Max 1 team from Org A
  TEAM_LOCK = 'TEAM_LOCK',               // e.g., Team A MUST be in Group B
  HALF_SEPARATION = 'HALF_SEPARATION',   // e.g., Teams cannot meet until final (for elimination brackets)
  BRACKET_SLOT_LOCK = 'BRACKET_SLOT_LOCK', // Lock team to specific bracket position
}

export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  isActive: boolean;
  // Dynamic parameters based on type
  params: {
    attribute?: keyof Team | string; // e.g. "organization"
    seeds?: number[];                // e.g. [1, 2]
    maxCount?: number;               // e.g. 1
    value?: string;                  // e.g. "Org A" (specific target)
    teamId?: string;                 // For TEAM_LOCK / BRACKET_SLOT_LOCK
    groupId?: string;                // For TEAM_LOCK
    teamIds?: string[];              // For HALF_SEPARATION (multiple teams)
    slotPosition?: number;           // For BRACKET_SLOT_LOCK
  };
}

export interface DrawResult {
  success: boolean;
  groups: Group[];
  logs: string[];
  executionTimeMs: number;
}

export interface BracketDefinition {
  name: string; // e.g. "Round of 16"
  zones: string[]; // e.g. ["Top Half", "Bottom Half"] or ["Q1", "Q2", "Q3", "Q4"]
  advancingPerGroup: number; // e.g. 2 teams advance
}

// ==================== ELIMINATION BRACKET TYPES ====================

export type DrawMode = 'group' | 'elimination';

export interface BracketSlot {
  id: string;
  position: number;      // Position in bracket (0-indexed, 0 = top of bracket)
  team?: Team | null;    // Assigned team (null = to be drawn)
  isFixed: boolean;      // User locked this slot
}

export interface EliminationBracket {
  roundName: string;           // e.g. "Round of 16"
  totalSlots: number;          // e.g. 16
  slots: BracketSlot[];        // All slots in first round
}

export interface EliminationDrawResult {
  success: boolean;
  bracket: EliminationBracket;
  logs: string[];
}

// ==================== MATCHUP & SCHEDULE TYPES ====================

export interface Matchup {
  id: string;
  groupId: string;
  groupName: string;
  teamA: Team;
  teamB: Team;
  round: number; // Which round-robin iteration (1, 2, ..., n)
}

export interface SavedMatchupSchedule {
  id: string;
  name: string;
  createdAt: string;
  groups: Group[];
  matchups: Matchup[];
  roundRobinCount: number;
}

// ==================== RESULTS & RANKINGS TYPES ====================

export interface GameCategory {
  id: string;
  name: string; // e.g. "Men Singles", "Women Doubles"
  type: 'best_of_1' | 'best_of_3' | 'best_of_5' | 'best_of_7';
}

export interface GameResult {
  categoryId: string;
  teamASets: number;
  teamBSets: number;
  teamAPoints: number;
  teamBPoints: number;
  setScores: { teamAPoints: number | null; teamBPoints: number | null }[];
}

export interface MatchResult {
  matchupId: string;
  games: GameResult[];
  isComplete: boolean;
  // Computed summaries for the match
  teamAMatchWins: number;
  teamBMatchWins: number;
}

export interface RankingEntry {
  teamId: string;
  teamName: string;
  teamOrganization: string;
  groupId: string;
  groupName: string;

  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;

  setsWon: number;
  setsLost: number;
  setDifference: number;

  totalPointsWon: number;
  totalPointsLost: number;
  totalPointsDifference: number;

  deltaPointsPerGame: number;

  tiebreakerNote?: string; // If resolved by H2H or needs manual checking
}

export interface RankingRule {
  id: string;
  field: 'gamesWonLostDiff' | 'setWonLostDiff' | 'totalPointsDifference' | 'deltaPointsPerGame' | 'headToHead';
  direction: 'asc' | 'desc'; // Usually 'desc' for most points/wins
}
