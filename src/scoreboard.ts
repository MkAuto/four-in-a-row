import { load, save } from './storage.ts';

/** Wins of Player 1 and Player 2, and draws, for one matchup. */
export interface Score {
  p1: number;
  p2: number;
  draws: number;
}

export type Result = 'p1' | 'p2' | 'draw';

const STORAGE_KEY = 'scores';
const EMPTY_SCORE: Score = { p1: 0, p2: 0, draws: 0 };

/**
 * Scores saved in the browser, one entry per matchup (same names, same mode),
 * so they survive a page reload.
 */
export class Scoreboard {
  private readonly key: string;

  constructor(matchupKey: string) {
    this.key = matchupKey;
  }

  get(): Score {
    return { ...EMPTY_SCORE, ...load<Record<string, Score>>(STORAGE_KEY, {})[this.key] };
  }

  record(result: Result): Score {
    const score = this.get();
    score[result === 'draw' ? 'draws' : result]++;
    this.write(score);
    return score;
  }

  reset(): Score {
    this.write({ ...EMPTY_SCORE });
    return this.get();
  }

  private write(score: Score): void {
    const all = load<Record<string, Score>>(STORAGE_KEY, {});
    all[this.key] = score;
    save(STORAGE_KEY, all);
  }
}
