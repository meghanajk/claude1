// Parses a script line. Words wrapped in **double asterisks** are highlights.
// Each whitespace-separated token is kept together (no line break inside it) and
// split into segments, so "**13**," renders "13" highlighted and "," plain.
export type Segment = {text: string; highlight: boolean};
export type Token = {segments: Segment[]; spaceHighlighted: boolean};

export const parseCard = (text: string): Token[] => {
  let on = false;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const segments: Segment[] = [];
      raw.split('**').forEach((part, i) => {
        if (i > 0) on = !on;
        if (part) segments.push({text: part, highlight: on});
      });
      // still inside a highlight after this word -> the following space is part of it
      return {segments, spaceHighlighted: on};
    });
};

// Groups tokens that should never be split across lines:
// short highlight phrases (<= 3 words and <= 16 characters, so they always fit one line) and a one-letter word ("a") with the next word of the same highlight.
export const groupTokens = (tokens: Token[]): number[][] => {
  const textOf = (t: Token) => t.segments.map((s) => s.text).join('');
  const shortRun: boolean[] = [];
  for (let i = 0; i < tokens.length; ) {
    let j = i;
    while (j < tokens.length - 1 && tokens[j].spaceHighlighted) j++;
    const chars = tokens.slice(i, j + 1).map(textOf).join(' ').length;
    for (let k = i; k <= j; k++) shortRun.push(j - i + 1 <= 3 && chars <= 16);
    i = j + 1;
  }
  const groups: number[][] = [];
  tokens.forEach((tok, i) => {
    const prev = tokens[i - 1];
    const glue =
      prev &&
      prev.spaceHighlighted && (shortRun[i] || textOf(prev).length === 1);
    if (glue) groups[groups.length - 1].push(i);
    else groups.push([i]);
  });
  return groups;
};
