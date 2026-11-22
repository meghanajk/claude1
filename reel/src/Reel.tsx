import React from 'react';
import {fitText} from '@remotion/layout-utils';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {Card, TOTAL_FRAMES, WIDTH, timeline} from './timing';

// ---- One font: Inter Display Bold. Declared with CSS @font-face: the installed
// system font is used if present, otherwise the bundled file in public/fonts.
const FONT_NAME = 'ReelSans';
const FONT = `${FONT_NAME}, 'Inter Display', Inter, sans-serif`;
const FONT_CSS = `@font-face{font-family:${FONT_NAME};font-weight:700;src:local('Inter Display Bold'),local('InterDisplay-Bold'),url(${staticFile(
  'fonts/InterDisplay-Bold.otf',
)}) format('opentype');}`;

// ---- Style tokens ----
const WHITE = '#FFFFFF';
const GOLD = '#FFC83D';
const SIDE = 70; // safe side margin
const TEXT_W = WIDTH - SIDE * 2;
const SHADOW = '0 3px 14px rgba(0,0,0,0.55), 0 2px 2px rgba(0,0,0,0.35)';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// ---- Text tokenizer ----
// Splits "**gold** white" into words. Punctuation glued to a word (e.g. "**feet**." or
// '"how?"') stays in that word and takes its colour, so there are no stray marks.
type Token = {w: string; hl: boolean; g: number};
export const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  let glue = false; // previous segment ended without whitespace
  text.split('**').forEach((seg, si) => {
    const hl = si % 2 === 1;
    if (!seg) return;
    const parts = seg.split(/(\s+)/).filter((p) => p !== '');
    parts.forEach((p, pi) => {
      if (/^\s+$/.test(p)) {
        glue = false;
        return;
      }
      const attach = pi === 0 && glue && tokens.length > 0;
      // punctuation-only fragments always attach to the previous word
      const punctOnly = /^[.,:;!?"'”’)]+$/.test(p) && tokens.length > 0;
      if (attach || (pi === 0 && punctOnly && glue)) tokens[tokens.length - 1].w += p;
      else tokens.push({w: p, hl, g: hl ? si * 1000 : si * 1000 + pi});
      glue = true;
    });
    glue = !/\s$/.test(seg);
  });
  return tokens;
};

const groups = (tokens: Token[]): Token[][] => {
  const out: Token[][] = [];
  tokens.forEach((t, i) => {
    if (i > 0 && tokens[i - 1].g === t.g) out[out.length - 1].push(t);
    else out.push([t]);
  });
  return out;
};

// ---- Media with push-in / punch / loop zoom ----
const Media: React.FC<{card: Card; frames: number; first: boolean}> = ({card, frames, first}) => {
  const f = useCurrentFrame();
  const [fx, fy] = card.focus ?? [0.5, 0.4];
  let scale: number;
  if (card.loop) {
    // ends at exactly 1.0 so the last frame matches the hook's first frame
    scale = interpolate(f, [0, frames - 1], [1.16, 1.0], {...clamp, easing: Easing.inOut(Easing.cubic)});
  } else {
    // fast push-in: most of the move in the first ~40% of the card
    scale = interpolate(f, [0, frames], [1.0, 1.16], {...clamp, easing: Easing.out(Easing.cubic)});
    if (card.fx === 'punch') {
      scale *= interpolate(f, [0, 7], [1.3, 1.0], {...clamp, easing: easeOut});
    }
  }
  if (first) scale = interpolate(f, [0, frames], [1.0, 1.16], {...clamp, easing: Easing.out(Easing.cubic)});
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${scale})`,
    transformOrigin: `${fx * 100}% ${fy * 100}%`,
  };
  if (!card.media) return <AbsoluteFill style={{background: '#101014'}} />;
  const src = staticFile(`media/${card.media}`);
  return /\.(mp4|mov|webm)$/i.test(card.media) ? (
    <OffthreadVideo src={src} muted style={style} />
  ) : (
    <Img src={src} style={style} />
  );
};

// ---- Soft dark gradient behind the text (no blur, no boxes) ----
const Scrim: React.FC<{pos: 'top' | 'middle' | 'bottom'}> = ({pos}) => {
  const bg =
    pos === 'bottom'
      ? 'linear-gradient(0deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.6) 20%, rgba(0,0,0,0.25) 36%, rgba(0,0,0,0) 50%)'
      : pos === 'top'
        ? 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.55) 18%, rgba(0,0,0,0.2) 32%, rgba(0,0,0,0) 44%)'
        : 'linear-gradient(180deg, rgba(0,0,0,0) 42%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.6) 65%, rgba(0,0,0,0) 78%)';
  return <AbsoluteFill style={{background: bg}} />;
};

// ---- Words pop in one by one ----
const Caption: React.FC<{card: Card; frames: number; hook: boolean}> = ({card, frames, hook}) => {
  const f = useCurrentFrame();
  const pos = card.text_pos ?? 'bottom';
  const big = card.fx === 'big';
  const tokens = tokenize(card.text);

  let fontSize = hook ? 132 : 86;
  if (big) {
    const plain = tokens.map((t) => t.w).join(' ');
    fontSize = Math.min(140, fitText({text: plain, withinWidth: TEXT_W + 40, fontFamily: FONT_NAME, fontWeight: 700}).fontSize);
  }

  const start = hook ? 2 : 2; // first word within ~0.07s
  const step = hook ? 3 : 2.5; // frames between words
  const dir = pos === 'top' ? -1 : 1;
  const slide = interpolate(f, [0, 10], [44 * dir, 0], {...clamp, easing: easeOut});
  const out = card.loop ? interpolate(f, [frames - 10, frames - 2], [1, 0], clamp) : 1;

  const place: React.CSSProperties =
    pos === 'bottom'
      ? {bottom: 300}
      : pos === 'top'
        ? {top: 190}
        : {top: '60%', transform: `translateY(-50%)`};

  return (
    <AbsoluteFill style={{opacity: out}}>
      <div style={{position: 'absolute', left: SIDE, right: SIDE, ...place}}>
        <div
          style={{
            transform: `translateY(${slide}px)`,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize,
            lineHeight: 1.12,
            letterSpacing: big ? '-0.035em' : '-0.025em',
            color: WHITE,
            textAlign: 'center',
            textShadow: SHADOW,
            whiteSpace: big ? 'nowrap' : 'normal',
          }}
        >
          {groups(tokens).map((grp, gi, all) => {
            // short highlight phrases (<= 3 words, <= 14 chars) never break across lines
            const keep = grp[0].hl && grp.length <= 3 && grp.map((t) => t.w).join(' ').length <= 14;
            return (
              <React.Fragment key={gi}>
                <span style={{whiteSpace: keep ? 'nowrap' : undefined}}>
                  {grp.map((t, k) => {
                    const i = tokens.indexOf(t);
                    const ws = start + i * step;
                    const p = interpolate(f, [ws, ws + (t.hl ? 8 : 6)], [0, 1], clamp);
                    const s = t.hl
                      ? interpolate(p, [0, 0.55, 0.8, 1], [0.3, 1.22, 0.96, 1])
                      : interpolate(p, [0, 0.6, 1], [0.55, 1.08, 1]);
                    const o = interpolate(f, [ws, ws + 2], [0, 1], clamp);
                    return (
                      <React.Fragment key={k}>
                        <span
                          style={{
                            display: 'inline-block',
                            color: t.hl ? GOLD : WHITE,
                            transform: `scale(${s})`,
                            opacity: o,
                          }}
                        >
                          {t.w}
                        </span>
                        {k < grp.length - 1 ? ' ' : null}
                      </React.Fragment>
                    );
                  })}
                </span>
                {gi < all.length - 1 ? ' ' : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Flash: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 1, 7], [0.95, 0.85, 0], clamp);
  return <AbsoluteFill style={{background: '#FFFFFF', opacity: o}} />;
};

const CardScene: React.FC<{card: Card; index: number; frames: number}> = ({card, index, frames}) => {
  const pos = card.text_pos ?? 'bottom';
  return (
    <AbsoluteFill>
      <Media card={card} frames={frames} first={index === 0} />
      <Scrim pos={pos} />
      <Caption card={card} frames={frames} hook={index === 0} />
      {card.fx === 'flash' || card.fx === 'big' ? <Flash /> : null}
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC = () => {
  const f = useCurrentFrame();
  const w = interpolate(f, [0, TOTAL_FRAMES - 1], [0, 100], clamp);
  return (
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: 'rgba(255,255,255,0.22)'}}>
      <div style={{width: `${w}%`, height: '100%', background: GOLD}} />
    </div>
  );
};

export const Reel: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <style>{FONT_CSS}</style>
    {timeline.map(({card, index, from, frames}) => (
      <Sequence key={index} from={from} durationInFrames={frames}>
        <CardScene card={card} index={index} frames={frames} />
      </Sequence>
    ))}
    <ProgressBar />
  </AbsoluteFill>
);
