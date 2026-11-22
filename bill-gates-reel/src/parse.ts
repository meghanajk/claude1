// Splits a script line into words; text between **double asterisks** is highlighted.
export type Word = {text: string; highlight: boolean};

export const parseWords = (text: string): Word[] => {
  const words: Word[] = [];
  text.split('**').forEach((chunk, i) => {
    const highlight = i % 2 === 1;
    // keep punctuation glued to the word before it ("**13**," -> "13,")
    const startsGlued = chunk.length > 0 && !/^\s/.test(chunk) && words.length > 0;
    chunk.split(/\s+/).filter(Boolean).forEach((w, k) => {
      if (k === 0 && startsGlued && /^[^\w"]+$/.test(w)) {
        words[words.length - 1].text += w; // e.g. "." or ","
        return;
      }
      words.push({text: w, highlight});
    });
  });
  return words;
};
