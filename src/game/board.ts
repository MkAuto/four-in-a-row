/**
 * The Four in a Row board: 6 rows by 7 columns.
 *
 * Row 0 is the BOTTOM row, so a disc dropped in an empty column lands in row 0.
 * Cells are stored row by row in one flat array: index = row * COLS + col.
 */
export const ROWS = 6;
export const COLS = 7;

export const EMPTY = 0;
export const RED = 1;
export const BLUE = 2;

export type Disc = typeof RED | typeof BLUE;
export type Cell = typeof EMPTY | Disc;

/** A cell position as [row, col]. */
export type Position = readonly [row: number, col: number];

export function opponent(disc: Disc): Disc {
  return disc === RED ? BLUE : RED;
}

/** Line directions as [dRow, dCol]: horizontal, vertical, and both diagonals. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/**
 * `Board.key` packs a position into one number: each column uses 7 bits, holding a
 * 1 for every red disc plus a marker bit just above the top disc. 7 columns x 7 bits
 * = 49 bits, which a JavaScript number stores exactly (up to 2^53).
 */
const COLUMN_BITS = 7;
const pow2 = (exponent: number): number => 2 ** exponent;

export class Board {
  readonly cells: Uint8Array;
  /** Number of discs in each column, which is also the row where the next disc lands. */
  readonly heights: Uint8Array;
  moveCount: number;
  /** A unique number for this position, kept up to date by `play` and `undo`. */
  key: number;

  constructor(
    cells: Uint8Array = new Uint8Array(ROWS * COLS),
    heights: Uint8Array = new Uint8Array(COLS),
    moveCount = 0,
  ) {
    this.cells = cells;
    this.heights = heights;
    this.moveCount = moveCount;
    this.key = this.computeKey();
  }

  /**
   * Builds a board from a drawing, top row first. `R` = red, `B` = blue,
   * anything else = empty. Spaces are ignored. Handy in tests:
   *
   *     Board.fromRows([
   *       '. . . . . . .',
   *       ...
   *       'R R B . . . .',
   *     ])
   */
  static fromRows(rows: readonly string[]): Board {
    if (rows.length !== ROWS) throw new Error(`Expected ${ROWS} rows, got ${rows.length}`);
    const board = new Board();
    // Fill from the bottom row up, like discs falling into the columns.
    for (let row = 0; row < ROWS; row++) {
      const line = rows[ROWS - 1 - row];
      const chars = line.replace(/\s+/g, '');
      if (chars.length !== COLS) throw new Error(`Row "${line}" must have ${COLS} cells`);
      for (let col = 0; col < COLS; col++) {
        const disc = chars[col] === 'R' ? RED : chars[col] === 'B' ? BLUE : EMPTY;
        if (disc === EMPTY) continue;
        if (board.heights[col] !== row) throw new Error(`Floating disc at row ${row}, column ${col}`);
        board.play(col, disc);
      }
    }
    return board;
  }

  clone(): Board {
    return new Board(this.cells.slice(), this.heights.slice(), this.moveCount);
  }

  get(row: number, col: number): Cell {
    return this.cells[row * COLS + col] as Cell;
  }

  canPlay(col: number): boolean {
    return col >= 0 && col < COLS && this.heights[col] < ROWS;
  }

  legalMoves(): number[] {
    const moves: number[] = [];
    for (let col = 0; col < COLS; col++) if (this.canPlay(col)) moves.push(col);
    return moves;
  }

  /** Drops a disc in a column and returns the row where it landed. */
  play(col: number, disc: Disc): number {
    if (!this.canPlay(col)) throw new Error(`Column ${col} is full or does not exist`);
    const row = this.heights[col];
    this.cells[row * COLS + col] = disc;
    this.heights[col] = row + 1;
    this.moveCount++;
    // The marker bit moves up one (+2^row), and a red disc also sets its own bit (+2^row).
    this.key += (disc === RED ? 2 : 1) * pow2(col * COLUMN_BITS + row);
    return row;
  }

  /** Removes the top disc of a column. The AI uses it to take back moves it tried. */
  undo(col: number): void {
    const row = this.heights[col] - 1;
    if (row < 0) throw new Error(`Column ${col} is empty`);
    const disc = this.cells[row * COLS + col];
    this.key -= (disc === RED ? 2 : 1) * pow2(col * COLUMN_BITS + row);
    this.cells[row * COLS + col] = EMPTY;
    this.heights[col] = row;
    this.moveCount--;
  }

  isFull(): boolean {
    return this.moveCount === ROWS * COLS;
  }

  /** True if the disc at (row, col) is part of a line of four or more. Fast, no allocation. */
  isWinAt(row: number, col: number): boolean {
    const disc = this.get(row, col);
    if (disc === EMPTY) return false;
    for (const [dRow, dCol] of DIRECTIONS) {
      const length =
        1 + this.countSame(row, col, dRow, dCol, disc) + this.countSame(row, col, -dRow, -dCol, disc);
      if (length >= 4) return true;
    }
    return false;
  }

  /** Every cell of the line(s) of four or more going through (row, col). Empty if none. */
  winningCells(row: number, col: number): Position[] {
    const disc = this.get(row, col);
    if (disc === EMPTY) return [];
    const cells: Position[] = [];
    for (const [dRow, dCol] of DIRECTIONS) {
      const forward = this.countSame(row, col, dRow, dCol, disc);
      const backward = this.countSame(row, col, -dRow, -dCol, disc);
      if (1 + forward + backward < 4) continue;
      for (let k = -backward; k <= forward; k++) {
        const position: Position = [row + k * dRow, col + k * dCol];
        if (!cells.some(([r, c]) => r === position[0] && c === position[1])) cells.push(position);
      }
    }
    return cells;
  }

  private computeKey(): number {
    let key = 0;
    for (let col = 0; col < COLS; col++) {
      let columnCode = pow2(this.heights[col]); // marker bit above the top disc
      for (let row = 0; row < this.heights[col]; row++) {
        if (this.cells[row * COLS + col] === RED) columnCode += pow2(row);
      }
      key += columnCode * pow2(col * COLUMN_BITS);
    }
    return key;
  }

  /** Counts consecutive `disc` cells starting next to (row, col) and walking in one direction. */
  private countSame(row: number, col: number, dRow: number, dCol: number, disc: Disc): number {
    let count = 0;
    let r = row + dRow;
    let c = col + dCol;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.cells[r * COLS + c] === disc) {
      count++;
      r += dRow;
      c += dCol;
    }
    return count;
  }
}
