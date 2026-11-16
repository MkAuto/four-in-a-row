import { Board, RED, opponent, type Disc, type Position } from './board.ts';
import type { Level } from '../ai/levels.ts';

export interface Player {
  /** The name typed in the menu (may be empty: the UI then shows "Player 1" / "Player 2"). */
  readonly name: string;
  readonly disc: Disc;
  /** Set for computer players: the AI difficulty. */
  readonly level?: Level;
}

export type MatchStatus =
  | { readonly kind: 'playing' }
  | { readonly kind: 'won'; readonly winner: Player; readonly cells: readonly Position[] }
  | { readonly kind: 'draw' };

/** One game between two players. Red always plays first. */
export class Match {
  readonly board = new Board();
  readonly players: readonly [Player, Player];
  turn: Disc = RED;
  status: MatchStatus = { kind: 'playing' };

  constructor(players: readonly [Player, Player]) {
    if (players[0].disc === players[1].disc) throw new Error('Players must have different colors');
    this.players = players;
  }

  get currentPlayer(): Player {
    return this.playerWith(this.turn);
  }

  get moveCount(): number {
    return this.board.moveCount;
  }

  get isOver(): boolean {
    return this.status.kind !== 'playing';
  }

  playerWith(disc: Disc): Player {
    return this.players[0].disc === disc ? this.players[0] : this.players[1];
  }

  /** Plays the current player's disc in `col`. Returns false if that move is not allowed. */
  play(col: number): boolean {
    if (this.isOver || !this.board.canPlay(col)) return false;
    const row = this.board.play(col, this.turn);
    const cells = this.board.winningCells(row, col);
    if (cells.length > 0) this.status = { kind: 'won', winner: this.currentPlayer, cells };
    else if (this.board.isFull()) this.status = { kind: 'draw' };
    else this.turn = opponent(this.turn);
    return true;
  }
}
