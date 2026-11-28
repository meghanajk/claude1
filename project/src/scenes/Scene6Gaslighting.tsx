import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, lerp, map, pop, prog, shakeAt, wiggle} from '../lib/anim';
import {useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, Flash, GlitchBurst, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose} from '../components/Stickman';
import {Icon, Meter, SpeechBubble, ThoughtBubble} from '../components/Props';
import {ChapterCard, GlitchText, Tag} from '../components/Typography';

const FLOOR = 860;

/** Victorian gas lamp with a flickering flame. */
export const GasLamp: React.FC<{x: number; y: number; scale?: number; frame: number; level?: number}> = ({x, y, scale = 1, frame, level = 1}) => {
  const fl = 0.75 + 0.25 * Math.sin(frame * 0.9) * Math.sin(frame * 0.37 + 1) + (random(`fl${frame}`) - 0.5) * 0.25;
  const L = level * fl;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx={0} cy={-40} r={260} fill="#ffb347" opacity={0.08 * L} />
      <circle cx={0} cy={-40} r={130} fill="#ffb347" opacity={0.12 * L} />
      <rect x={-10} y={30} width={20} height={520} fill="#1d2027" />
      <path d="M -60 -100 L 60 -100 L 44 30 L -44 30 Z" fill="rgba(255,200,120,0.12)" stroke="#2f3440" strokeWidth={8} />
      <path d="M -74 -100 L 74 -100 L 0 -150 Z" fill="#2f3440" />
      <path d={`M 0 ${-60 - 30 * L} C 18 -40 14 -10 0 0 C -14 -10 -18 -40 0 ${-60 - 30 * L}`} fill="#ffcf73" opacity={0.6 + 0.4 * L} />
      <path d={`M 0 ${-40 - 14 * L} C 8 -30 6 -12 0 -6 C -6 -12 -8 -30 0 ${-40 - 14 * L}`} fill="#fff6d8" />
      <rect x={-34} y={540} width={68} height={16} rx={6} fill="#1d2027" />
    </g>
  );
};

export const Scene6Gaslighting: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const gasTitle = B('gasTitle');
  const convo = L('g3');
  const erase = B('erase');
  const rewrite = B('rewrite');
  const wrongMem = B('wrongMem');
  const qm = B('questionMarks');
  const versions = B('versions');
  const mirrorAt = B('mirror');
  const crack = B('mirrorCrack');
  const calm = B('calm');
  const pattern = B('pattern');

  const lampLevel = 1 - prog(frame, gasTitle, 20) * 0.6;
  const sh = shakeAt(frame, gasTitle, 18, 10);
  const titleDim = prog(frame, gasTitle - 4, 6) * (1 - prog(frame, convo - 10, 10));

  // ---- conversation (g3-g6)
  const inConvo = frame >= convo - 8 && frame < mirrorAt + 4;
  const eraseP = prog(frame, erase, 18);
  const writeP = prog(frame, rewrite, 22);
  const bubbleText = frame < rewrite ? "I'll be there at 6." : 'I NEVER said that.';
  const bubbleClip = frame < erase ? 1 : frame < rewrite ? 1 - eraseP : writeP;
  const wrongBubble = pop(frame, L('g4'), 11);
  const memGlitch = frame >= wrongMem ? prog(frame, wrongMem, 30) : 0;
  const qmP = prog(frame, qm, 30);
  const verP = prog(frame, versions, 40);
  let heroPose = idle(POSES.stand, frame, 'g');
  if (frame >= wrongMem) heroPose = mixPose(heroPose, idle(POSES.hesitant, frame, 'g'), prog(frame, wrongMem, 12));
  if (frame >= qm) heroPose = mixPose(heroPose, idle(POSES.handsHead, frame, 'g', 0.6), prog(frame, qm, 12));
  if (frame >= versions) heroPose = mixPose(heroPose, idle(POSES.slump, frame, 'g'), prog(frame, versions + 20, 20));

  // ---- mirror (g7-g9)
  const inMirror = frame >= mirrorAt - 6 && frame < calm + 4;
  const distort = map(frame, [mirrorAt, L('g8'), crack, crack + 40], [6, 14, 26, 40]);
  const crackP = prog(frame, crack, 14, easeOut);
  const confidence = map(frame, [mirrorAt, L('g8'), crack, crack + 50], [0.92, 0.7, 0.55, 0.15]);
  const reflShrink = 1 - prog(frame, crack, 40) * 0.25;

  // ---- calm & pattern (g10-g11)
  const inCalm = frame >= calm - 6;

  return (
    <AbsoluteFill>
      <Backdrop top={inCalm ? '#0d1522' : '#120f0b'} bottom="#040404" light={inCalm ? 'rgba(56,182,255,0.16)' : `rgba(255,179,71,${0.12 * lampLevel})`} lightX={inCalm ? 50 : 50} lightY={35} floorY={FLOOR} floorColor={inCalm ? 'rgba(120,180,255,0.2)' : 'rgba(255,200,140,0.14)'} />
      <Particles count={30} seed="gas" color={inCalm ? '#9fd8ff' : '#ffcf73'} opacity={0.3} />
      <Camera shake={sh} zoom={1 + prog(frame, L('g1'), 120) * 0.12 * (frame < convo ? 1 : 0)}>
        {/* lamp intro */}
        {frame < convo + 4 && (
          <Stage>
            <GasLamp x={960} y={330} scale={1.0} frame={frame} level={lampLevel} />
          </Stage>
        )}
        {/* conversation */}
        {inConvo && (
          <AbsoluteFill style={{opacity: prog(frame, convo - 8, 8) * (1 - prog(frame, mirrorAt - 6, 8))}}>
            <Stage>
              <GasLamp x={960} y={260} scale={0.7} frame={frame} level={0.5} />
              <Stickman x={1340} y={FLOOR} scale={1.4} flip={-1} pose={idle(frame >= L('g4') ? POSES.pointUp : POSES.talk, frame, 'gm')} variant="manipulator" frame={frame} eyes="narrow" mouth={frame >= rewrite ? 'smirk' : 'smile'} />
              <Stickman x={600} y={FLOOR} scale={1.4} pose={heroPose} variant="hero" frame={frame} eyes={frame >= wrongMem ? 'wide' : 'normal'} mouth={frame >= wrongMem ? 'worried' : 'smile'} brows={frame >= wrongMem ? 'worried' : 'none'} sweat={frame >= qm ? 0.9 : 0}
                look={frame >= versions ? [0.9 * (verP > 0.5 ? 1 : -1), 0] : [0.5, 0]} />
              {/* manipulator bubble: erased and rewritten */}
              <SpeechBubble x={1360} y={270} tx={1340} ty={FLOOR - 430} text={frame < L('g4') + 4 ? bubbleText : "You're remembering\nit WRONG."} scale={pop(frame, B('bubble1'), 11)} clip={frame < L('g4') + 4 ? bubbleClip : wrongBubble}
                w={460} h={frame < L('g4') + 4 ? 100 : 140} size={38} color="#2a0b10" textColor={frame >= rewrite ? COLORS.white : '#ffd9dd'} border={COLORS.red} />
              {frame >= erase && frame < rewrite + 22 && (() => {
                const ex = frame < rewrite ? lerp(1560, 1140, eraseP) : lerp(1140, 1560, writeP);
                return <g transform={`translate(${ex} ${270 + Math.sin(frame) * 8}) rotate(-20)`}>
                  {frame < rewrite ? <rect x={-30} y={-18} width={60} height={36} rx={8} fill="#f08ea0" /> : <path d="M -6 -40 L 6 -40 L 6 20 L 0 34 L -6 20 Z" fill={COLORS.yellow} />}
                </g>;
              })()}
              {/* hero memory */}
              <ThoughtBubble x={470} y={300} tx={590} ty={FLOOR - 430} r={120} scale={pop(frame, convo + 10, 11) * (1 - prog(frame, versions - 6, 8))} stroke={memGlitch > 0 ? COLORS.red : COLORS.blue}>
                <g transform={`translate(${memGlitch > 0 ? (random(`mg${frame}`) - 0.5) * 30 * memGlitch : 0} 0)`} opacity={1 - memGlitch * 0.6} filter={memGlitch > 0.2 ? 'url(#memBlur)' : undefined}>
                  <defs><filter id="memBlur"><feGaussianBlur stdDeviation={memGlitch * 4} /></filter></defs>
                  <g transform="translate(-45 0) scale(0.8)">{Icon.clock('#333', 6)}</g>
                  <text x={40} y={14} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={46} fill="#333">6 PM</text>
                </g>
                {memGlitch > 0.3 && <text x={0} y={30} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={110} fill={COLORS.red} opacity={memGlitch}>?</text>}
              </ThoughtBubble>
              {/* question marks */}
              {qmP > 0 && new Array(9).fill(0).map((_, i) => {
                const a = (i / 9) * Math.PI * 2 + frame / 30;
                const r = 170 + 40 * Math.sin(frame / 10 + i);
                return <text key={i} x={600 + Math.cos(a) * r} y={FLOOR - 420 + Math.sin(a) * r * 0.6} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={50 + (i % 3) * 18} fill={i % 2 ? COLORS.red : COLORS.white} opacity={clamp(qmP * 9 - i) * (1 - prog(frame, versions, 10))}>?</text>;
              })}
              {/* two versions */}
              {verP > 0 && (
                <g>
                  <g transform={`translate(330 330) scale(${1 - verP * 0.45})`} opacity={1 - verP * 0.75}>
                    <rect x={-170} y={-70} width={340} height={140} rx={16} fill="#0c1a2a" stroke={COLORS.blue} strokeWidth={5} strokeDasharray={`${12 + verP * 30} 10`} />
                    <text y={-12} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={34} fill={COLORS.blue}>YOUR MEMORY</text>
                    <text y={40} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={40} fill="#cfe9ff">"6 PM"</text>
                  </g>
                  <g transform={`translate(1000 330) scale(${0.6 + verP * 0.6})`} opacity={verP}>
                    <rect x={-190} y={-75} width={380} height={150} rx={16} fill="#2a0b10" stroke={COLORS.red} strokeWidth={6} />
                    <text y={-14} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={34} fill={COLORS.red}>THEIR VERSION</text>
                    <text y={42} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={40} fill="#fff">"IT NEVER HAPPENED"</text>
                  </g>
                </g>
              )}
            </Stage>
          </AbsoluteFill>
        )}
        {/* mirror */}
        {inMirror && (
          <AbsoluteFill style={{opacity: prog(frame, mirrorAt - 6, 8) * (1 - prog(frame, calm - 6, 8))}}>
            <Stage>
              <defs>
                <filter id="warp" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency={`${0.008 + 0.002 * Math.sin(frame / 10)} 0.02`} numOctaves={2} seed={Math.floor(frame / 3)} />
                  <feDisplacementMap in="SourceGraphic" scale={distort} />
                </filter>
                <clipPath id="mirrorClip"><ellipse cx={1210} cy={520} rx={250} ry={360} /></clipPath>
                <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#3a4b60" /><stop offset="1" stopColor="#141a22" />
                </linearGradient>
              </defs>
              <ellipse cx={1210} cy={520} rx={276} ry={386} fill="#3b2f22" stroke="#8a6d45" strokeWidth={10} />
              <ellipse cx={1210} cy={520} rx={250} ry={360} fill="url(#glass)" />
              <g clipPath="url(#mirrorClip)">
                <g filter="url(#warp)" transform={`translate(1210 ${FLOOR}) scale(${reflShrink}) translate(-1210 ${-FLOOR})`}>
                  <Stickman x={1210} y={FLOOR - 30} scale={1.5} flip={-1} pose={idle(frame > crack ? POSES.slump : POSES.hesitant, frame - 8, 'refl')} variant="hero" frame={frame - 8}
                    eyes={frame > L('g8') ? 'sad' : 'normal'} mouth={frame > L('g8') ? 'frown' : 'worried'} brows="worried" opacity={0.85} />
                </g>
                <rect x={960} y={160} width={80} height={720} fill="#fff" opacity={0.06} transform={`rotate(20 1210 520) translate(${(frame % 90) * 4 - 100} 0)`} />
                {crackP > 0 && (
                  <g stroke="#e8f2ff" strokeWidth={3} fill="none" opacity={0.9}>
                    {[[-40, -180], [160, -60], [120, 200], [-150, 140], [-200, -40], [30, 300]].map(([dx, dy], i) => {
                      const k = clamp(crackP * 1.5 - i * 0.08);
                      const mx = 1250 + dx * 0.5 + (random(`ck${i}`) - 0.5) * 50, my = 470 + dy * 0.5;
                      return <path key={i} d={`M 1250 470 L ${lerp(1250, mx, k)} ${lerp(470, my, k)} L ${lerp(1250, 1250 + dx * 1.3, k)} ${lerp(470, 470 + dy * 1.3, k)}`} />;
                    })}
                  </g>
                )}
              </g>
              <Stickman x={660} y={FLOOR} scale={1.5} pose={idle(frame > crack ? POSES.slump : POSES.hesitant, frame, 'mh')} variant="hero" frame={frame} eyes={frame > crack ? 'sad' : 'wide'} mouth="worried" brows="worried" sweat={0.8} />
              <Meter x={140} y={180} w={420} value={confidence} label="CONFIDENCE" color={confidence > 0.5 ? COLORS.blue : COLORS.red} size={30} />
            </Stage>
          </AbsoluteFill>
        )}
        {/* calm: not every disagreement is gaslighting + pattern */}
        {inCalm && (
          <AbsoluteFill style={{opacity: prog(frame, calm - 6, 10)}}>
            <Stage>
              {frame < L('g11') + 6 && (
                <g opacity={1 - prog(frame, L('g11') - 6, 10)}>
                  <Stickman x={700} y={FLOOR} scale={1.3} pose={idle(POSES.shrug, frame, 'c1')} variant="hero" frame={frame} mouth="smile" eyes="happy" />
                  <Stickman x={1220} y={FLOOR} scale={1.3} flip={-1} pose={idle(POSES.talk, frame, 'c2')} variant="crowd" frame={frame} mouth="smile" />
                  <SpeechBubble x={620} y={330} tx={700} ty={FLOOR - 400} text="It was blue." scale={pop(frame, calm + 8, 11)} w={300} h={90} size={36} />
                  <SpeechBubble x={1300} y={330} tx={1220} ty={FLOOR - 400} text={'Hmm, I remember\ngreen!'} scale={pop(frame, calm + 24, 11)} w={360} h={130} size={34} />
                </g>
              )}
              {frame >= L('g11') - 6 && (
                <g opacity={prog(frame, L('g11') - 6, 10)}>
                  {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d, i) => {
                    const x = 400 + i * 280;
                    const stamp = pop(frame, pattern + Math.round(i * 0.18 * 30), 9);
                    return (
                      <g key={d}>
                        <rect x={x - 110} y={330} width={220} height={240} rx={14} fill="#121722" stroke="#3a4560" strokeWidth={4} />
                        <rect x={x - 110} y={330} width={220} height={56} rx={14} fill="#26324a" />
                        <text x={x} y={370} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={30} fill="#cfe0ff">{d}</text>
                        <g transform={`translate(${x} 480) scale(${stamp}) rotate(-8)`}>
                          <path d="M -50 -50 L 50 50 M 50 -50 L -50 50" stroke={COLORS.red} strokeWidth={18} strokeLinecap="round" />
                        </g>
                        <text x={x} y={620} textAnchor="middle" fontFamily={FONT_UI} fontWeight={800} fontSize={22} fill="#ff8a94" opacity={stamp}>{['"Never happened"', '"You\'re confused"', '"I never said that"', '"You\'re too sensitive"', '"You imagined it"'][i]}</text>
                      </g>
                    );
                  })}
                </g>
              )}
            </Stage>
          </AbsoluteFill>
        )}
      </Camera>
      <AbsoluteFill style={{background: `rgba(3,3,4,${0.8 * titleDim})`}} />
      <GlitchText text="GASLIGHTING" at={gasTitle - 2} out={convo - 10} size={220} spacing={12} pulses={[gasTitle + 20]} />
      <Tag text="ONE DISAGREEMENT ≠ GASLIGHTING" at={calm + 40} out={L('g11') - 8} x="50%" y="12%" color={COLORS.blue} size={38} />
      <Tag text="THE REPEATED PATTERN MATTERS" at={pattern + 26} x="50%" y="14%" color={COLORS.red} size={40} solid />
      <GlitchBurst at={wrongMem} />
      <Flash at={crack} dur={6} max={0.5} />
      <ChapterCard num="TRICK #4" title="MAKE YOU DOUBT YOURSELF" at={0} out={L('g1') - 4} />
      <FilmLook vignette={0.85} grain={0.35} tint={inCalm ? undefined : 'rgba(255,150,60,0.06)'} />
    </AbsoluteFill>
  );
};
