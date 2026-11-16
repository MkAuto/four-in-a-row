import { load, save } from './storage.ts';

export type Lang = 'en' | 'fr';

const NBSP = ' '; // French puts a non-breaking space before ? ! :

const en = {
  onePlayer: '1 Player',
  twoPlayers: '2 Players',
  chooseDifficulty: 'Choose a difficulty',
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  player1Name: 'Player 1 name',
  player2Name: 'Player 2 name',
  player1: 'Player 1',
  player2: 'Player 2',
  aiName: 'AI ({level})',
  opponent: 'Opponent',
  player1Color: 'Player 1 color',
  red: 'Red',
  blue: 'Blue',
  redStarts: 'Red always plays first.',
  play: 'Play',
  back: 'Back',
  turn: "{name}'s turn",
  aiThinking: '{name} is thinking...',
  moves: 'Moves: {n}',
  draws: 'Draws',
  resetScores: 'Reset scores',
  menu: 'Menu',
  playAgain: 'Play again',
  board: 'Game board',
  column: 'Column {n}',
  winTitle: 'Victory!',
  lossTitle: 'Defeat!',
  winMessage: 'Congratulations {name}! You won the game!',
  aiWinMessage: '{name} wins this time!',
  drawTitle: 'Draw',
  drawMessage: 'No winner: the board is full.',
  finishedIn: 'Game finished in {n} moves.',
  replayQuestion: 'Play again?',
  backToMenu: 'Back to menu',
  winnerStatus: '{name} wins!',
  drawStatus: 'Draw!',
  switchLanguage: 'Passer en français',
  soundOn: 'Sound on (click to mute)',
  soundOff: 'Sound off (click to unmute)',
};

export type MessageKey = keyof typeof en;

const fr: Record<MessageKey, string> = {
  onePlayer: '1 joueur',
  twoPlayers: '2 joueurs',
  chooseDifficulty: 'Choisis la difficulté',
  easy: 'Facile',
  normal: 'Normal',
  hard: 'Difficile',
  player1Name: 'Nom du joueur 1',
  player2Name: 'Nom du joueur 2',
  player1: 'Joueur 1',
  player2: 'Joueur 2',
  aiName: 'IA ({level})',
  opponent: 'Adversaire',
  player1Color: 'Couleur du joueur 1',
  red: 'Rouge',
  blue: 'Bleu',
  redStarts: 'Le rouge joue toujours en premier.',
  play: 'Jouer',
  back: 'Retour',
  turn: 'À {name} de jouer',
  aiThinking: '{name} réfléchit...',
  moves: `Coups${NBSP}: {n}`,
  draws: 'Nuls',
  resetScores: 'Remise à 0',
  menu: 'Menu',
  playAgain: 'Rejouer',
  board: 'Plateau de jeu',
  column: 'Colonne {n}',
  winTitle: `Victoire${NBSP}!`,
  lossTitle: `Défaite${NBSP}!`,
  winMessage: `Félicitations {name}${NBSP}! Tu as gagné la partie${NBSP}!`,
  aiWinMessage: `{name} gagne cette fois-ci${NBSP}!`,
  drawTitle: 'Match nul',
  drawMessage: `Aucun vainqueur${NBSP}: le plateau est plein.`,
  finishedIn: `Partie terminée en {n} coups.`,
  replayQuestion: `Rejouer${NBSP}?`,
  backToMenu: 'Retour au menu',
  winnerStatus: `{name} gagne${NBSP}!`,
  drawStatus: `Match nul${NBSP}!`,
  switchLanguage: 'Switch to English',
  soundOn: 'Son activé (cliquer pour couper)',
  soundOff: 'Son coupé (cliquer pour activer)',
};

const messages: Record<Lang, Record<MessageKey, string>> = { en, fr };

function detectLanguage(): Lang {
  const saved = load<string | null>('lang', null);
  if (saved === 'en' || saved === 'fr') return saved;
  return globalThis.navigator?.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let current: Lang = detectLanguage();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  save('lang', lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  for (const listener of listeners) listener();
}

export function onLangChange(listener: () => void): void {
  listeners.add(listener);
}

/** Translates a message, replacing `{placeholders}` with `params`. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[current][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
