import dropSoundUrl from './assets/drop.wav';
import { load, save } from './storage.ts';

let enabled = load('sound', true);
let dropSound: HTMLAudioElement | null = null;

export function isSoundOn(): boolean {
  return enabled;
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  save('sound', on);
}

/** Plays the "disc dropped" sound (restarting it if it is already playing). */
export function playDrop(): void {
  if (!enabled) return;
  dropSound ??= new Audio(dropSoundUrl);
  dropSound.currentTime = 0;
  dropSound.play().catch(() => {
    // Browsers may block sound until the user interacts with the page: ignore.
  });
}
