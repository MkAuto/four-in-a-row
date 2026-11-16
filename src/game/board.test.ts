import { describe, expect, it } from 'vitest';
import { BLUE, Board, COLS, EMPTY, RED, ROWS, opponent, type Disc } from './board.ts';
import { seededRandom } from '../testing/random.ts';

/** Reference win check: scans the whole board for any line of four. */
function hasAnyWin(board: Board): boolean {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const disc = board.get(row, col);
      if (disc === EMPTY) continue;
      for (const [dRow, dCol] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        let k = 1;
        while (
          k < 4 &&
          row + k * dRow >= 0 && row + k * dRow < ROWS &&
          col + k * dCol >= 0 && col + k * dCol < COLS &&
          board.get(row + k * dRow, col + k * dCol) === disc
        ) k++;
        if (k === 4) return true;
      }
    }
  }
  return false;
}

describe('Board', () => {
  it('stacks discs from the bottom of a column', () => {
    const board = new Board();
    expect(board.play(3, RED)).toBe(0);
    expect(board.play(3, BLUE)).toBe(1);
    expect(board.get(0, 3)).toBe(RED);
    expect(board.get(1, 3)).toBe(BLUE);
    expect(board.moveCount).toBe(2);
  });

  it('refuses a seventh disc in a full column', () => {
    const board = new Board();
    for (let i = 0; i < ROWS; i++) board.play(0, i % 2 ? BLUE : RED);
    expect(board.canPlay(0)).toBe(false);
    expect(board.legalMoves()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => board.play(0, RED)).toThrow();
  });

  it('undo restores the exact previous position', () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . B . . .',
      '. . R R B . .',
    ]);
    const before = board.clone();
    board.play(3, RED);
    board.undo(3);
    expect(board.cells).toEqual(before.cells);
    expect(board.heights).toEqual(before.heights);
    expect(board.key).toBe(before.key);
    expect(board.moveCount).toBe(before.moveCount);
  });

  it('gives the same key to the same position reached in a different order', () => {
    const a = new Board();
    a.play(0, RED);
    a.play(1, BLUE);
    a.play(2, RED);
    const b = new Board();
    b.play(2, RED);
    b.play(1, BLUE);
    b.play(0, RED);
    expect(a.key).toBe(b.key);
    expect(new Board(a.cells.slice(), a.heights.slice(), a.moveCount).key).toBe(a.key);
  });

  it('gives different keys to different positions', () => {
    const random = seededRandom(1);
    const seen = new Map<number, string>();
    for (let game = 0; game < 300; game++) {
      const board = new Board();
      let disc: Disc = RED;
      while (!board.isFull()) {
        const moves = board.legalMoves();
        board.play(moves[Math.floor(random() * moves.length)], disc);
        disc = opponent(disc);
        const picture = board.cells.join('');
        const previous = seen.get(board.key);
        if (previous !== undefined) expect(previous).toBe(picture);
        seen.set(board.key, picture);
      }
    }
  });

  it.each([
    ['horizontal', ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'B R R R R B B'], 0, 3],
    ['vertical', ['. . . . . . .', '. . . . . . .', '. . R . . . .', '. . R . . . .', '. . R . . . .', '. B R B . . .'], 3, 2],
    ['rising diagonal', ['. . . . . . .', '. . . . . . .', '. . . R . . .', '. . R B . . .', '. R B B . . .', 'R B B R . . .'], 0, 0],
    ['falling diagonal', ['. . . . . . .', '. . . . . . .', 'R . . . . . .', 'B R . . . . .', 'B B R . . . .', 'R B B R . . .'], 0, 3],
  ])('detects a %s line of four', (_name, rows, row, col) => {
    const board = Board.fromRows(rows);
    expect(board.isWinAt(row, col)).toBe(true);
    expect(board.winningCells(row, col)).toHaveLength(4);
  });

  it('detects the diagonal that the 2019 C# version missed', () => {
    const board = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . R . .',
      '. . . R B . .',
      '. R R B B . .',
      'R R B B B . .',
    ]);
    expect(board.isWinAt(3, 4)).toBe(true);
    expect(board.winningCells(3, 4)).toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
  });

  it('returns every cell of a line longer than four, and of two crossing lines', () => {
    const five = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      '. . . . . . .',
      'R R R R R B B',
    ]);
    expect(five.winningCells(0, 2)).toHaveLength(5);

    const cross = Board.fromRows([
      '. . . . . . .',
      '. . . . . . .',
      '. . . R . . .',
      '. . . R . . .',
      '. . . R . . .',
      'R R R R B B B',
    ]);
    expect(cross.winningCells(0, 3)).toHaveLength(7);
  });

  it('agrees with a full-board scan on thousands of random games', () => {
    const random = seededRandom(2019);
    for (let game = 0; game < 3000; game++) {
      const board = new Board();
      let disc: Disc = RED;
      while (!board.isFull()) {
        const moves = board.legalMoves();
        const col = moves[Math.floor(random() * moves.length)];
        const row = board.play(col, disc);
        const won = board.isWinAt(row, col);
        expect(won).toBe(hasAnyWin(board));
        if (won) break;
        disc = opponent(disc);
      }
    }
  });

  it('builds boards from drawings and rejects floating discs', () => {
    expect(() =>
      Board.fromRows(['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. R . . . . .', '. . . . . . .']),
    ).toThrow(/Floating/);
  });
});
