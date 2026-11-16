import { BLUE, RED, type Disc } from '../game/board.ts';
import { LEVEL_NAMES, type Level } from '../ai/levels.ts';
import { t } from '../i18n.ts';
import { h, title } from './dom.ts';

export type MenuStep = 'mode' | 'difficulty' | 'setup';
export type Mode = 'solo' | 'versus';

/** What the player picked in the menu (kept while the page is open). */
export interface MenuChoices {
  mode: Mode;
  level: Level;
  p1Name: string;
  p2Name: string;
  p1Disc: Disc;
}

export interface MenuActions {
  goTo(step: MenuStep): void;
  start(): void;
}

const NAME_MAX_LENGTH = 12;

export function renderMenu(
  step: MenuStep,
  choices: MenuChoices,
  actions: MenuActions,
): HTMLElement {
  const panel =
    step === 'mode'
      ? modeStep(choices, actions)
      : step === 'difficulty'
        ? difficultyStep(choices, actions)
        : setupStep(choices, actions);
  return h('section', { class: 'menu' }, title('large'), panel);
}

function modeStep(choices: MenuChoices, actions: MenuActions): HTMLElement {
  return h(
    'div',
    { class: 'panel stack' },
    h('button', {
      class: 'btn',
      autofocus: true,
      onclick: () => {
        choices.mode = 'solo';
        actions.goTo('difficulty');
      },
    }, t('onePlayer')),
    h('button', {
      class: 'btn',
      onclick: () => {
        choices.mode = 'versus';
        actions.goTo('setup');
      },
    }, t('twoPlayers')),
  );
}

function difficultyStep(choices: MenuChoices, actions: MenuActions): HTMLElement {
  return h(
    'div',
    { class: 'panel stack' },
    h('h2', { class: 'panel__title' }, t('chooseDifficulty')),
    ...LEVEL_NAMES.map((level, i) =>
      h('button', {
        class: 'btn',
        autofocus: i === 0,
        onclick: () => {
          choices.level = level;
          actions.goTo('setup');
        },
      }, t(level)),
    ),
    h('button', { class: 'btn btn--secondary', onclick: () => actions.goTo('mode') }, t('back')),
  );
}

function setupStep(choices: MenuChoices, actions: MenuActions): HTMLElement {
  const solo = choices.mode === 'solo';

  const p1Label = h('label', { for: 'p1-name', class: 'field__label' }, t('player1Name'));
  const p1Input = h('input', {
    id: 'p1-name',
    class: 'input',
    maxlength: NAME_MAX_LENGTH,
    placeholder: t('player1'),
    autocomplete: 'off',
    oninput: () => (choices.p1Name = p1Input.value),
  });
  p1Input.value = choices.p1Name;

  const p2Label = h('label', { for: 'p2-name', class: 'field__label' }, solo ? t('opponent') : t('player2Name'));
  const p2Input = h('input', {
    id: 'p2-name',
    class: 'input',
    maxlength: NAME_MAX_LENGTH,
    placeholder: t('player2'),
    autocomplete: 'off',
    disabled: solo,
    oninput: () => (choices.p2Name = p2Input.value),
  });
  p2Input.value = solo ? t('aiName', { level: t(choices.level) }) : choices.p2Name;

  const colorButtons = ([RED, BLUE] as const).map((disc) =>
    h('button', {
      type: 'button',
      class: `token-choice token-choice--${disc === RED ? 'red' : 'blue'}`,
      'aria-label': t(disc === RED ? 'red' : 'blue'),
      onclick: () => {
        choices.p1Disc = disc;
        showColors();
      },
    }),
  );

  // Name labels take each player's color, like in the original game.
  function showColors(): void {
    const p2Disc = choices.p1Disc === RED ? BLUE : RED;
    p1Label.dataset.color = choices.p1Disc === RED ? 'red' : 'blue';
    p2Label.dataset.color = p2Disc === RED ? 'red' : 'blue';
    colorButtons.forEach((button, i) =>
      button.setAttribute('aria-pressed', String((i === 0 ? RED : BLUE) === choices.p1Disc)),
    );
  }
  showColors();

  const form = h(
    'form',
    {
      class: 'panel stack',
      onsubmit: (event: SubmitEvent) => {
        event.preventDefault();
        actions.start();
      },
    },
    h('div', { class: 'field' }, p1Label, p1Input),
    h('div', { class: 'field' }, p2Label, p2Input),
    h(
      'fieldset',
      { class: 'field color-picker' },
      h('legend', { class: 'field__label' }, t('player1Color')),
      h('div', { class: 'color-picker__options' }, ...colorButtons),
      h('p', { class: 'hint' }, t('redStarts')),
    ),
    h('button', { type: 'submit', class: 'btn' }, t('play')),
    h('button', {
      type: 'button',
      class: 'btn btn--secondary',
      onclick: () => actions.goTo(solo ? 'difficulty' : 'mode'),
    }, t('back')),
  );
  return form;
}
