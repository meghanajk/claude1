import React, {useLayoutEffect, useRef, useState} from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {MAX_UNBROKEN_HIGHLIGHT, parseCard} from './parse';
import {
  FONT,
  HIGHLIGHT,
  HIGHLIGHT_TEXT,
  HOOK_TEXT_SIZE,
  TEXT_LEFT,
  TEXT_MAX_WIDTH,
  TEXT_SIZE,
  TEXT_TOP,
  TRANSITION,
} from './style';

const TEXT_MAX_WIDTH_INNER = TEXT_MAX_WIDTH - 42;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// One card's picture: slow Ken Burns zoom, blur dissolve in from the right, blur out.
export const Media: React.FC<{
  media: string | null;
  duration: number;
  transitionIn: boolean;
  transitionOut: boolean;
}> = ({media, duration, transitionIn, transitionOut}) => {
  const frame = useCurrentFrame();
  const T = TRANSITION;
  const pIn = transitionIn ? interpolate(frame, [0, T], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)}) : 1;
  const pOut = transitionOut
    ? interpolate(frame, [duration - T, duration], [0, 1], {...clamp, easing: Easing.out(Easing.quad)})
    : 0;
  const blur = (1 - pIn) * 24 + pOut * 30;
  const zoom = interpolate(frame, [0, duration], [1.0, 1.08]) + pOut * 0.04;
  // soft wipe: the incoming picture is revealed from the right edge
  const edge = pIn * 140 - 40;
  const mask = transitionIn && pIn < 1
    ? `linear-gradient(to left, #000 ${edge}%, transparent ${edge + 40}%)`
    : undefined;

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${zoom})`,
  };
  const isVideo = !!media && /\.(mp4|mov|webm|m4v)$/i.test(media);
  return (
    <AbsoluteFill
      style={{
        filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {!media ? (
        <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 35%, #1b2433 0%, #050608 75%)'}} />
      ) : isVideo ? (
        <OffthreadVideo src={staticFile(media)} muted style={style} />
      ) : (
        <Img src={staticFile(media)} style={style} />
      )}
    </AbsoluteFill>
  );
};

// Black caption box; highlighted phrases sit on a gradient bar with black text.
// The bar is one inline span, so each wrapped line gets its own full gradient (as in the reference).
export const Caption: React.FC<{text: string; hook: boolean}> = ({text, hook}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [handle] = useState(() => delayRender('measure caption'));

  // Lines are balanced (no lone last word); then the black box is shrunk to the widest line.
  useLayoutEffect(() => {
    document.fonts.ready.then(() => {
      const el = ref.current;
      if (el) {
        const scale = el.getBoundingClientRect().width / el.offsetWidth || 1;
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = Array.from(range.getClientRects());
        if (rects.length) {
          const left = Math.min(...rects.map((r) => r.left));
          const right = Math.max(...rects.map((r) => r.right));
          setWidth(Math.ceil((right - left) / scale) + 10); // + room for the bar padding
        }
      }
      continueRender(handle);
    });
  }, [handle, text]);

  return (
    <div
      style={{
        position: 'absolute',
        left: TEXT_LEFT,
        top: TEXT_TOP,
        background: '#000',
        padding: '16px 22px 18px 20px',
      }}
    >
      <div
        ref={ref}
        style={{
          width: width ?? TEXT_MAX_WIDTH_INNER,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: hook ? HOOK_TEXT_SIZE : TEXT_SIZE,
          lineHeight: 1.16,
          letterSpacing: '-0.015em',
          wordSpacing: '0.06em',
          textWrap: 'balance',
          color: '#fff',
        }}
      >
        {parseCard(text).map((c, i) =>
          c.highlight ? (
            <span
              key={i}
              style={{
                background: HIGHLIGHT,
                color: HIGHLIGHT_TEXT,
                padding: '0.03em 0.1em 0.05em',
                borderRadius: 3,
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
                whiteSpace: c.text.trim().length <= MAX_UNBROKEN_HIGHLIGHT ? 'nowrap' : 'normal',
              }}
            >
              {c.text}
            </span>
          ) : (
            <span key={i}>{c.text}</span>
          ),
        )}
      </div>
    </div>
  );
};

// "Story: Bill Gates" pill, top right, as in the reference.
export const Badge: React.FC<{label: string; name: string}> = ({label, name}) => (
  <div
    style={{
      position: 'absolute',
      top: 52,
      right: 60,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: '#000',
      padding: '8px 10px 8px 16px',
      borderRadius: 12,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 40,
      letterSpacing: '-0.02em',
      color: '#fff',
    }}
  >
    <span>{label}</span>
    <span style={{background: HIGHLIGHT, color: HIGHLIGHT_TEXT, padding: '2px 10px 3px', borderRadius: 6}}>
      {name}
    </span>
  </div>
);
