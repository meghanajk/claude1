import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, pop, prog} from '../lib/anim';

/** FACTMAN emblem: a stickman head with a question-mark spark, inside a ring. */
export const Emblem: React.FC<{size?: number; draw?: number; glow?: boolean}> = ({size = 120, draw = 1, glow = true}) => {
  const c = 2 * Math.PI * 54;
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" style={{overflow: 'visible'}}>
      {glow && <circle cx={70} cy={70} r={62} fill={COLORS.red} opacity={0.18 * draw} />}
      <circle cx={70} cy={70} r={54} fill="none" stroke={COLORS.red} strokeWidth={7} strokeDasharray={c} strokeDashoffset={c * (1 - draw)} strokeLinecap="round" transform="rotate(-90 70 70)" />
      <g opacity={clamp(draw * 1.5 - 0.5)}>
        <circle cx={70} cy={55} r={18} fill={COLORS.white} stroke="#0a0a0c" strokeWidth={3} />
        <ellipse cx={64} cy={53} rx={2.6} ry={3.6} fill="#0a0a0c" />
        <ellipse cx={76} cy={53} rx={2.6} ry={3.6} fill="#0a0a0c" />
        <path d="M 70 75 L 70 102 M 70 82 L 54 96 M 70 82 L 86 96" stroke={COLORS.white} strokeWidth={6} strokeLinecap="round" fill="none" />
        <path d="M 96 26 q 8 -10 16 -2 q 6 8 -6 14 l 0 6" stroke={COLORS.blue} strokeWidth={5} fill="none" strokeLinecap="round" />
        <circle cx={106} cy={52} r={3.2} fill={COLORS.blue} />
      </g>
    </svg>
  );
};

/** Full animated logo reveal: emblem draws, wordmark slides up from a mask, light sweep. */
export const LogoReveal: React.FC<{at: number; scale?: number; tagline?: string; taglineAt?: number}> = ({at, scale = 1, tagline, taglineAt}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const draw = prog(frame, at, 22, easeOut);
  const em = pop(frame, at, 10);
  const word = prog(frame, at + 8, 16, easeOut);
  const sweep = prog(frame, at + 22, 26);
  const tag = taglineAt !== undefined ? prog(frame, taglineAt, 16, easeOut) : 0;
  return (
    <div style={{position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${scale})`, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 34}}>
        <div style={{transform: `scale(${em})`}}><Emblem size={190} draw={draw} /></div>
        <div style={{overflow: 'hidden', position: 'relative', padding: '0 8px'}}>
          <div style={{fontFamily: FONT_TITLE, fontSize: 210, letterSpacing: 10, lineHeight: 1.05, transform: `translateY(${(1 - word) * 110}%)`}}>
            <span style={{color: COLORS.white}}>FACT</span>
            <span style={{color: COLORS.red, textShadow: `0 0 40px ${COLORS.red}88`}}>MAN</span>
          </div>
          <div style={{position: 'absolute', top: 0, bottom: 0, width: 120, left: `${-30 + sweep * 140}%`, opacity: sweep > 0 && sweep < 1 ? 1 : 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', transform: 'skewX(-20deg)', mixBlendMode: 'overlay'}} />
        </div>
      </div>
      <div style={{height: 6, width: 760 * word, background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.red})`, marginTop: 6, boxShadow: `0 0 24px ${COLORS.blue}`}} />
      {tagline && (
        <div style={{marginTop: 34, whiteSpace: 'nowrap', fontFamily: FONT_UI, fontWeight: 800, fontSize: 46, letterSpacing: 12, color: COLORS.white, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)`}}>
          {tagline}
        </div>
      )}
    </div>
  );
};

/** Small corner watermark. */
export const Bug: React.FC<{opacity?: number; top?: number; right?: number; size?: number}> = ({opacity = 0.7, top = 36, right = 44, size = 1}) => (
  <div style={{position: 'absolute', top, right, display: 'flex', alignItems: 'center', gap: 10 * size, opacity, transform: `scale(${size})`, transformOrigin: 'top right'}}>
    <Emblem size={52} glow={false} />
    <div style={{fontFamily: FONT_TITLE, fontSize: 40, letterSpacing: 3}}>
      <span style={{color: COLORS.white}}>FACT</span>
      <span style={{color: COLORS.red}}>MAN</span>
    </div>
  </div>
);

/** Subscribe / follow reminder pill with a pulsing bell. */
export const SubscribePill: React.FC<{at: number; out?: number; x?: string; y?: string; scale?: number}> = ({at, out = 1e9, x = '50%', y = '90%', scale = 1}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > out + 12) return null;
  const s = pop(frame, at, 10);
  const o = 1 - prog(frame, out, 12);
  const ring = Math.sin((frame - at) / 3) * 12 * Math.exp(-(frame - at) / 40);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s * scale})`, opacity: o}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, background: COLORS.red, padding: '16px 34px', borderRadius: 50, boxShadow: `0 0 40px ${COLORS.red}88`}}>
        <svg width={40} height={40} viewBox="0 0 40 40" style={{transform: `rotate(${ring}deg)`}}>
          <path d="M20 4 C 12 4 9 10 9 17 L 9 25 L 5 30 L 35 30 L 31 25 L 31 17 C 31 10 28 4 20 4 Z" fill="#fff" />
          <circle cx={20} cy={34} r={4} fill="#fff" />
        </svg>
        <span style={{fontFamily: FONT_UI, fontWeight: 900, fontSize: 40, color: '#fff', letterSpacing: 3}}>SUBSCRIBE</span>
      </div>
    </div>
  );
};
