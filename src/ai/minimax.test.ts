import { describe, expect, it } from 'vitest';
import { BLUE, Board, RED, opponent, type Disc } from '../game/board.ts';
import { seededRandom } from '../testing/random.ts';
import { LEVELS } from './levels.ts';
import { WIN_SCORE, analyzeMoves, chooseMove } from './minimax.ts';

const NORMAL = LEVELS.normal.depth;

/**
 * Reference: textbook alpha-beta over the whole remaining game, with no heuristic,
 * no shortcuts and no transposition table. Returns the exact game value for `ai`.
 */
function exactValue(board: Board, ai: Disc, aiToMove: boolean, alpha = -Infinity, beta = Infinity): number {
  const disc = aiToMove ? ai : opponent(ai);
  let best = aiToMove ? -Infinity : Infinity;
  for (const col of board.legalMoves()) {
    const row = board.play(col, disc);
    const score = board.isWinAt(row, col)
      ? aiToMove
        ? WIN_SCORE - board.moveCount
        : -WIN_SCORE + board.moveCount
      : board.isFull()
        ? 0
        : exactValue(board, ai, !aiToMove, alpha, beta);
    board.undo(col);
    if (aiToMove) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** Exact value of every legal move for the player to move. */
function exactMoveValues(board: Board, ai: Disc): Map<number, number> {
  const values = new Map<number, number>();
  for (const col of board.legalMoves()) {
    const row = board.play(col, ai);
    values.set(
      col,
      board.isWinAt(row, col) ? WIN_SCORE - board.moveCount : board.isFull() ? 0 : exactValue(board, ai, false),
    );
    board.undo(col);
  }
  return values;
}

/** Plays random moves until `discs` are on the board, restarting if someone wins first. */
function randomPosition(discs: number, random: () => number): { board: Board; toMove: Disc } {
  for (;;) {
    const board = new Board();
    let disc: Disc = RED;
    let won = false;
    while (board.moveCount < discs && !won) {
      const moves = board.legalMoves();
      const col = moves[Math.floor(random() * moves.length)];
      won = board.isWinAt(board.play(col, disc), col);
      disc = opponent(disc);
    }
    if (!won) return { board, toMove: disc };
  }
}

describe('minimax AI', () => {
  it('takes an immediate win', () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      'B . . . . . .',
      'R R R . B B .',
    ]);
    const result = analyzeMoves(board, RED, NORMAL);
    expect(result.col).toBe(3);
    expect(result.score).toBe(WIN_SCORE - 7);
  });

  it('wins even when the cell above would give the opponent a win (bug in the 2019 AI)', () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      'R R R . . . .',
      'B B B . R R B',
    ]);
    for (const depth of [1, 2, NORMAL, LEVELS.hard.depth]) {
      expect(analyzeMoves(board, BLUE, depth).col).toBe(3);
    }
  });

  it("blocks the opponent's immediate win", () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      'B B . . . . .',
      'R R R . . . .',
    ]);
    for (const depth of [2, NORMAL, LEVELS.hard.depth]) {
      expect(analyzeMoves(board, BLUE, depth).col).toBe(3);
    }
  });

  it("does not play right under the opponent's winning cell", () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      'R R R . . . .',
      'B B R . B . .',
    ]);
    for (const depth of [2, NORMAL]) {
      expect(analyzeMoves(board, BLUE, depth).bestMoves).not.toContain(3);
    }
  });

  it('stops an open three before it becomes a double threat', () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . B . . .',
      '. . R R . . .',
    ]);
    const result = analyzeMoves(board, BLUE, NORMAL);
    expect([1, 4]).toContain(result.col);
    expect(result.score).toBeGreaterThan(-WIN_SCORE / 2);
  });

  it('finds a forced win by creating a double threat', () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . B B . . .',
      '. . R R . . .',
    ]);
    const result = analyzeMoves(board, RED, NORMAL);
    expect(result.score).toBe(WIN_SCORE - 7);
    expect([...result.bestMoves].sort()).toEqual([1, 4]);
  });

  it('finds the exact result and every best move in endgames (checked against a full search)', () => {
    const random = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const emptyCells = 8 + (i % 5); // 8 to 12 empty cells left
      const { board, toMove } = randomPosition(42 - emptyCells, random);
      const values = exactMoveValues(board.clone(), toMove);
      const best = Math.max(...values.values());
      const bestMoves = [...values].filter(([, value]) => value === best).map(([col]) => col);

      const result = analyzeMoves(board, toMove, emptyCells);
      expect(result.score).toBe(best);
      expect([...result.bestMoves].sort()).toEqual(bestMoves.sort());
    }
  });

  it('respects the time limit by returning the deepest finished search', () => {
    const start = performance.now();
    const result = analyzeMoves(new Board(), RED, 40, 150);
    expect(performance.now() - start).toBeLessThan(1500);
    expect(result.depthReached).toBeGreaterThanOrEqual(1);
    expect(result.depthReached).toBeLessThan(40);
    expect(new Board().canPlay(result.col)).toBe(true);
  });

  it('only plays legal moves, including random "blunders"', () => {
    const board = Board.fromRows([
      'R . . . . . B',
      'B . . . . . R',
      'R . . . . . B',
      'B . . . . . R',
      'R . . . . . B',
      'B . . . . . R',
    ]);
    const random = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const col = chooseMove(board, RED, { depth: 2, blunderChance: 1 }, random);
      expect(board.canPlay(col)).toBe(true);
    }
  });

  it('throws when the board is full', () => {
    const board = new Board();
    let disc: Disc = RED;
    for (const col of '655213020640034662344121264645135231001553') {
      board.play(Number(col), disc);
      disc = opponent(disc);
    }
    expect(() => analyzeMoves(board, RED, 3)).toThrow(/full/);
  });

  it('Normal never loses to a random player', () => {
    const random = seededRandom(2026);
    for (let game = 0; game < 20; game++) {
      const ai: Disc = game % 2 === 0 ? RED : BLUE;
      const board = new Board();
      let disc: Disc = RED;
      let winner: Disc | null = null;
      while (!board.isFull() && winner === null) {
        const moves = board.legalMoves();
        const col =
          disc === ai
            ? chooseMove(board, ai, LEVELS.normal, random)
            : moves[Math.floor(random() * moves.length)];
        if (board.isWinAt(board.play(col, disc), col)) winner = disc;
        disc = opponent(disc);
      }
      expect(winner).toBe(ai);
    }
  });
});
