import data from './data/cards.json';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
// Overlap between cards for the zoom-punch transition (frames).
export const TRANSITION = 6;
// Keep in sync with tools/prepare_media.py
const HOOK_EXTRA = 0.8;
const LAST_EXTRA = 0.6;

export type Card = {text: string; media: string; durationSec?: number};
export const cards: Card[] = (data as {cards: Card[]}).cards;

export const cardSeconds = (i: number): number => {
  const c = cards[i];
  if (c.durationSec) return c.durationSec;
  const words = c.text.replace(/\*\*/g, '').trim().split(/\s+/).length;
  let d = Math.min(4, Math.max(2.5, words / 3));
  if (i === 0) d += HOOK_EXTRA;
  if (i === cards.length - 1) d += LAST_EXTRA;
  return d;
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
