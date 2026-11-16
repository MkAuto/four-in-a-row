/**
 * Runs the AI search in a background thread, so the page stays responsive
 * while the computer thinks.
 */
import { Board, type Disc } from '../game/board.ts';
import { LEVELS, type Level } from './levels.ts';
import { chooseMove } from './minimax.ts';

export interface AiRequest {
  id: number;
  cells: Uint8Array;
  heights: Uint8Array;
  moveCount: number;
  disc: Disc;
  level: Level;
}

export interface AiResponse {
  id: number;
  col: number;
}

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { id, cells, heights, moveCount, disc, level } = event.data;
  const board = new Board(cells, heights, moveCount);
  const response: AiResponse = { id, col: chooseMove(board, disc, LEVELS[level]) };
  postMessage(response);
};
