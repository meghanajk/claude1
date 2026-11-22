// Card timing. Keep in sync with scripts/timing.py.
export const FPS = 30;

export const wordCount = (text: string) =>
  text.replace(/\*\*/g, '').split(/\s+/).filter(Boolean).length;

export const cardSeconds = (text: string, index: number) => {
  if (index === 0) return 4.0; // hook: held longest (the 4 s maximum)
  const s = Math.max(3.0, wordCount(text) / 3 + 0.5);
  return Math.min(4.0, Math.max(2.5, s));
};

export const cardFrames = (text: string, index: number) =>
  Math.ceil(cardSeconds(text, index) * FPS);
