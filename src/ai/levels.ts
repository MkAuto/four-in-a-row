export type Level = 'easy' | 'normal' | 'hard';

export const LEVEL_NAMES: readonly Level[] = ['easy', 'normal', 'hard'];

export interface SearchOptions {
  /** How many moves ahead the AI looks (its own move counts as 1). */
  depth: number;
  /** Chance (0 to 1) of playing a random column instead of the best one. */
  blunderChance: number;
  /** Stop searching deeper after this many milliseconds (the last finished depth is used). */
  timeLimitMs?: number;
}

export const LEVELS: Readonly<Record<Level, SearchOptions>> = {
  easy: { depth: 2, blunderChance: 0.3 },
  normal: { depth: 5, blunderChance: 0 },
  hard: { depth: 10, blunderChance: 0, timeLimitMs: 2000 },
};
