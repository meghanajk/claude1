import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, lerp, map, pop, prog, shakeAt} from '../lib/anim';
import {TIMELINES, useTimeline} from '../lib/timeline';
import {Backdrop, Camera, Flash, GlitchBurst, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose} from '../components/Stickman';
import {Icon, Meter, SpeechBubble, ThoughtBubble} from '../components/Props';
import {GlitchText, Tag} from '../components/Typography';
import {GasLamp} from '../scenes/Scene6Gaslighting';
import {EndStatement, ShortFrame} from './ShortFrame';

const FLOOR = 1320;

const Content: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const title = B('title');
  const small = B('small');
  const quotes = [B('q1'), B('q2'), B('q3')];
  const again = B('again');
  const mirror = B('mirror');
  const crack = B('crack');
  const calm = L('d10');
  const pattern = B('pattern');
  const write = B('write');
  const trust = B('trust');
  const finalAt = L('d12');
  const endHit = B('endHit');

  const sh = shakeAt(frame, title, 18, 10);
  const titleDim = prog(frame, title - 4, 6) * (1 - prog(frame, small - 6, 8));
  const memFade = prog(frame, quotes[0], 70);
  const inConvo = frame >= small - 6 && frame < mirror + 4;
  const inMirror = frame >= mirror - 6 && frame < calm + 4;
  const inCalm = frame >= calm - 6;
  const shrink = map(frame, [quotes[0], again + 60], [1, 0.82]);
  const conf = map(frame, [mirror, crack, crack + 50], [0.8, 0.5, 0.15]);
  const crackP = prog(frame, crack, 14);

  let heroPose = idle(POSES.stand, frame, 'g3');
  if (frame >= quotes[0]) heroPose = mixPose(heroPose, idle(POSES.hesitant, frame, 'g3'), prog(frame, quotes[0], 12));
  if (frame >= again) heroPose = mixPose(heroPose, idle(POSES.handsHead, frame, 'g3', 0.6), prog(frame, again, 12));

  return (
    <AbsoluteFill>
      <Backdrop top={inCalm ? '#0d1626' : '#130f0b'} bottom="#040404" light={inCalm ? 'rgba(56,182,255,0.2)' : 'rgba(255,179,71,0.14)'} lightY={30} lightSize={90} floorY={FLOOR} floorColor={inCalm ? 'rgba(120,180,255,0.2)' : 'rgba(255,200,140,0.14)'} />
      <Particles count={35} seed="s3" color={inCalm ? '#9fd8ff' : '#ffcf73'} opacity={0.3} />
      <Camera shake={sh}>
        {/* hook: memory dissolving */}
        {frame < small + 2 && (
          <AbsoluteFill style={{opacity: 1 - prog(frame, small - 6, 8)}}>
            <Stage>
              <GasLamp x={180} y={560} scale={0.9} frame={frame} level={1 - prog(frame, title, 20) * 0.5} />
              <Stickman x={600} y={FLOOR} scale={1.5} pose={idle(POSES.think, frame, 'hk')} variant="hero" frame={frame} eyes="wide" mouth="worried" brows="worried" look={[0.3, -0.6]} />
              <ThoughtBubble x={640} y={560} tx={600} ty={FLOOR - 520} r={170} scale={pop(frame, 2, 11)} stroke={frame >= B('doubt') ? COLORS.red : COLORS.blue}>
                <g opacity={1 - prog(frame, B('doubt'), 30) * 0.8} transform={`translate(${frame >= B('doubt') ? (random(`d${frame}`) - 0.5) * 24 : 0} 0)`}>
                  <rect x={-110} y={-80} width={220} height={150} fill="#e9e4d8" />
                  <rect x={-96} y={-66} width={192} height={100} fill="#2a3340" />
                  <g transform="translate(0 30) scale(0.28)">
                    <Stickman x={-80} y={0} pose={POSES.wave} variant="hero" frame={frame} mouth="smile" />
                    <Stickman x={80} y={0} pose={POSES.wave} variant="crowd" flip={-1} frame={frame} mouth="smile" />
                  </g>
                  <text y={60} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={22} fill="#333">MY MEMORY</text>
                </g>
                {frame >= B('doubt') + 10 && <text y={40} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={140} fill={COLORS.red} opacity={prog(frame, B('doubt') + 10, 10)}>?</text>}
              </ThoughtBubble>
            </Stage>
          </AbsoluteFill>
        )}
        {/* quotes */}
        {inConvo && (
          <AbsoluteFill style={{opacity: prog(frame, small - 6, 8) * (1 - prog(frame, mirror - 6, 8))}}>
            <Stage>
              <Stickman x={800} y={FLOOR - 120} scale={1.4} flip={-1} pose={idle(frame >= quotes[2] ? POSES.pointUp : POSES.talk, frame, 'm3')} variant="manipulator" frame={frame} eyes="narrow" mouth="smirk" />
              <g transform={`translate(300 ${FLOOR}) scale(${shrink}) translate(-300 ${-FLOOR})`}>
                <Stickman x={300} y={FLOOR} scale={1.45} pose={heroPose} variant="hero" frame={frame} eyes={frame >= quotes[0] ? 'wide' : 'normal'} mouth={frame >= quotes[0] ? 'worried' : 'flat'} brows={frame >= quotes[0] ? 'worried' : 'none'} sweat={frame >= quotes[1] ? 1 : 0} />
              </g>
              {[`"I never said that."`, `"That never happened."`, `"You're remembering\nit wrong."`].map((q, i) => (
                <SpeechBubble key={i} x={600 - i * 20} y={360 + i * 175} tx={790} ty={FLOOR - 470} text={q} scale={pop(frame, quotes[i], 10)} w={600} h={i === 2 ? 140 : 100} size={40}
                  color="#2a0b10" textColor="#fff" border={COLORS.red} opacity={frame >= again ? 0.5 : 1} />
              ))}
              {frame >= again && new Array(10).fill(0).map((_, i) => {
                const a = (i / 10) * Math.PI * 2 + frame / 25;
                const r = 170 + 30 * Math.sin(frame / 9 + i);
                return <text key={i} x={300 + Math.cos(a) * r} y={FLOOR - 400 + Math.sin(a) * r * 0.7} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={56 + (i % 3) * 16} fill={i % 2 ? COLORS.red : COLORS.white} opacity={clamp((frame - again) / 3 - i)}>?</text>;
              })}
              <g opacity={prog(frame, again + 20, 12)}>
                <rect x={110} y={380} width={380} height={110} rx={16} fill="#0c1a2a" stroke={COLORS.blue} strokeWidth={4} strokeDasharray="14 10" opacity={1 - memFade * 0.7} />
                <text x={300} y={450} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={34} fill={COLORS.blue} opacity={1 - memFade * 0.7}>YOUR MEMORY?</text>
              </g>
            </Stage>
          </AbsoluteFill>
        )}
        {/* mirror */}
        {inMirror && (
          <AbsoluteFill style={{opacity: prog(frame, mirror - 6, 8) * (1 - prog(frame, calm - 6, 8))}}>
            <Stage>
              <defs>
                <filter id="warp3" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.01 0.025" numOctaves={2} seed={Math.floor(frame / 3)} />
                  <feDisplacementMap in="SourceGraphic" scale={map(frame, [mirror, crack, crack + 40], [10, 26, 44])} />
                </filter>
                <clipPath id="m3clip"><ellipse cx={540} cy={760} rx={300} ry={420} /></clipPath>
                <linearGradient id="glass3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a4b60" /><stop offset="1" stopColor="#141a22" /></linearGradient>
              </defs>
              <ellipse cx={540} cy={760} rx={328} ry={448} fill="#3b2f22" stroke="#8a6d45" strokeWidth={12} />
              <ellipse cx={540} cy={760} rx={300} ry={420} fill="url(#glass3)" />
              <g clipPath="url(#m3clip)">
                <g filter="url(#warp3)">
                  <Stickman x={540} y={1120} scale={1.6} flip={-1} pose={idle(frame >= crack ? POSES.slump : POSES.hesitant, frame - 8, 'rf')} variant="hero" frame={frame - 8} eyes="sad" mouth="frown" brows="worried" opacity={0.85} />
                </g>
                {crackP > 0 && (
                  <g stroke="#e8f2ff" strokeWidth={3.5} fill="none">
                    {[[-60, -260], [220, -80], [160, 280], [-200, 200], [-260, -60], [40, 380]].map(([dx, dy], i) => {
                      const k = clamp(crackP * 1.5 - i * 0.08);
                      return <path key={i} d={`M 580 700 L ${lerp(580, 580 + dx * 0.5 + (random(`c${i}`) - 0.5) * 60, k)} ${lerp(700, 700 + dy * 0.5, k)} L ${lerp(580, 580 + dx * 1.3, k)} ${lerp(700, 700 + dy * 1.3, k)}`} />;
                    })}
                  </g>
                )}
              </g>
              <rect x={290} y={1230} width={500} height={110} rx={16} fill="rgba(5,7,12,0.9)" />
              <Meter x={330} y={1300} w={420} value={conf} label="CONFIDENCE" color={conf > 0.5 ? COLORS.blue : COLORS.red} size={30} />
            </Stage>
          </AbsoluteFill>
        )}
        {/* calm: pattern + support */}
        {inCalm && (
          <AbsoluteFill style={{opacity: prog(frame, calm - 6, 10)}}>
            <Stage>
              {frame < write + 4 && (
                <g opacity={1 - prog(frame, write - 6, 8)}>
                  {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d, i) => {
                    const x = 140 + i * 200;
                    const st = pop(frame, pattern + Math.round(i * 0.16 * 30), 9);
                    return (
                      <g key={d}>
                        <rect x={x - 85} y={600} width={170} height={200} rx={14} fill="#121722" stroke="#3a4560" strokeWidth={4} />
                        <rect x={x - 85} y={600} width={170} height={50} rx={14} fill="#26324a" />
                        <text x={x} y={636} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={28} fill="#cfe0ff">{d}</text>
                        <g transform={`translate(${x} 730) scale(${st}) rotate(-8)`}><path d="M -42 -42 L 42 42 M 42 -42 L -42 42" stroke={COLORS.red} strokeWidth={16} strokeLinecap="round" /></g>
                      </g>
                    );
                  })}
                  <g opacity={pop(frame, calm + 4, 10) * (1 - prog(frame, pattern - 4, 8))}>
                    <Stickman x={320} y={FLOOR} scale={1.35} pose={idle(POSES.shrug, frame, 'c1')} variant="hero" frame={frame} mouth="smile" eyes="happy" />
                    <Stickman x={760} y={FLOOR} scale={1.35} flip={-1} pose={idle(POSES.talk, frame, 'c2')} variant="crowd" frame={frame} mouth="smile" />
                  </g>
                </g>
              )}
              {frame >= write - 6 && (
                <g opacity={prog(frame, write - 6, 8)}>
                  <g transform={`translate(540 560) rotate(-4) scale(${pop(frame, write, 10)})`}>
                    <rect x={-210} y={-150} width={420} height={300} rx={12} fill="#f1efe8" />
                    {[0, 1, 2, 3].map((k) => <line key={k} x1={-170} y1={-80 + k * 60} x2={-170 + 340 * clamp((frame - write - k * 8) / 14)} y2={-80 + k * 60} stroke="#2a3a55" strokeWidth={7} strokeLinecap="round" />)}
                    <text x={0} y={-112} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={30} fill="#2a3a55">WHAT REALLY HAPPENED</text>
                  </g>
                  {[{x: 280, v: 'crowd'}, {x: 540, v: 'hero'}, {x: 800, v: 'crowd'}].map((p, i) => (
                    <Stickman key={i} x={p.x} y={FLOOR} scale={p.v === 'hero' ? 1.45 : 1.25} flip={p.x > 540 ? -1 : 1} pose={idle(frame >= trust ? (p.v === 'hero' ? POSES.confident : POSES.talk) : POSES.stand, frame, `t${i}`)} variant={p.v as 'hero' | 'crowd'} frame={frame} mouth="smile" opacity={p.v === 'hero' ? 1 : pop(frame, trust + i * 3, 10)} blinkSeed={i} />
                  ))}
                </g>
              )}
            </Stage>
          </AbsoluteFill>
        )}
      </Camera>
      <AbsoluteFill style={{background: `rgba(3,3,4,${0.8 * titleDim})`}} />
      <GlitchText text="GASLIGHTING" at={title - 2} out={small - 6} size={170} y="40%" pulses={[title + 16]} />
      <Tag text="ONE DISAGREEMENT ≠ GASLIGHTING" at={calm + 4} out={pattern - 2} x="50%" y="17%" color={COLORS.blue} size={34} />
      <Tag text="THE PATTERN MATTERS" at={pattern + 4} out={write - 4} x="50%" y="17%" color={COLORS.red} size={38} solid />
      <Tag text="WRITE IT DOWN · TALK TO PEOPLE YOU TRUST" at={write + 4} out={finalAt - 4} x="50%" y="17%" color={COLORS.green} size={28} />
      <GlitchBurst at={quotes[2]} />
      <Flash at={crack} dur={6} max={0.5} />
      <EndStatement at={finalAt + 4} y="36%" size={128} lines={[{text: 'TRUST YOUR'}, {text: 'OWN MIND.', color: COLORS.blue}]} />
      <Flash at={endHit} dur={8} max={0.5} />
    </AbsoluteFill>
  );
};

export const Short03Gaslighting: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => (
  <ShortFrame tl={TIMELINES.short3} audio="audio/short3_mix.wav" title="THE MOST DANGEROUS MANIPULATION" withAudio={withAudio}>
    <Content />
  </ShortFrame>
);
