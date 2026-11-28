import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, FPS, pop, prog} from '../lib/anim';
import {Timeline, TimelineProvider} from '../lib/timeline';
import {FilmLook, Flash} from '../components/Atmosphere';
import {Subtitles} from '../components/Subtitles';
import {Emblem, SubscribePill} from '../components/Brand';

/** Shared vertical (9:16) wrapper: branding header, progress bar, big captions, subscribe reminder, audio. */
export const ShortFrame: React.FC<{tl: Timeline; audio: string; title: string; accent?: string; children: React.ReactNode; withAudio?: boolean}> = ({tl, audio, title, accent = COLORS.red, children, withAudio = true}) => {
  const frame = useCurrentFrame();
  const total = tl.durationInFrames;
  const lastLine = tl.lines[tl.lineOrder[tl.lineOrder.length - 1]];
  const subAt = Math.round(lastLine.start * FPS) - 10;
  const head = pop(frame, 2, 12);
  return (
    <AbsoluteFill style={{background: COLORS.bg, overflow: 'hidden'}}>
      <TimelineProvider tl={tl} offset={0}>{children}</TimelineProvider>
      {/* header */}
      <div style={{position: 'absolute', top: 70, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${head})`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <Emblem size={64} glow={false} />
          <div style={{fontFamily: FONT_TITLE, fontSize: 52, letterSpacing: 4}}>
            <span style={{color: COLORS.white}}>FACT</span><span style={{color: COLORS.red}}>MAN</span>
          </div>
        </div>
        <div style={{marginTop: 14, padding: '10px 26px', borderRadius: 30, background: 'rgba(8,10,14,0.8)', border: `3px solid ${accent}`, fontFamily: FONT_UI, fontWeight: 900, fontSize: 32, letterSpacing: 3, color: COLORS.white}}>
          {title}
        </div>
      </div>
      {/* progress bar */}
      <div style={{position: 'absolute', top: 0, left: 0, height: 10, width: `${(frame / total) * 100}%`, background: accent, boxShadow: `0 0 18px ${accent}`}} />
      <Subtitles captions={tl.captions} variant="vertical" bottom={420} />
      <SubscribePill at={subAt} x="50%" y="80%" scale={1.25} />
      <Flash at={0} dur={6} max={0.8} />
      <FilmLook vignette={0.7} grain={0.3} />
      {withAudio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};

/** Big statement used at the end of a short. */
export const EndStatement: React.FC<{at: number; lines: {text: string; color?: string}[]; y?: string; size?: number}> = ({at, lines, y = '38%', size = 120}) => {
  const frame = useCurrentFrame();
  if (frame < at - 2) return null;
  return (
    <AbsoluteFill style={{background: `rgba(4,5,8,${0.86 * prog(frame, at - 4, 8)})`}}>
      <div style={{position: 'absolute', top: y, width: '100%', textAlign: 'center', transform: 'translateY(-50%)'}}>
        {lines.map((l, i) => {
          const s = pop(frame, at + i * 6, 10);
          return (
            <div key={i} style={{fontFamily: FONT_TITLE, fontSize: size, lineHeight: 1.08, letterSpacing: 4, color: l.color ?? COLORS.white, transform: `scale(${s})`, opacity: Math.min(1, s * 2), textShadow: `0 0 36px ${(l.color ?? COLORS.white)}66, 0 6px 0 rgba(0,0,0,0.6)`}}>
              {l.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
