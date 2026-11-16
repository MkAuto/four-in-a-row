import { describe, expect, it } from 'vitest';
import { BLUE, RED } from './board.ts';
import { Match, type Player } from './match.ts';

const alice: Player = { name: 'Alice', disc: BLUE };
const bob: Player = { name: 'Bob', disc: RED };

describe('Match', () => {
  it('starts with red and alternates turns', () => {
    const match = new Match([alice, bob]);
    expect(match.currentPlayer).toBe(bob);
    match.play(3);
    expect(match.currentPlayer).toBe(alice);
    match.play(3);
    expect(match.currentPlayer).toBe(bob);
    expect(match.moveCount).toBe(2);
  });

  it('declares the winner and refuses further moves', () => {
    const match = new Match([alice, bob]);
    for (const col of [0, 6, 1, 6, 2, 6]) match.play(col); // red: 0 1 2, blue: 6 6 6
    expect(match.isOver).toBe(false);
    expect(match.play(3)).toBe(true); // red completes 0-1-2-3
    expect(match.status).toMatchObject({ kind: 'won', winner: bob });
    expect(match.status.kind === 'won' && match.status.cells).toHaveLength(4);
    expect(match.play(6)).toBe(false);
    expect(match.moveCount).toBe(7);
  });

  it('ends in a draw when the board fills up without a line of four', () => {
    const match = new Match([alice, bob]);
    const moves = '655213020640034662344121264645135231001553';
    for (const col of moves) expect(match.play(Number(col))).toBe(true);
    expect(match.status).toEqual({ kind: 'draw' });
    expect(match.moveCount).toBe(42);
  });

  it('ignores a move in a full column without changing turns', () => {
    const match = new Match([alice, bob]);
    for (let i = 0; i < 6; i++) match.play(0);
    const turn = match.turn;
    expect(match.play(0)).toBe(false);
    expect(match.turn).toBe(turn);
  });

  it('requires two different colors', () => {
    expect(() => new Match([alice, { ...bob, disc: BLUE }])).toThrow();
  });
});
