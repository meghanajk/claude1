import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, pop, prog, wiggle} from '../lib/anim';

/** Big cinematic word: letters slam in one by one with blur and glow. */
export const ImpactText: React.FC<{
  text: string; at: number; out?: number; size?: number; color?: string; glow?: string; x?: string; y?: string;
  stagger?: number; spacing?: number; font?: string; style?: React.CSSProperties; underline?: string;
}> = ({text, at, out = 1e9, size = 170, color = COLORS.white, glow = COLORS.red, x = '50%', y = '50%', stagger = 2, spacing = 6, font = FONT_TITLE, style, underline}) => {
  const frame = useCurrentFrame();
  if (frame < at - 1 || frame > out + 12) return null;
  const fadeOut = 1 - prog(frame, out, 10);
  const letters = text.split('');
  const ul = prog(frame, at + letters.length * stagger, 14, easeOut);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', opacity: fadeOut, textAlign: 'center', ...style}}>
      <div style={{fontFamily: font, fontSize: size, letterSpacing: spacing, color, lineHeight: 1, textShadow: `0 0 30px ${glow}, 0 0 80px ${glow}66, 0 6px 0 rgba(0,0,0,0.6)`}}>
        {letters.map((ch, i) => {
          const s = at + i * stagger;
          const p = clamp((frame - s) / 7);
          const sc = 1 + (1 - easeOut(p)) * 1.6;
          return (
            <span key={i} style={{display: 'inline-block', opacity: p, transform: `scale(${sc})`, filter: `blur(${(1 - p) * 10}px)`, minWidth: ch === ' ' ? size * 0.25 : undefined}}>
              {ch}
            </span>
          );
        })}
      </div>
      {underline && <div style={{height: Math.max(6, size * 0.05), background: underline, width: `${ul * 100}%`, margin: `${size * 0.08}px auto 0`, boxShadow: `0 0 20px ${underline}`}} />}
    </div>
  );
};

/** Text with RGB split and slice jitter. Glitches harder in the first frames and on `pulses`. */
export const GlitchText: React.FC<{
  text: string; at: number; out?: number; size?: number; color?: string; x?: string; y?: string; font?: string; pulses?: number[]; spacing?: number; maxWidth?: number;
}> = ({text, at, out = 1e9, size = 120, color = COLORS.white, x = '50%', y = '50%', font = FONT_TITLE, pulses = [], spacing = 4, maxWidth}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > out + 10) return null;
  const local = frame - at;
  const nearPulse = pulses.some((p) => frame >= p && frame < p + 8);
  const intensity = local < 10 ? 1 - local / 10 : nearPulse ? 0.8 : random(`gl${Math.floor(frame / 3)}`) < 0.06 ? 0.4 : 0;
  const dx = intensity * 14 * (random(`gdx${frame}`) - 0.5) * 2;
  const op = clamp(local / 4) * (1 - prog(frame, out, 10));
  const base: React.CSSProperties = {position: 'absolute', left: 0, top: 0, fontFamily: font, fontSize: size, letterSpacing: spacing, lineHeight: 1.02, whiteSpace: maxWidth ? 'normal' : 'nowrap', width: maxWidth, textAlign: 'center'};
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', opacity: op}}>
      <div style={{position: 'relative'}}>
        <div style={{...base, position: 'relative', color, textShadow: `0 0 26px rgba(255,255,255,0.25)`}}>{text}</div>
        {intensity > 0 && (
          <>
            <div style={{...base, color: COLORS.red, transform: `translate(${dx + 6 * intensity}px, ${-2 * intensity}px)`, mixBlendMode: 'screen', opacity: 0.85}}>{text}</div>
            <div style={{...base, color: COLORS.blue, transform: `translate(${-dx - 6 * intensity}px, ${2 * intensity}px)`, mixBlendMode: 'screen', opacity: 0.85}}>{text}</div>
            <div style={{...base, color, clipPath: `inset(${random(`c1${frame}`) * 70}% 0 ${random(`c2${frame}`) * 20}% 0)`, transform: `translateX(${dx * 2}px)`}}>{text}</div>
          </>
        )}
      </div>
    </div>
  );
};

/** "TRICK #1" chapter card shown during a scene lead-in. */
export const ChapterCard: React.FC<{num: string; title: string; at: number; out: number; accent?: string}> = ({num, title, at, out, accent = COLORS.red}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > out + 14) return null;
  const pIn = prog(frame, at, 14, easeOut);
  const pOut = prog(frame, out, 14);
  const bar = prog(frame, at, 10, easeOut);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - pOut, background: `rgba(5,6,8,${0.75 * (1 - pOut)})`}}>
      <div style={{transform: `translateY(${(1 - pIn) * 40}px) scale(${1 + pOut * 0.15})`, textAlign: 'center'}}>
        <div style={{fontFamily: FONT_UI, fontWeight: 800, fontSize: 40, letterSpacing: 18, color: accent, opacity: pIn}}>{num}</div>
        <div style={{height: 6, width: 520 * bar, background: accent, margin: '18px auto 22px', boxShadow: `0 0 24px ${accent}`}} />
        <div style={{fontFamily: FONT_TITLE, fontSize: 108, letterSpacing: 4, color: COLORS.white, opacity: pIn, textShadow: `0 0 40px ${accent}88`, clipPath: `inset(0 ${(1 - pIn) * 100}% 0 0)`}}>{title}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Small rounded label (e.g. "1950s EXPERIMENT"). */
export const Tag: React.FC<{text: string; at: number; out?: number; x: number | string; y: number | string; color?: string; size?: number; icon?: React.ReactNode; solid?: boolean}> = ({text, at, out = 1e9, x, y, color = COLORS.blue, size = 34, icon, solid}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > out + 10) return null;
  const s = pop(frame, at);
  const o = 1 - prog(frame, out, 10);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, opacity: o}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: `${size * 0.32}px ${size * 0.7}px`, borderRadius: size, border: `3px solid ${color}`, background: solid ? color : 'rgba(8,10,14,0.82)', color: solid ? '#0b0c10' : color, fontFamily: FONT_UI, fontWeight: 800, fontSize: size, letterSpacing: 3, whiteSpace: 'nowrap', boxShadow: `0 0 28px ${color}55`}}>
        {icon}
        {text}
      </div>
    </div>
  );
};

/** Typewriter text. */
export const TypeText: React.FC<{text: string; at: number; cps?: number; style?: React.CSSProperties; out?: number}> = ({text, at, cps = 28, style, out = 1e9}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > out + 10) return null;
  const n = Math.floor(((frame - at) / 30) * cps);
  const cursor = Math.floor(frame / 8) % 2 === 0;
  return (
    <div style={{...style, opacity: 1 - prog(frame, out, 10)}}>
      {text.slice(0, n)}
      <span style={{opacity: cursor && n < text.length + 20 ? 1 : 0}}>▌</span>
    </div>
  );
};

/** Shaky text for horror/confusion moments. */
export const Shaky: React.FC<{children: React.ReactNode; amp?: number; seed?: string}> = ({children, amp = 2, seed = 's'}) => {
  const frame = useCurrentFrame();
  return <span style={{display: 'inline-block', transform: `translate(${wiggle(frame, seed + 'x', amp, 8)}px, ${wiggle(frame, seed + 'y', amp, 8)}px)`}}>{children}</span>;
};
