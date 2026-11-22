import data from './data/cards.json';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
// Keep in sync with tools/prepare_media.py
const HOOK_SEC = 2.5;
const LAST_SEC = 2.2;

export type Card = {
  text: string;
  media: string;
  text_pos?: 'top' | 'middle' | 'bottom';
  focus?: [number, number];
  fx?: 'punch' | 'flash' | 'big';
  loop?: boolean;
  durationSec?: number;
};
export const cards: Card[] = (data as unknown as {cards: Card[]}).cards;

export const cardSeconds = (i: number): number => {
  const c = cards[i];
  if (c.durationSec) return c.durationSec;
  if (i === 0) return HOOK_SEC;
  if (i === cards.length - 1) return LAST_SEC;
  const words = c.text.replace(/\*\*/g, '').trim().split(/\s+/).length;
  return Math.round(Math.min(2.2, Math.max(1.5, 1.2 + 0.12 * words)) * 100) / 100;
};

export const timeline = (() => {
  let from = 0;
  return cards.map((card, i) => {
    const frames = Math.round(cardSeconds(i) * FPS);
    const item = {card, index: i, from, frames};
    from += frames;
    return item;
  });
})();

export const TOTAL_FRAMES = timeline.reduce((a, t) => a + t.frames, 0);
