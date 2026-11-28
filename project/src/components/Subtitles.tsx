import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_UI, FPS, clamp, easeBack} from '../lib/anim';
import {Caption} from '../lib/timeline';

const WORD_COLORS: Record<string, string> = {white: '#ffffff', yellow: COLORS.yellow, red: '#ff4655'};

/**
 * Word-synchronised captions.
 * - The phrase pops in subtly, words light up exactly when they are spoken.
 * - Key words are coloured yellow / red (set in scripts/narration.json -> highlights).
 * variant 'landscape': bottom safe area, max two lines. variant 'vertical': large, centre-low.
 */
export const Subtitles: React.FC<{captions: Caption[]; variant?: 'landscape' | 'vertical'; bottom?: number; hidden?: (t: number) => boolean}> = ({captions, variant = 'landscape', bottom, hidden}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const t = frame / FPS;
  const cap = captions.find((c) => t >= c.start - 0.04 && t < c.end);
  if (!cap || (hidden && hidden(t))) return null;
  const v = variant === 'vertical';
  const appear = clamp((t - (cap.start - 0.04)) / 0.16);
  const s = 0.86 + 0.14 * easeBack(appear);
  const size = v ? 86 : 54;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: bottom ?? (v ? height * 0.24 : 64), display: 'flex', justifyContent: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          maxWidth: v ? 940 : 1500, textAlign: 'center', transform: `scale(${s})`, opacity: appear,
          padding: v ? '10px 22px' : '12px 30px', borderRadius: 18,
          background: v ? 'transparent' : 'rgba(0,0,0,0.5)',
          fontFamily: FONT_UI, fontWeight: 900, fontSize: size, lineHeight: 1.18,
          textTransform: v ? 'uppercase' : 'none', letterSpacing: v ? 1 : 0.5,
        }}
      >
        {cap.words.map((w, i) => {
          const spoken = t >= w.start - 0.02;
          const active = t >= w.start - 0.02 && t < w.end + 0.05;
          const wp = clamp((t - w.start + 0.02) / 0.12);
          const col = WORD_COLORS[w.color] ?? '#fff';
          const scale = active ? 1 + 0.08 * easeBack(wp) : 1;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block', margin: v ? '0 16px' : '0 11px',
                color: spoken ? col : 'rgba(255,255,255,0.55)',
                transform: `scale(${v && active ? 1.12 * (0.9 + 0.1 * wp) : scale}) translateY(${v ? (1 - wp) * 8 * (spoken ? 1 : 0) : 0}px)`,
                WebkitTextStroke: v ? '14px #000' : '8px #000', paintOrder: 'stroke fill',
                textShadow: v ? '0 8px 0 rgba(0,0,0,0.7), 0 0 30px rgba(0,0,0,0.6)' : '0 4px 10px rgba(0,0,0,0.8)',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
