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
  zone?: string; // e.g. "Top Half", "Bottom Half", "Bracket A"
  teams: Team[];
}

export enum RuleType {
  MUTUAL_EXCLUSION = 'MUTUAL_EXCLUSION', // e.g., No two teams from Org A in same group
  SEED_SEPARATION = 'SEED_SEPARATION',   // e.g., Seed 1 and 2 cannot meet in same group
  ZONE_SEPARATION = 'ZONE_SEPARATION',   // e.g., Seed 1 and 2 cannot meet in same Zone (Bracket Half)
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
