import { BLUE, COLS, RED, ROWS, type Disc } from '../game/board.ts';
import { Match, type Player } from '../game/match.ts';
import { AiCancelledError, type AiPlayer } from '../ai/aiPlayer.ts';
import { Scoreboard, type Result, type Score } from '../scoreboard.ts';
import { playDrop } from '../sound.ts';
import { t } from '../i18n.ts';
import { h, title } from './dom.ts';
import type { MenuChoices } from './menu.ts';

/** The AI waits at least this long before playing, like the original game's AI timer. */
const AI_MIN_THINK_MS = 500;
/** Delay before the end-of-game dialog, so players can see the winning line first. */
const END_DIALOG_DELAY_MS = 900;

const colorName = (disc: Disc): 'red' | 'blue' => (disc === RED ? 'red' : 'blue');
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface PlayerChip {
  root: HTMLElement;
  name: HTMLElement;
  score: HTMLElement;
}

/** The game screen: scoreboard, board and end-of-game dialog. */
export class GameView {
  readonly element: HTMLElement;

  private readonly choices: MenuChoices;
  private readonly ai: AiPlayer;
  private readonly onExit: () => void;
  private readonly scoreboard: Scoreboard;
  private match: Match;
  private score: Score;

  private aiThinking = false;
  /** Column under the mouse (or keyboard focus), for the ghost disc preview. */
  private hoverCol: number | null = null;
  /** Increased on every new AI turn and new match, to ignore outdated AI answers. */
  private turnId = 0;
  private dialogTimer = 0;
  private destroyed = false;

  private readonly cells: HTMLElement[] = []; // index = row * COLS + col
  private readonly columns: HTMLButtonElement[] = [];
  private readonly chips: PlayerChip[];
  private readonly drawsLabel = h('span', { class: 'draws__label' });
  private readonly drawsValue = h('span', { class: 'draws__value' });
  private readonly statusText = h('p', { class: 'status', 'aria-live': 'polite' });
  private readonly movesText = h('p', { class: 'moves' });
  private readonly boardElement: HTMLElement;
  private readonly againButton = h('button', { class: 'btn btn--small', onclick: () => this.newMatch() });
  private readonly resetButton = h('button', {
    class: 'btn btn--small btn--secondary',
    onclick: () => this.resetScores(),
  });
  private readonly menuButton = h('button', {
    class: 'btn btn--small btn--secondary',
    onclick: () => this.onExit(),
  });

  private readonly dialog = h('dialog', { class: 'dialog panel' });
  private readonly dialogTitle = h('h2', { class: 'dialog__title' });
  private readonly dialogMessage = h('p');
  private readonly dialogMoves = h('p');
  private readonly dialogQuestion = h('p', { class: 'dialog__question' });
  private readonly dialogAgain = h('button', { class: 'btn', onclick: () => this.newMatch() });
  private readonly dialogMenu = h('button', {
    class: 'btn btn--secondary',
    onclick: () => this.onExit(),
  });

  constructor(choices: MenuChoices, ai: AiPlayer, onExit: () => void) {
    this.choices = { ...choices };
    this.ai = ai;
    this.onExit = onExit;
    this.scoreboard = new Scoreboard(this.matchupKey());
    this.score = this.scoreboard.get();
    this.match = new Match(this.createPlayers());

    this.chips = [0, 1].map(() => {
      const name = h('span', { class: 'player-chip__name' });
      const score = h('span', { class: 'player-chip__score' });
      const root = h('div', { class: 'player-chip' }, h('span', { class: 'player-chip__token' }), name, score);
      return { root, name, score };
    });

    this.boardElement = h('div', { class: 'board', role: 'group' }, ...this.createColumns());

    this.dialog.append(
      this.dialogTitle,
      this.dialogMessage,
      this.dialogMoves,
      this.dialogQuestion,
      h('div', { class: 'dialog__actions' }, this.dialogAgain, this.dialogMenu),
    );

    this.element = h(
      'section',
      { class: 'game' },
      title('small'),
      h(
        'div',
        { class: 'scorebar' },
        this.chips[0].root,
        h('div', { class: 'draws' }, this.drawsLabel, this.drawsValue),
        this.chips[1].root,
      ),
      this.statusText,
      this.boardElement,
      h(
        'div',
        { class: 'game__footer' },
        this.movesText,
        h('div', { class: 'game__actions' }, this.againButton, this.resetButton, this.menuButton),
      ),
      this.dialog,
    );

    this.update();
    void this.playAiTurnIfNeeded();
  }

  /** Stops timers and any AI search. Call when leaving the game screen. */
  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.dialogTimer);
    if (this.aiThinking) this.ai.cancel();
    if (this.dialog.open) this.dialog.close();
  }

  /** Refreshes everything on screen from the match state (also used after a language change). */
  update(): void {
    const { match } = this;
    match.players.forEach((player, i) => {
      const chip = this.chips[i];
      chip.root.dataset.color = colorName(player.disc);
      chip.root.classList.toggle('is-turn', !match.isOver && match.turn === player.disc);
      chip.name.textContent = this.displayName(player);
      chip.score.textContent = String(i === 0 ? this.score.p1 : this.score.p2);
    });
    this.drawsLabel.textContent = t('draws');
    this.drawsValue.textContent = String(this.score.draws);

    this.statusText.textContent = this.statusMessage();
    const status = match.status;
    this.statusText.dataset.color =
      status.kind === 'won' ? colorName(status.winner.disc) : status.kind === 'draw' ? '' : colorName(match.turn);
    this.movesText.textContent = t('moves', { n: match.moveCount });

    this.againButton.textContent = t('playAgain');
    this.againButton.hidden = !match.isOver;
    this.resetButton.textContent = t('resetScores');
    this.menuButton.textContent = t('menu');
    this.boardElement.setAttribute('aria-label', t('board'));

    this.updateBoard();
    if (this.dialog.open) this.fillDialog();
  }

  private createPlayers(): [Player, Player] {
    const { mode, level, p1Name, p2Name, p1Disc } = this.choices;
    const p2Disc = p1Disc === RED ? BLUE : RED;
    return [
      { name: p1Name.trim(), disc: p1Disc },
      mode === 'solo' ? { name: '', disc: p2Disc, level } : { name: p2Name.trim(), disc: p2Disc },
    ];
  }

  /** Scores are kept per matchup: same mode (and AI level) and same names. */
  private matchupKey(): string {
    const { mode, level, p1Name, p2Name } = this.choices;
    return mode === 'solo'
      ? `solo:${level}:${p1Name.trim()}`
      : `versus:${p1Name.trim()}:${p2Name.trim()}`;
  }

  private displayName(player: Player): string {
    if (player.level) return t('aiName', { level: t(player.level) });
    return player.name || t(player === this.match.players[0] ? 'player1' : 'player2');
  }

  private createColumns(): HTMLButtonElement[] {
    for (let col = 0; col < COLS; col++) {
      const cells: HTMLElement[] = [];
      for (let row = ROWS - 1; row >= 0; row--) {
        const cell = h('span', { class: 'cell' });
        this.cells[row * COLS + col] = cell;
        cells.push(cell);
      }
      const column = h(
        'button',
        {
          type: 'button',
          class: 'board__column',
          onclick: () => this.onColumnClick(col),
          onpointerenter: (event: PointerEvent) => {
            if (event.pointerType === 'mouse') this.setHover(col);
          },
          onpointerleave: () => this.clearHover(col),
          onfocus: () => {
            if (column.matches(':focus-visible')) this.setHover(col);
          },
          onblur: () => this.clearHover(col),
        },
        ...cells,
      );
      this.columns.push(column);
    }
    return this.columns;
  }

  private setHover(col: number): void {
    this.hoverCol = col;
    this.updateBoard();
  }

  private clearHover(col: number): void {
    if (this.hoverCol !== col) return;
    this.hoverCol = null;
    this.updateBoard();
  }

  private canHumanPlay(): boolean {
    return !this.match.isOver && !this.aiThinking && !this.match.currentPlayer.level;
  }

  private onColumnClick(col: number): void {
    if (this.canHumanPlay()) this.applyMove(col);
  }

  private applyMove(col: number): void {
    if (!this.match.play(col)) return;
    playDrop();
    if (this.match.isOver) this.finishMatch();
    this.update();
    void this.playAiTurnIfNeeded();
  }

  private async playAiTurnIfNeeded(): Promise<void> {
    const player = this.match.currentPlayer;
    if (this.match.isOver || !player.level) return;

    const turnId = ++this.turnId;
    this.aiThinking = true;
    this.update();

    let col: number;
    try {
      [col] = await Promise.all([
        this.ai.chooseMove(this.match.board, player.disc, player.level),
        wait(AI_MIN_THINK_MS),
      ]);
    } catch (error) {
      if (error instanceof AiCancelledError) return;
      throw error;
    }
    if (this.destroyed || turnId !== this.turnId) return; // the game changed meanwhile

    this.aiThinking = false;
    this.applyMove(col);
  }

  private finishMatch(): void {
    const { status, players } = this.match;
    const result: Result =
      status.kind === 'won' ? (status.winner === players[0] ? 'p1' : 'p2') : 'draw';
    this.score = this.scoreboard.record(result);
    this.hoverCol = null;
    this.dialogTimer = window.setTimeout(() => this.showEndDialog(), END_DIALOG_DELAY_MS);
  }

  private newMatch(): void {
    this.turnId++;
    if (this.aiThinking) this.ai.cancel();
    this.aiThinking = false;
    clearTimeout(this.dialogTimer);
    if (this.dialog.open) this.dialog.close();
    this.match = new Match(this.createPlayers());
    this.update();
    void this.playAiTurnIfNeeded();
  }

  private resetScores(): void {
    this.score = this.scoreboard.reset();
    this.update();
  }

  private statusMessage(): string {
    const { status, currentPlayer } = this.match;
    if (status.kind === 'won') return t('winnerStatus', { name: this.displayName(status.winner) });
    if (status.kind === 'draw') return t('drawStatus');
    const name = this.displayName(currentPlayer);
    return this.aiThinking ? t('aiThinking', { name }) : t('turn', { name });
  }

  private updateBoard(): void {
    const { board, status } = this.match;
    const winning = new Set(status.kind === 'won' ? status.cells.map(([r, c]) => r * COLS + c) : []);
    const humanTurn = this.canHumanPlay();

    // Ghost disc: where the disc would land in the hovered column.
    const ghostCol = this.hoverCol;
    const ghostIndex =
      humanTurn && ghostCol !== null && board.canPlay(ghostCol)
        ? board.heights[ghostCol] * COLS + ghostCol
        : -1;

    for (let i = 0; i < ROWS * COLS; i++) {
      const cell = board.cells[i];
      const kind = cell === RED ? 'red' : cell === BLUE ? 'blue' : i === ghostIndex ? 'ghost' : 'empty';
      this.cells[i].className = `cell cell--${kind}${winning.has(i) ? ' cell--win' : ''}`;
    }
    this.columns.forEach((column, col) => {
      column.setAttribute('aria-label', t('column', { n: col + 1 }));
      column.setAttribute('aria-disabled', String(!humanTurn || !board.canPlay(col)));
    });
  }

  private showEndDialog(): void {
    if (this.destroyed) return;
    this.fillDialog();
    this.dialog.showModal();
    this.dialogAgain.focus();
  }

  private fillDialog(): void {
    const { status } = this.match;
    if (status.kind === 'won') {
      const name = this.displayName(status.winner);
      const aiWon = Boolean(status.winner.level);
      this.dialogTitle.textContent = aiWon ? t('lossTitle') : t('winTitle');
      this.dialogMessage.textContent = aiWon ? t('aiWinMessage', { name }) : t('winMessage', { name });
      this.dialog.dataset.color = colorName(status.winner.disc);
    } else {
      this.dialogTitle.textContent = t('drawTitle');
      this.dialogMessage.textContent = t('drawMessage');
      this.dialog.dataset.color = '';
    }
    this.dialogMoves.textContent = t('finishedIn', { n: this.match.moveCount });
    this.dialogQuestion.textContent = t('replayQuestion');
    this.dialogAgain.textContent = t('playAgain');
    this.dialogMenu.textContent = t('backToMenu');
  }
}
