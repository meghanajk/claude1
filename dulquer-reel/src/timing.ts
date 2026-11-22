import script from "./data/script.json";

export type ScriptData = typeof script;

export const wordCount = (text: string) =>
  text.replace(/\*\*/g, "").trim().split(/\s+/).length;

// Must match card_seconds() in scripts/process_media.py
export const cardFrames = (index: number, text: string, data: ScriptData = script) => {
  const t = data.timing;
  const seconds =
    index === 0
      ? t.hookSeconds
      : Math.max(t.minSeconds, Math.min(t.maxSeconds, wordCount(text) * t.secondsPerWord));
  return Math.round(seconds * data.fps);
};

export const totalFrames = (data: ScriptData = script) =>
  data.cards.reduce((sum, text, i) => sum + cardFrames(i, text, data), 0);
