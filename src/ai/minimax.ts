/**
 * The computer player: minimax search with alpha-beta pruning.
 *
 * Minimax tries every move, then every reply, and so on, `depth` moves ahead.
 * The AI is the "maximizing" player (it picks the move with the highest score)
 * and assumes its opponent always picks the move that is worst for the AI
 * (the "minimizing" player). Finished games get an exact score; positions at the
 * depth limit are scored by `evaluate`, a heuristic.
 *
 * Alpha-beta pruning skips moves that cannot change the result:
 * - alpha = the best score the maximizer is already guaranteed,
 * - beta  = the best score the minimizer is already guaranteed.
 * As soon as alpha >= beta, the remaining moves of that position are pruned.
 *
 * A few classic speed-ups on top of that:
 * - move ordering: center columns first, so good moves (and pruning) come early;
 * - if the player to move can win right away, no need to search further;
 * - if the opponent threatens to win, blocking is the only move worth searching;
 * - a transposition table remembers positions already searched (the same position
 *   can be reached through different move orders);
 * - iterative deepening: search 1 move ahead, then 2, then 3... until the depth is
 *   reached or the time limit runs out (then the last finished search is used).
 */
import { Board, COLS, ROWS, opponent, type Disc } from '../game/board.ts';
import type { SearchOptions } from './levels.ts';

/** Score of a win. Wins found sooner score higher (see `winScore`). */
export const WIN_SCORE = 1_000_000;

/** Center columns first: they are usually the best moves, which speeds up pruning. */
const MOVE_ORDER: readonly number[] = [3, 2, 4, 1, 5, 0, 6];

/** Every group of 4 aligned cells on the board (69 of them), as flat cell indexes. */
const WINDOWS: readonly (readonly number[])[] = (() => {
  const windows: number[][] = [];
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      for (const [dRow, dCol] of directions) {
        const endRow = row + 3 * dRow;
        const endCol = col + 3 * dCol;
        if (endRow < 0 || endRow >= ROWS || endCol < 0 || endCol >= COLS) continue;
        windows.push([0, 1, 2, 3].map((k) => (row + k * dRow) * COLS + (col + k * dCol)));
      }
    }
  }
  return windows;
})();

/**
 * Heuristic score of a position from `me`'s point of view (positive = good for `me`).
 * Used when the search reaches its depth limit without the game ending.
 */
export function evaluate(board: Board, me: Disc): number {
  const them = opponent(me);
  const cells = board.cells;
  let score = 0;

  // Discs in the center column take part in the most possible lines.
  for (let row = 0; row < ROWS; row++) {
    const cell = cells[row * COLS + 3];
    if (cell === me) score += 3;
    else if (cell === them) score -= 3;
  }

  // Reward groups of 4 cells that only one player can still complete.
  for (const window of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const index of window) {
      const cell = cells[index];
      if (cell === me) mine++;
      else if (cell === them) theirs++;
    }
    if (mine > 0 && theirs > 0) continue; // blocked for both
    if (mine === 3) score += 5;
    else if (mine === 2) score += 2;
    else if (theirs === 3) score -= 5;
    else if (theirs === 2) score -= 2;
  }
  return score;
}

/**
 * Score of a win happening when the board holds `discsAtWin` discs.
 * Faster wins score higher, and slower losses are less bad.
 */
function winScore(discsAtWin: number, aiWins: boolean): number {
  return aiWins ? WIN_SCORE - discsAtWin : -WIN_SCORE + discsAtWin;
}

/** True if `disc` would complete a line of four by playing in `col`. */
function winsWith(board: Board, col: number, disc: Disc): boolean {
  if (!board.canPlay(col)) return false;
  const row = board.play(col, disc);
  const wins = board.isWinAt(row, col);
  board.undo(col);
  return wins;
}

/* ---------- Transposition table ---------- */

const EXACT = 0; // the stored score is exact
const LOWER_BOUND = 1; // the real score is >= the stored score
const UPPER_BOUND = 2; // the real score is <= the stored score

/** Fixed-size table of already searched positions, stored in typed arrays for speed. */
class TranspositionTable {
  private readonly size = 1 << 20;
  private readonly keys = new Float64Array(this.size);
  private readonly scores = new Int32Array(this.size);
  private readonly depths = new Int8Array(this.size);
  private readonly flags = new Uint8Array(this.size);
  private readonly bestMoves = new Int8Array(this.size);

  constructor() {
    this.clear();
  }

  clear(): void {
    this.keys.fill(-1);
  }

  /** Spreads the 49-bit board key over the table. */
  private slot(key: number): number {
    const low = key % 0x1_0000_0000;
    const high = (key - low) / 0x1_0000_0000;
    return Math.imul(low ^ Math.imul(high, 0x85eb_ca6b), 0x9e37_79b1) >>> 12; // top 20 bits
  }

  /** Returns the slot index holding `key`, or -1 if the position is not stored. */
  find(key: number): number {
    const slot = this.slot(key);
    return this.keys[slot] === key ? slot : -1;
  }

  store(key: number, depth: number, score: number, flag: number, bestMove: number): void {
    const slot = this.slot(key);
    this.keys[slot] = key;
    this.depths[slot] = depth;
    this.scores[slot] = score;
    this.flags[slot] = flag;
    this.bestMoves[slot] = bestMove;
  }

  depth(slot: number): number {
    return this.depths[slot];
  }
  score(slot: number): number {
    return this.scores[slot];
  }
  flag(slot: number): number {
    return this.flags[slot];
  }
  bestMove(slot: number): number {
    return this.bestMoves[slot];
  }
}

let sharedTable: TranspositionTable | null = null;

/* ---------- Search ---------- */

class SearchTimeout extends Error {}

interface SearchContext {
  readonly ai: Disc;
  readonly table: TranspositionTable;
  readonly deadline: number;
  nodes: number;
}

/**
 * Classic minimax with alpha-beta pruning. Returns the score of `board` for the AI,
 * looking `depth` moves ahead. `aiToMove` says whose turn it is (maximizing or not).
 */
function minimax(
  ctx: SearchContext,
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  aiToMove: boolean,
): number {
  if ((++ctx.nodes & 0xfff) === 0 && performance.now() > ctx.deadline) throw new SearchTimeout();

  const disc = aiToMove ? ctx.ai : opponent(ctx.ai);
  const other = opponent(disc);

  // 1. The player to move can win right away: nothing can be better.
  for (const col of MOVE_ORDER) {
    if (winsWith(board, col, disc)) return winScore(board.moveCount + 1, aiToMove);
  }

  // 2. Opponent threats: one threat must be blocked, two threats cannot both be blocked.
  let threats = 0;
  let forcedMove = -1;
  for (const col of MOVE_ORDER) {
    if (winsWith(board, col, other)) {
      threats++;
      forcedMove = col;
    }
  }
  if (threats >= 2) return winScore(board.moveCount + 2, !aiToMove);

  // 3. Already searched this position deep enough? Reuse (or tighten the window with) it.
  const { table } = ctx;
  const originalAlpha = alpha;
  const originalBeta = beta;
  let firstMove = forcedMove;
  const slot = table.find(board.key);
  if (slot >= 0) {
    if (table.depth(slot) >= depth) {
      const stored = table.score(slot);
      const flag = table.flag(slot);
      if (flag === EXACT) return stored;
      if (flag === LOWER_BOUND) alpha = Math.max(alpha, stored);
      else beta = Math.min(beta, stored);
      if (alpha >= beta) return stored;
    }
    if (firstMove < 0) firstMove = table.bestMove(slot);
  }

  // 4. Try the moves: the forced/remembered move first, then center columns first.
  let best = aiToMove ? -Infinity : Infinity;
  let bestMove = -1;
  for (let i = -1; i < MOVE_ORDER.length; i++) {
    const col = i < 0 ? firstMove : MOVE_ORDER[i];
    if (col < 0 || (i >= 0 && col === firstMove) || !board.canPlay(col)) continue;

    board.play(col, disc); // cannot be a winning move: step 1 would have returned
    let score: number;
    if (board.isFull()) score = 0; // draw
    else if (depth <= 1) score = evaluate(board, ctx.ai);
    else score = minimax(ctx, board, depth - 1, alpha, beta, !aiToMove);
    board.undo(col);

    if (aiToMove ? score > best : score < best) {
      best = score;
      bestMove = col;
    }
    if (aiToMove) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (alpha >= beta) break; // prune: the other player would never allow this position
    if (forcedMove >= 0) break; // only the blocking move matters
  }

  const flag = best <= originalAlpha ? UPPER_BOUND : best >= originalBeta ? LOWER_BOUND : EXACT;
  table.store(board.key, depth, best, flag, bestMove);
  return best;
}

export interface MoveAnalysis {
  /** The chosen column. */
  col: number;
  /** The best score found. */
  score: number;
  /** Every column that reached the best score (the chosen one is picked among them). */
  bestMoves: number[];
  /** How many moves ahead the last finished search looked. */
  depthReached: number;
}

/** Scores every legal move `depth` moves ahead and keeps the best ones. */
function searchRoot(ctx: SearchContext, board: Board, depth: number): MoveAnalysis {
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const col of MOVE_ORDER) {
    if (!board.canPlay(col)) continue;
    const row = board.play(col, ctx.ai);

    let score: number;
    if (board.isWinAt(row, col)) score = winScore(board.moveCount, true);
    else if (board.isFull()) score = 0;
    else if (depth <= 1) score = evaluate(board, ctx.ai);
    // alpha = bestScore - 1: moves strictly worse than the best get pruned early,
    // while moves that tie the best still get their exact score (scores are integers).
    else score = minimax(ctx, board, depth - 1, bestScore - 1, Infinity, false);

    board.undo(col);

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [col];
    } else if (score === bestScore) {
      bestMoves.push(col);
    }
  }
  return { col: bestMoves[0], score: bestScore, bestMoves, depthReached: depth };
}

/**
 * Finds the best moves for `ai`, searching up to `depth` moves ahead (deeper searches
 * stop early if `timeLimitMs` runs out). Ties between equally good moves are broken
 * at random.
 */
export function analyzeMoves(
  board: Board,
  ai: Disc,
  depth: number,
  timeLimitMs = Infinity,
  random: () => number = Math.random,
): MoveAnalysis {
  if (board.legalMoves().length === 0) throw new Error('No legal move: the board is full');

  sharedTable ??= new TranspositionTable();
  sharedTable.clear();
  const ctx: SearchContext = {
    ai,
    table: sharedTable,
    deadline: performance.now() + timeLimitMs,
    nodes: 0,
  };
  const work = board.clone();

  // Iterative deepening: depth 1 always finishes, deeper searches may time out.
  let result = searchRoot(ctx, work, 1);
  for (let d = 2; d <= depth; d++) {
    try {
      result = searchRoot(ctx, work, d);
    } catch (error) {
      if (error instanceof SearchTimeout) break;
      throw error;
    }
    if (Math.abs(result.score) > WIN_SCORE / 2) break; // forced win or loss found: done
  }

  const col = result.bestMoves[Math.floor(random() * result.bestMoves.length)];
  return { ...result, col };
}

/** Picks the column the AI plays, following the difficulty's search options. */
export function chooseMove(
  board: Board,
  ai: Disc,
  options: SearchOptions,
  random: () => number = Math.random,
): number {
  if (options.blunderChance > 0 && random() < options.blunderChance) {
    const moves = board.legalMoves();
    if (moves.length === 0) throw new Error('No legal move: the board is full');
    return moves[Math.floor(random() * moves.length)];
  }
  return analyzeMoves(board, ai, options.depth, options.timeLimitMs, random).col;
}
