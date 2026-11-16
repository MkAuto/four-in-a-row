import { Board, type Disc } from '../game/board.ts';
import type { AiRequest, AiResponse } from './ai.worker.ts';
import { LEVELS, type Level } from './levels.ts';
import { chooseMove } from './minimax.ts';

export class AiCancelledError extends Error {
  constructor() {
    super('AI move cancelled');
  }
}

interface PendingMove {
  request: AiRequest;
  resolve: (col: number) => void;
  reject: (error: Error) => void;
}

/**
 * Asks the AI web worker for moves. If the worker cannot run, the move is
 * computed on the main thread instead (the page may pause while it thinks).
 */
export class AiPlayer {
  private worker: Worker | null = null;
  private workerFailed = typeof Worker === 'undefined';
  private nextId = 1;
  private readonly pending = new Map<number, PendingMove>();

  chooseMove(board: Board, disc: Disc, level: Level): Promise<number> {
    const request: AiRequest = {
      id: this.nextId++,
      cells: board.cells.slice(),
      heights: board.heights.slice(),
      moveCount: board.moveCount,
      disc,
      level,
    };
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { request, resolve, reject });
      if (this.workerFailed) setTimeout(() => this.computeHere(), 0);
      else this.getWorker().postMessage(request);
    });
  }

  /** Stops any search in progress, e.g. when the player leaves the game. */
  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const move of this.pending.values()) move.reject(new AiCancelledError());
    this.pending.clear();
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<AiResponse>) => {
      const { id, col } = event.data;
      this.pending.get(id)?.resolve(col);
      this.pending.delete(id);
    };
    worker.onerror = (event) => {
      console.warn('AI worker failed, thinking on the main thread instead:', event.message);
      worker.terminate();
      this.worker = null;
      this.workerFailed = true;
      this.computeHere();
    };
    this.worker = worker;
    return worker;
  }

  /** Main-thread fallback: answers every pending request directly. */
  private computeHere(): void {
    for (const [id, { request, resolve }] of this.pending) {
      this.pending.delete(id);
      const board = new Board(request.cells, request.heights, request.moveCount);
      resolve(chooseMove(board, request.disc, LEVELS[request.level]));
    }
  }
}
