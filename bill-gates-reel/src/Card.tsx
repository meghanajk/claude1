import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {parseWords} from './parse';
import {
  FONT,
  GOLD,
  HOOK_TEXT_SIZE,
  OUTRO_TEXT_SIZE,
  SIDE_MARGIN,
  TEASER_TEXT_SIZE,
  TEXT_BOTTOM,
  TEXT_SIZE,
  TEXT_START,
  WORD_STAGGER,
} from './style';
import {CardData} from './timing';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Decaying shake, used on punch cards and the teaser.
const shake = (frame: number, start: number, amp: number) => {
  const t = frame - start;
  if (t < 0 || t > 12) return {x: 0, y: 0};
  const k = amp * (1 - t / 12);
  return {x: Math.sin(t * 2.7) * k, y: Math.cos(t * 3.3) * k * 0.6};
};

const Background: React.FC<{card: CardData; index: number; media: string | null; duration: number}> = ({
  card,
  index,
  media,
  duration,
}) => {
  const frame = useCurrentFrame();
  const punch = card.fx?.includes('punch');
  const isHook = card.style === 'hook';
  const isOutro = card.style === 'outro';

  // Fast push-in on every card. The outro pulls back out to exactly where the hook starts,
  // so the last frame matches the first frame and replays loop seamlessly.
  const push = interpolate(frame, [0, duration], [0, 1], {easing: Easing.out(Easing.cubic)});
  let zoom = isOutro ? interpolate(frame, [0, duration - 1], [1.16, 1.04], {...clamp, easing: Easing.inOut(Easing.cubic)}) : 1.04 + 0.12 * push;
  if (punch) zoom += interpolate(frame, [0, 7], [0.3, 0], {...clamp, easing: Easing.out(Easing.quad)});
  // quick blur-in on each cut (not on the hook's first frame, to keep the loop clean)
  const blur = isHook ? 0 : interpolate(frame, [0, 5], [14, 0], clamp);
  const s = punch ? shake(frame, 0, 14) : {x: 0, y: 0};

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `translate(${s.x}px, ${s.y}px) scale(${zoom})`,
  };
  const isVideo = !!media && /\.(mp4|mov|webm|m4v)$/i.test(media);
  return (
    <AbsoluteFill style={{filter: blur > 0.2 ? `blur(${blur}px)` : undefined}}>
      {!media ? (
        // teaser / missing media: dark gold glow that pulses in
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 45%, rgba(255,197,26,${interpolate(frame, [0, 8, duration], [0.55, 0.28, 0.18], clamp)}) 0%, #0a0805 55%, #000 100%)`,
            transform: `scale(${zoom})`,
          }}
        />
      ) : isVideo ? (
        <OffthreadVideo src={staticFile(media)} muted style={style} />
      ) : (
        <Img src={staticFile(media)} style={style} />
      )}
    </AbsoluteFill>
  );
};

const Caption: React.FC<{card: CardData; duration: number}> = ({card, duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = parseWords(card.text);
  const isHook = card.style === 'hook';
  const isTeaser = card.style === 'teaser';
  const isOutro = card.style === 'outro';
  const fontSize = isHook ? HOOK_TEXT_SIZE : isTeaser ? TEASER_TEXT_SIZE : isOutro ? OUTRO_TEXT_SIZE : TEXT_SIZE;

  // block: quick slide up on entry (+ shake on punch/teaser); quick fade out at the end
  const enter = spring({frame: frame - TEXT_START, fps, config: {damping: 16, stiffness: 220}});
  // the outro clears its text early so the final frames show only the hook image (loop)
  const outEnd = isOutro ? duration - 8 : duration;
  const out = interpolate(frame, [outEnd - 5, outEnd], [1, 0], clamp);
  const s = card.fx?.includes('punch') || isTeaser ? shake(frame, TEXT_START, 10) : {x: 0, y: 0};

  return (
    <div
      style={{
        position: 'absolute',
        left: SIDE_MARGIN,
        right: SIDE_MARGIN,
        ...(isTeaser ? {top: 0, bottom: 0, alignItems: 'center'} : {bottom: TEXT_BOTTOM}),
        display: 'flex',
        justifyContent: 'center',
        opacity: out,
        transform: `translate(${s.x}px, ${(1 - enter) * 60 + s.y}px)`,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize,
          lineHeight: 1.12,
          letterSpacing: '-0.02em',
          color: '#fff',
          textWrap: 'balance',
          textShadow: '0 3px 6px rgba(0,0,0,0.75), 0 8px 30px rgba(0,0,0,0.55)',
        }}
      >
        {words.map((w, i) => {
          const delay = TEXT_START + i * WORD_STAGGER;
          const pop = spring({frame: frame - delay, fps, config: {damping: 11, stiffness: 260, mass: 0.6}});
          let text = w.text;
          // number counter for years
          if (card.count && text.includes(String(card.count.to))) {
            const n = Math.round(interpolate(frame, [delay, delay + 14], [card.count.from, card.count.to], {...clamp, easing: Easing.out(Easing.cubic)}));
            text = text.replace(String(card.count.to), String(n));
          }
          return (
            <React.Fragment key={i}>
              <span
                style={{
                  display: 'inline-block',
                  color: w.highlight ? GOLD : '#fff',
                  fontSize: w.highlight ? '1.08em' : '1em',
                  transform: `scale(${interpolate(pop, [0, 1], [w.highlight ? 0.3 : 0.6, 1])})`,
                  opacity: interpolate(pop, [0, 0.3], [0, 1], clamp),
                  transformOrigin: '50% 70%',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {text}
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const Card: React.FC<{card: CardData; index: number; media: string | null; duration: number}> = ({
  card,
  index,
  media,
  duration,
}) => {
  const frame = useCurrentFrame();
  const flash = card.fx?.includes('flash') ? interpolate(frame, [0, 6], [0.85, 0], clamp) : 0;
  const isTeaser = card.style === 'teaser';
  return (
    <AbsoluteFill>
      <Background card={card} index={index} media={media} duration={duration} />
      {/* soft gradient behind the lower-third text (no box) */}
      {!isTeaser && (
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)',
          }}
        />
      )}
      <Caption card={card} duration={duration} />
      {flash > 0 && <AbsoluteFill style={{background: '#fff', opacity: flash}} />}
    </AbsoluteFill>
  );
};
