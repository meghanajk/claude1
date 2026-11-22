// Splits a script line into plain / highlighted chunks. Text between **double asterisks**
// is a highlight; spacing and punctuation are kept exactly as written.
export type Chunk = {text: string; highlight: boolean};

export const parseCard = (text: string): Chunk[] =>
  text
    .split('**')
    .map((t, i) => ({text: t, highlight: i % 2 === 1}))
    .filter((c) => c.text.length > 0);

// Short highlights are never split across two lines.
export const MAX_UNBROKEN_HIGHLIGHT = 16;
