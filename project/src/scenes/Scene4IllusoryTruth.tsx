import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, lerp, map, pop, prog, shakeAt} from '../lib/anim';
import {useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, GlitchBurst, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose} from '../components/Stickman';
import {Meter, Screen} from '../components/Props';
import {ChapterCard, GlitchText, ImpactText, Tag} from '../components/Typography';

const FLOOR = 880;
export const MYTH = ['WE ONLY USE', '10% OF OUR', 'BRAIN!'];

/** Content shown on a screen: 'myth' statement, 'ad', or 'fake' news post. */
export const ScreenContent: React.FC<{w: number; h: number; mode: 'myth' | 'ad' | 'fake'; frame: number; seed: number}> = ({w, h, mode, frame, seed}) => {
  const jit = random(`sc${seed}${Math.floor(frame / 4)}`) < 0.08 ? (random(`j${seed}${frame}`) - 0.5) * 16 : 0;
  if (mode === 'ad') {
    return (
      <g transform={`translate(${jit} 0)`}>
        <rect width={w} height={h} fill={COLORS.yellow} opacity={0.9} />
        <text x={w / 2} y={h * 0.45} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={h * 0.28} fill={COLORS.red}>BUY ZAPCOLA</text>
        <text x={w / 2} y={h * 0.78} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={h * 0.14} fill="#111">YOU DESERVE IT</text>
      </g>
    );
  }
  if (mode === 'fake') {
    return (
      <g transform={`translate(${jit} 0)`}>
        <rect width={w} height={h * 0.24} fill={COLORS.red} />
        <text x={w * 0.05} y={h * 0.18} fontFamily={FONT_UI} fontWeight={900} fontSize={h * 0.15} fill="#fff">SHARE THIS!!</text>
        {MYTH.map((l, i) => (
          <text key={i} x={w / 2} y={h * (0.45 + i * 0.2)} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={h * 0.17} fill="#fff">{l}</text>
        ))}
      </g>
    );
  }
  return (
    <g transform={`translate(${jit} 0)`}>
      {MYTH.map((l, i) => (
        <text key={i} x={w / 2} y={h * (0.32 + i * 0.25)} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={h * 0.2} fill={i === 1 ? COLORS.yellow : '#fff'}>{l}</text>
      ))}
    </g>
  );
};

export const Scene4IllusoryTruth: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const on1 = B('screen1');
  const skeptic = B('skeptic');
  const mult = B('multiply');
  const mult2 = B('multiply2');
  const believe = B('believe');
  const effect = B('itEffect');
  const adAt = B('adWall');
  const misAt = B('misinfo');
  const remember = L('i7');
  const off = B('powerDown');
  const neq = B('neqTruth');

  // screens: index 0 is the big main TV, then a growing wall
  const wall = new Array(36).fill(0).map((_, i) => {
    const col = i % 9, row = Math.floor(i / 9);
    const order = random(`ord${i}`);
    return {x: 30 + col * 212, y: 40 + row * 200, at: lerp(mult - 6, mult2 + 20, order), i};
  });
  const mode = (i: number): 'myth' | 'ad' | 'fake' => {
    if (frame >= misAt && (i % 2 === 0 || frame >= misAt + 12)) return 'fake';
    if (frame >= adAt && frame < misAt) return i % 3 === 0 ? 'myth' : 'ad';
    return 'myth';
  };
  const offAt = (i: number) => off + Math.floor(random(`off${i}`) * 26);

  const days = Math.floor(map(frame, [on1, mult, believe], [1, 9, 365]));
  const belief = map(frame, [skeptic, mult, believe, believe + 30, remember, remember + 20], [0.06, 0.1, 0.55, 0.78, 0.78, 0.2]);
  const hypno = prog(frame, believe - 10, 20) * (1 - prog(frame, remember, 8));
  let heroPose = idle(POSES.stand, frame, 'it');
  if (frame >= skeptic) heroPose = mixPose(heroPose, idle(POSES.crossed, frame, 'it'), prog(frame, skeptic, 10) * (1 - prog(frame, L('i4'), 30)));
  if (frame >= L('i4')) heroPose = {...heroPose, head: heroPose.head + Math.max(0, Math.sin((frame - L('i4')) / 7)) * 16 * (1 - prog(frame, remember, 8))};
  if (frame >= remember) heroPose = mixPose(heroPose, idle(POSES.think, frame, 'it'), prog(frame, remember, 10));

  const sh = shakeAt(frame, effect, 18, 10);
  const effectDim = prog(frame, effect - 4, 8) * (1 - prog(frame, E('i5') + 12, 12));
  const neqDim = prog(frame, neq - 4, 10);
  const mainScale = 1 - prog(frame, mult - 6, 20, easeOut) * 0.0;
  const camZoom = 1 + prog(frame, L('i1'), 300) * 0.05 + prog(frame, believe, 60) * 0.12 - prog(frame, remember, 30) * 0.1;

  return (
    <AbsoluteFill>
      <Backdrop top="#0b1220" bottom="#04060a" light="rgba(56,182,255,0.14)" lightX={65} lightY={40} floorY={FLOOR} />
      <Particles count={30} seed="it" color="#9fd8ff" opacity={0.3} />
      <Camera zoom={camZoom} shake={sh} originX={35} originY={65}>
        <Stage>
          {/* wall of screens */}
          {wall.map((s) => {
            const p = pop(frame, s.at, 12);
            if (p <= 0) return null;
            const o = 1 - prog(frame, offAt(s.i), 6);
            return (
              <g key={s.i} transform={`translate(${s.x + 95} ${s.y + 70}) scale(${p}) translate(${-s.x - 95} ${-s.y - 70})`} opacity={0.55 + 0.45 * o}>
                <Screen id={`w${s.i}`} x={s.x} y={s.y} w={190} h={140} frame={frame} on={o} stand={false} tint={COLORS.blue}>
                  <ScreenContent w={190} h={140} mode={mode(s.i)} frame={frame} seed={s.i} />
                </Screen>
              </g>
            );
          })}
          {/* main TV */}
          <g opacity={pop(frame, L('i1'), 12)}>
            <Screen id="main" x={980} y={300} w={640} h={400} frame={frame} on={prog(frame, on1, 6) * (1 - prog(frame, off, 6))} scale={mainScale}>
              <ScreenContent w={640} h={400} mode={mode(1)} frame={frame} seed={99} />
            </Screen>
          </g>
          {/* hero */}
          <Stickman x={560} y={FLOOR} scale={1.4} flip={1} pose={heroPose} variant="hero" frame={frame}
            eyes={hypno > 0.5 ? 'spiral' : frame >= skeptic && frame < L('i4') ? 'narrow' : frame >= remember ? 'normal' : 'normal'}
            mouth={hypno > 0.5 ? 'smile' : frame >= skeptic && frame < L('i4') ? 'smirk' : 'flat'}
            brows={frame >= skeptic && frame < L('i4') ? 'raised' : 'none'} look={[0.8, -0.2]} />
          {/* repetition beams */}
          {hypno > 0 && new Array(5).fill(0).map((_, i) => {
            const k = ((frame / 20 + i / 5) % 1);
            return <circle key={i} cx={560} cy={FLOOR - 1.4 * 290} r={40 + k * 260} fill="none" stroke={COLORS.yellow} strokeWidth={3} opacity={(1 - k) * 0.5 * hypno} />;
          })}
          <g opacity={prog(frame, skeptic, 10) * (1 - prog(frame, effect - 6, 6)) + prog(frame, E('i5') + 12, 10) * (1 - prog(frame, neq - 6, 6))}>
            <rect x={330} y={110} width={480} height={110} rx={16} fill="rgba(5,7,12,0.88)" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            <Meter x={360} y={180} w={420} value={belief} label="BELIEF" color={belief > 0.5 ? COLORS.yellow : COLORS.blue} size={30} />
          </g>
        </Stage>
      </Camera>
      <Tag text={`DAY ${days}`} at={on1} out={effect - 6} x="88%" y="9%" color={COLORS.white} size={34} />
      <Tag text={frame >= mult2 ? 'HEARD × 500' : 'HEARD × 100'} at={mult} out={effect - 6} x="88%" y="17%" color={COLORS.yellow} size={34} />
      <GlitchBurst at={mult} />
      <GlitchBurst at={mult2} dur={6} />
      <AbsoluteFill style={{background: `rgba(3,4,8,${0.85 * effectDim})`}} />
      <GlitchText text="ILLUSORY TRUTH" at={effect - 4} out={E('i5') + 10} size={170} y="44%" pulses={[B('itGlitch')]} spacing={8} />
      <GlitchText text="EFFECT" at={B('itGlitch') - 2} out={E('i5') + 10} size={170} y="62%" color={COLORS.red} pulses={[B('itGlitch')]} spacing={30} />
      <AbsoluteFill style={{background: `rgba(3,4,8,${0.8 * neqDim})`}} />
      {frame >= neq - 4 && (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <div style={{display: 'flex', gap: 50, alignItems: 'center', fontFamily: FONT_TITLE, fontSize: 150, letterSpacing: 6, transform: `scale(${pop(frame, neq - 2, 10)})`}}>
            <span style={{color: COLORS.blue, textShadow: `0 0 30px ${COLORS.blue}`}}>FAMILIAR</span>
            <span style={{color: COLORS.red, textShadow: `0 0 30px ${COLORS.red}`}}>≠</span>
            <span style={{color: COLORS.white}}>TRUE</span>
          </div>
        </AbsoluteFill>
      )}
      <ChapterCard num="TRICK #2" title="MAKE A LIE FEEL LIKE THE TRUTH" at={0} out={L('i1') - 4} />
      <FilmLook vignette={0.75} grain={0.3} />
    </AbsoluteFill>
  );
};
