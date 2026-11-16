import { RED } from './game/board.ts';
import { AiPlayer } from './ai/aiPlayer.ts';
import { getLang, onLangChange, setLang, t } from './i18n.ts';
import { isSoundOn, setSoundOn } from './sound.ts';
import { h } from './ui/dom.ts';
import { GameView } from './ui/gameView.ts';
import { renderMenu, type MenuChoices, type MenuStep } from './ui/menu.ts';

/** 16x16 pixel-art speaker icon, with sound waves (on) or a cross (off). */
function speakerIcon(on: boolean): string {
  const speaker =
    '<rect x="1" y="6" width="3" height="4"/><rect x="4" y="5" width="1" height="6"/>' +
    '<rect x="5" y="4" width="1" height="8"/><rect x="6" y="3" width="1" height="10"/>' +
    '<rect x="7" y="2" width="1" height="12"/>';
  const waves =
    '<rect x="9" y="6" width="1" height="4"/><rect x="11" y="4" width="1" height="2"/>' +
    '<rect x="12" y="6" width="1" height="4"/><rect x="11" y="10" width="1" height="2"/>' +
    '<rect x="13" y="2" width="1" height="2"/><rect x="14" y="4" width="1" height="8"/>' +
    '<rect x="13" y="12" width="1" height="2"/>';
  const cross = [6, 7, 8, 9, 10]
    .map((y, i) => `<rect x="${10 + i}" y="${y}" width="1" height="1"/><rect x="${14 - i}" y="${y}" width="1" height="1"/>`)
    .join('');
  return `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${speaker}${on ? waves : cross}</svg>`;
}

/** Switches between the menu and the game screen, and owns the language/sound toggles. */
export class App {
  private readonly screen = h('main', { class: 'screen' });
  private readonly langButton = h('button', { class: 'btn btn--icon', onclick: () => this.toggleLanguage() });
  private readonly soundButton = h('button', { class: 'btn btn--icon', onclick: () => this.toggleSound() });
  private readonly ai = new AiPlayer();

  private menuStep: MenuStep = 'mode';
  private readonly choices: MenuChoices = {
    mode: 'solo',
    level: 'normal',
    p1Name: '',
    p2Name: '',
    p1Disc: RED,
  };
  private game: GameView | null = null;

  constructor(root: HTMLElement) {
    document.documentElement.lang = getLang();
    root.append(h('div', { class: 'toolbar' }, this.langButton, this.soundButton), this.screen);
    onLangChange(() => this.render());
    this.render();
  }

  private render(): void {
    this.langButton.textContent = getLang() === 'en' ? 'FR' : 'EN';
    this.langButton.setAttribute('aria-label', t('switchLanguage'));
    this.langButton.title = t('switchLanguage');
    this.soundButton.innerHTML = speakerIcon(isSoundOn());
    this.soundButton.setAttribute('aria-label', isSoundOn() ? t('soundOn') : t('soundOff'));
    this.soundButton.title = isSoundOn() ? t('soundOn') : t('soundOff');

    if (this.game) {
      this.game.update();
      return;
    }
    this.screen.replaceChildren(
      renderMenu(this.menuStep, this.choices, {
        goTo: (step) => {
          this.menuStep = step;
          this.render();
          this.screen.querySelector<HTMLElement>('[autofocus]')?.focus();
        },
        start: () => this.startGame(),
      }),
    );
  }

  private startGame(): void {
    this.game = new GameView(this.choices, this.ai, () => this.showMenu());
    this.screen.replaceChildren(this.game.element);
  }

  private showMenu(): void {
    this.game?.destroy();
    this.game = null;
    this.menuStep = 'mode';
    this.render();
  }

  private toggleLanguage(): void {
    setLang(getLang() === 'en' ? 'fr' : 'en');
  }

  private toggleSound(): void {
    setSoundOn(!isSoundOn());
    this.render();
  }
}
