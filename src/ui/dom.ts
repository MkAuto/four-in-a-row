type Child = Node | string | number | null | undefined | false;
type AttrValue = string | number | boolean | null | undefined;
// `never` lets handlers declare a specific event type, e.g. (e: PointerEvent) => void.
type Handler = (event: never) => void;

/**
 * Creates an element: `h('button', { class: 'btn', onclick: () => ... }, 'Play')`.
 * Attributes starting with "on" become event listeners; `false`/`null` attributes are skipped.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue | Handler> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) {
      element.setAttribute(name, '');
    } else if (value !== false && value !== null && value !== undefined) {
      element.setAttribute(name, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'number' ? String(child) : child);
  }
  return element;
}

/** The pixel-art game title. */
export function title(size: 'large' | 'small'): HTMLElement {
  // Non-breaking space: on narrow screens the title wraps as "Four in / a Row".
  return h(size === 'large' ? 'h1' : 'p', { class: `title title--${size}` }, 'Four in a\u00a0Row');
}
