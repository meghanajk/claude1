import script from './script.json';

export const FPS = 30;
export type CardData = {
  text: string;
  seconds: number;
  style?: 'hook' | 'teaser' | 'outro';
  count?: {from: number; to: number};
  fx?: string[];
};
export const CARDS = script.cards as CardData[];
export const cardFrames = (c: CardData) => Math.round(c.seconds * FPS);
export const TOTAL_FRAMES = CARDS.reduce((s, c) => s + cardFrames(c), 0);
