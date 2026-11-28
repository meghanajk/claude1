import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, lerp, pop, prog, shakeAt} from '../lib/anim';
import {useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, Flash, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose, walkPose} from '../components/Stickman';
import {AschCards, Icon, SpeechBubble} from '../components/Props';
import {ChapterCard, ImpactText, Tag} from '../components/Typography';

const FLOOR = 860;

/** Part A: social creatures + observing others (c1-c2). */
const Social: React.FC<{frame: number; c1: number; c2: number; out: number}> = ({frame, c1, c2, out}) => {
  if (frame > out + 2) return null;
  const others = [380, 640, 1280, 1540];
  const mimic = prog(frame, c2 + 40, 16);
  const groupPose = frame >= c2 + 20 ? POSES.wave : POSES.talk;
  return (
    <Stage>
      {others.map((x, i) => (
        <g key={i}>
          <Stickman x={x} y={FLOOR} scale={1.1} flip={x > 960 ? -1 : 1} pose={idle(mixPose(POSES.stand, groupPose, prog(frame, c1 + i * 6, 12)), frame, `so${i}`)} variant="crowd" frame={frame} blinkSeed={i} mouth="smile" eyes="happy" />
          <SpeechBubble x={x + (x > 960 ? -40 : 40)} y={FLOOR - 420} tx={x} ty={FLOOR - 330} text={['HI!', 'HAHA', ':)', 'HEY!'][i]} scale={pop(frame, c1 + 8 + i * 5, 11) * (1 - prog(frame, c2, 10))} w={140} h={80} size={34} />
        </g>
      ))}
      <Stickman x={960} y={FLOOR} scale={1.3} pose={idle(mixPose(POSES.stand, POSES.wave, mimic), frame, 'hs')} variant="hero" frame={frame}
        look={frame >= c2 ? [Math.sin((frame - c2) / 14) * 0.9, 0] : [0, 0]} eyes={frame >= c2 ? 'wide' : 'normal'} mouth={mimic > 0.5 ? 'smile' : 'flat'} />
      {frame >= c2 && others.map((x, i) => (
        <line key={i} x1={960} y1={FLOOR - 340} x2={x} y2={FLOOR - 290} stroke={COLORS.blue} strokeWidth={3} strokeDasharray="12 10" strokeDashoffset={-frame * 2} opacity={0.7 * prog(frame, c2 + i * 4, 10)} />
      ))}
    </Stage>
  );
};

/** Part B: Asch experiment (c3-c7). */
const Asch: React.FC<{frame: number; at: number; linesAt: number; crowdAt: number; think: number; correct: number; pressure: number; hesitate: number; out: number}> = ({frame, at, linesAt, crowdAt, think, correct, pressure, hesitate, out}) => {
  if (frame < at - 2 || frame > out + 2) return null;
  const n = 7, heroIdx = 5;
  const linesP = prog(frame, linesAt - 10, 30, easeOut);
  const glow = prog(frame, correct, 12) * (1 - prog(frame, pressure + 30, 20) * 0.5);
  const press = prog(frame, pressure, 20);
  const shake = frame > pressure ? Math.sin(frame * 1.3) * 3 * press : 0;
  // camera: wide -> hero (think) -> cards (correct) -> hero (pressure)
  const toHero = prog(frame, think, 18) * (1 - prog(frame, correct, 14)) + prog(frame, pressure, 24);
  const toCards = prog(frame, correct, 14) * (1 - prog(frame, pressure, 24));
  const heroX = 360 + heroIdx * 200;
  const zoom = 1 + toHero * 0.75 + toCards * 0.45;
  const ox = 50 + toHero * ((heroX / 1920) * 100 - 50);
  const oy = 50 + toHero * 16 - toCards * 22;
  return (
    <AbsoluteFill>
      <Camera zoom={zoom} originX={ox} originY={oy}>
        <Stage>
          <rect x={260} y={FLOOR - 120} width={1400} height={30} rx={8} fill="#2a2f3a" />
          <AschCards x={960} y={300} scale={0.8} p={linesP} correctGlow={glow} equalP={glow} opacity={prog(frame, at, 12)} />
          {new Array(n).fill(0).map((_, i) => {
            const x = 360 + i * 200;
            const isHero = i === heroIdx;
            const order = i < heroIdx ? i : i - 1;
            const sayT = crowdAt + order * 10;
            const look: [number, number] = frame >= pressure && !isHero ? [clamp((heroX - x) / 400, -1, 1), 0] : [0, -0.5];
            const p = isHero
              ? idle(frame >= hesitate ? POSES.hesitant : frame >= think ? POSES.think : POSES.stand, frame, 'ah')
              : idle(frame >= sayT && frame < sayT + 40 ? POSES.pointUp : POSES.stand, frame, `a${i}`);
            const bubbleS = isHero ? pop(frame, hesitate + 4, 10) : pop(frame, sayT, 12);
            return (
              <g key={i}>
                <Stickman x={x + (isHero ? shake : 0)} y={FLOOR} scale={isHero ? 0.95 : 0.88} pose={p} variant={isHero ? 'hero' : 'crowd'} frame={frame} blinkSeed={i}
                  look={isHero ? (frame >= pressure ? [Math.sin(frame / 7), -0.3] : [0, -0.6]) : look}
                  eyes={isHero ? (frame >= think ? 'wide' : 'normal') : frame >= pressure ? 'narrow' : 'normal'}
                  mouth={isHero ? (frame >= think ? 'worried' : 'flat') : frame >= pressure ? 'flat' : 'smile'}
                  brows={isHero && frame >= think ? 'worried' : !isHero && frame >= pressure ? 'angry' : 'none'} sweat={isHero && frame >= think ? 1 : 0} />
                <SpeechBubble x={x} y={FLOOR - 400} tx={x} ty={FLOOR - 330} text={isHero ? '...A?' : 'A'} scale={bubbleS} w={isHero ? 140 : 100} h={80} size={isHero ? 34 : 44}
                  color={isHero ? '#fff' : '#ffe1e4'} border={isHero ? '#000' : COLORS.red} />
              </g>
            );
          })}
        </Stage>
      </Camera>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 60%, transparent 35%, rgba(150,0,15,0.55) 100%)', opacity: press}} />
    </AbsoluteFill>
  );
};

/** Part C: everyday conformity triptych (c8-c9). */
const Everyday: React.FC<{frame: number; at: number; f1: number; f2: number; f3: number; out: number}> = ({frame, at, f1, f2, f3, out}) => {
  if (frame < at - 2 || frame > out + 2) return null;
  const panels = [
    {t: f1, label: 'FASHION TRENDS'},
    {t: f2, label: 'SOCIAL MEDIA OPINIONS'},
    {t: f3, label: 'POPULAR BELIEFS'},
  ];
  const likes = Math.floor(lerp(12, 48200, prog(frame, f2, 60, easeOut)));
  return (
    <Stage>
      {panels.map((p, i) => {
        const s = pop(frame, p.t, 13);
        const x = 330 + i * 630;
        return (
          <g key={i} transform={`translate(${x} 470) scale(${s})`} opacity={clamp(s * 2)}>
            <rect x={-280} y={-330} width={560} height={620} rx={24} fill="#141820" stroke={i === 1 ? COLORS.blue : i === 0 ? COLORS.red : COLORS.yellow} strokeWidth={4} />
            <text y={-270} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={34} fill={COLORS.white} letterSpacing={2}>{p.label}</text>
            {i === 0 && [-150, -50, 50, 150].map((dx, k) => {
              const capOn = prog(frame, p.t + k * 5, 8);
              return (
                <g key={k}>
                  <Stickman x={dx} y={230} scale={0.62} pose={idle(POSES.confident, frame, `f${k}`)} variant={k === 3 ? 'hero' : 'crowd'} frame={frame} mouth="smile" blinkSeed={k} />
                  <g transform={`translate(${dx + 2} ${230 - 0.62 * 292 - (1 - capOn) * 80}) scale(0.62)`} opacity={capOn}>{Icon.cap(COLORS.red)}</g>
                </g>
              );
            })}
            {i === 1 && (
              <g>
                <rect x={-150} y={-220} width={300} height={470} rx={30} fill="#0b0d12" stroke="#cfd6de" strokeWidth={6} />
                <rect x={-125} y={-185} width={250} height={150} rx={10} fill="#1f2735" />
                <text y={-100} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={44} fill={COLORS.white}>HOT TAKE!</text>
                <g transform="translate(-70 10) scale(0.6)">{Icon.thumbsUp(COLORS.blue)}</g>
                <text x={-30} y={22} fontFamily={FONT_UI} fontWeight={900} fontSize={36} fill={COLORS.blue}>{likes.toLocaleString('en-US')}</text>
                {['Agreed!', 'So true!!', '100% this'].map((c, k) => (
                  <g key={k} opacity={prog(frame, p.t + 12 + k * 8, 8)}>
                    <rect x={-120} y={60 + k * 56} width={240} height={44} rx={10} fill="#1f2735" />
                    <text x={-100} y={90 + k * 56} fontFamily={FONT_UI} fontWeight={800} fontSize={24} fill="#cfd6de">{c}</text>
                  </g>
                ))}
              </g>
            )}
            {i === 2 && (
              <g>
                <rect x={-210} y={-210} width={420} height={90} rx={8} fill={COLORS.yellow} />
                <text y={-150} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={50} fill="#111">EVERYONE KNOWS!</text>
                {[-160, -80, 0, 80, 160].map((dx, k) => {
                  const nod = Math.max(0, Math.sin((frame - p.t) / 5 + k)) * 18;
                  return <Stickman key={k} x={dx} y={240} scale={0.55} pose={{...POSES.stand, head: nod}} variant={k === 2 ? 'hero' : 'crowd'} frame={frame} eyes="closed" mouth="smile" blinkSeed={k} />;
                })}
              </g>
            )}
          </g>
        );
      })}
    </Stage>
  );
};

/** Part D: following the line (c10-c11). */
const FollowLine: React.FC<{frame: number; at: number}> = ({frame, at}) => {
  if (frame < at - 2) return null;
  const t = frame - at;
  const zoom = 1.15 - prog(frame, at, 120, easeOut) * 0.2;
  return (
    <Camera zoom={zoom}>
      <Stage>
        <line x1={0} y1={FLOOR} x2={1920} y2={FLOOR} stroke="rgba(255,255,255,0.15)" strokeWidth={3} />
        {/* sign */}
        <g transform="translate(1700 0)">
          <rect x={-8} y={FLOOR - 330} width={16} height={330} fill="#3a404c" />
          <path d={`M -120 ${FLOOR - 330} L 90 ${FLOOR - 330} L 140 ${FLOOR - 285} L 90 ${FLOOR - 240} L -120 ${FLOOR - 240} Z`} fill={COLORS.yellow} />
          <text x={-10} y={FLOOR - 270} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={46} fill="#111">EVERYONE</text>
        </g>
        {new Array(9).fill(0).map((_, i) => {
          const isHero = i === 8;
          const x = 1500 - i * 170 + t * 2.6 - (isHero ? 30 : 0);
          return (
            <Stickman key={i} x={x} y={FLOOR} scale={0.9} pose={walkPose(frame + i * 5, 0.9)} variant={isHero ? 'hero' : 'crowd'} frame={frame} blinkSeed={i}
              eyes={isHero ? 'sad' : 'dots'} mouth={isHero ? 'worried' : 'flat'} look={isHero ? [Math.sin(frame / 20), 0] : [0.5, 0]} brows={isHero ? 'worried' : 'none'} />
          );
        })}
      </Stage>
    </Camera>
  );
};

export const Scene3Conformity: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B, W} = useTimeline();
  const aschAt = B('aschIn');
  const confHit = B('conformityHit');
  const everydayAt = L('c8');
  const followAt = B('follow');
  const sh = shakeAt(frame, confHit, 18, 10);
  const confDim = prog(frame, confHit - 4, 8) * (1 - prog(frame, everydayAt - 10, 12));
  return (
    <AbsoluteFill>
      <Backdrop top="#10131a" bottom="#05060a" light="rgba(56,182,255,0.10)" floorY={FLOOR} />
      <Particles count={35} seed="conf" opacity={0.3} />
      <AbsoluteFill style={{transform: `translate(${sh.x}px, ${sh.y}px)`}}>
        <Social frame={frame} c1={L('c1')} c2={B('observe')} out={aschAt} />
        <Asch frame={frame} at={aschAt} linesAt={B('aschLines')} crowdAt={B('aschCrowd')} think={B('thinkAbout')} correct={B('correctGlow')} pressure={B('pressure')} hesitate={B('hesitate')} out={everydayAt} />
        <AbsoluteFill style={{background: `rgba(4,5,8,${0.85 * confDim})`}} />
        <ImpactText text="CONFORMITY" at={confHit - 8} out={everydayAt - 12} size={210} spacing={14} underline={COLORS.red} />
        {frame >= everydayAt && frame < followAt + 2 && (
          <AbsoluteFill style={{opacity: 1 - prog(frame, followAt - 8, 10)}}>
            <Everyday frame={frame} at={everydayAt} f1={B('fashion')} f2={B('social')} f3={B('popular')} out={followAt} />
          </AbsoluteFill>
        )}
        {frame >= followAt - 8 && <AbsoluteFill style={{opacity: prog(frame, followAt - 8, 10)}}><FollowLine frame={frame} at={followAt - 8} /></AbsoluteFill>}
      </AbsoluteFill>
      <Tag text="ASCH CONFORMITY EXPERIMENTS · 1950s" at={aschAt + 6} out={B('thinkAbout')} x="50%" y="8%" color={COLORS.blue} size={32} />
      <Flash at={aschAt} dur={8} max={0.5} />
      <Flash at={everydayAt} dur={8} max={0.4} />
      <ChapterCard num="TRICK #1" title="THE POWER OF THE CROWD" at={0} out={L('c1') - 4} />
      <FilmLook vignette={0.75} grain={0.3} />
    </AbsoluteFill>
  );
};
