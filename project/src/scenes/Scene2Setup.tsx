import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, lerp, pop, prog, shakeAt, wiggle} from '../lib/anim';
import {useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose, walkPose} from '../components/Stickman';
import {Icon, SpeechBubble, ThoughtBubble} from '../components/Props';
import {Tag} from '../components/Typography';

const FLOOR = 840;

/** Simple perspective room. */
const Room: React.FC<{door: number; red: number}> = ({door, red}) => (
  <g>
    <rect x={0} y={0} width={1920} height={FLOOR} fill="#12151c" />
    <rect x={0} y={0} width={1920} height={FLOOR} fill={COLORS.redDeep} opacity={red * 0.35} />
    <path d={`M 0 ${FLOOR} L 1920 ${FLOOR} L 1920 1080 L 0 1080 Z`} fill="#0b0d12" />
    {new Array(9).fill(0).map((_, i) => (
      <line key={i} x1={960 + (i - 4) * 120} y1={FLOOR} x2={960 + (i - 4) * 520} y2={1080} stroke="rgba(120,170,220,0.10)" strokeWidth={2} />
    ))}
    <line x1={0} y1={FLOOR} x2={1920} y2={FLOOR} stroke="rgba(160,200,255,0.25)" strokeWidth={3} />
    {/* window light */}
    <rect x={1300} y={150} width={300} height={220} fill="rgba(120,180,255,0.06)" stroke="rgba(160,200,255,0.18)" strokeWidth={4} />
    <line x1={1450} y1={150} x2={1450} y2={370} stroke="rgba(160,200,255,0.18)" strokeWidth={4} />
    {/* door */}
    <rect x={110} y={FLOOR - 400} width={200} height={400} fill="#05070a" stroke="#2c3240" strokeWidth={6} />
    <g transform={`translate(110 0) scale(${1 - door * 0.85} 1)`}>
      <rect x={0} y={FLOOR - 400} width={200} height={400} fill="#232936" stroke="#3a4152" strokeWidth={4} />
      <circle cx={170} cy={FLOOR - 200} r={9} fill="#9aa3ad" />
    </g>
    {/* ceiling lamp */}
    <line x1={760} y1={0} x2={760} y2={90} stroke="#3a3f49" strokeWidth={4} />
    <path d="M 720 90 L 800 90 L 780 120 L 740 120 Z" fill="#3a3f49" />
    <path d={`M 740 120 L 780 120 L 940 ${FLOOR} L 580 ${FLOOR} Z`} fill="rgba(255,240,200,0.05)" />
  </g>
);

export const Scene2Setup: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B, W} = useTimeline();

  const enter = B('roomWalk');
  const walkEnd = enter + 70;
  const doorP = prog(frame, enter - 8, 14, easeOut) * (1 - prog(frame, walkEnd, 20));
  const wt = clamp((frame - enter) / (walkEnd - enter));
  const heroX = lerp(200, 560, wt);
  const heroWalking = frame >= enter && frame < walkEnd;

  const crowdAt = B('crowdPop');
  const pointAt = B('crowdPoint');
  const sayAt = B('crowdSay');
  const closeAt = B('crowdClose');
  const why = B('why');
  const knowWrong = B('knowWrong');
  const doubt = B('doubtStart');
  const brainIn = L('s8');
  const brainOut = E('s9') + 14;

  // crowd: 10 people. home positions and "surrounding" positions
  const crowd = new Array(10).fill(0).map((_, i) => {
    const back = i % 2 === 1;
    const homeX = 1000 + (i >> 1) * 175 + (back ? 85 : 0);
    const homeY = back ? FLOOR - 70 : FLOOR + 10;
    const ang = (-0.15 + (i / 9) * 1.3) * Math.PI; // ring around hero
    const ringX = heroX + Math.cos(ang) * (300 + (back ? 90 : 0)) ;
    const ringY = FLOOR + (back ? -40 : 30) + Math.sin(ang) * 10;
    return {homeX, homeY, ringX, ringY, back};
  });
  const close = prog(frame, closeAt, 70, easeOut);
  const red = prog(frame, closeAt, 70) * (1 - prog(frame, brainOut, 30) * 0.3);
  const sh = shakeAt(frame, why, 16, 8);
  const camZoom = 1 + prog(frame, closeAt, 90) * 0.18 + (frame >= why ? 0.06 * Math.exp(-(frame - why) / 10) : 0) + prog(frame, L('s10'), 80) * 0.15;
  const dim = prog(frame, brainIn - 4, 12) * (1 - prog(frame, brainOut - 8, 14));

  // hero pose + face
  let heroPose = heroWalking ? walkPose(frame - enter) : idle(POSES.stand, frame, 'h2');
  if (frame >= knowWrong) heroPose = mixPose(heroPose, idle(POSES.crossed, frame, 'h2'), prog(frame, knowWrong, 10));
  if (frame >= doubt) heroPose = mixPose(heroPose, idle(POSES.hesitant, frame, 'h2'), prog(frame, doubt, 14));
  if (frame >= why) heroPose = mixPose(heroPose, idle(POSES.handsHead, frame, 'h2', 0.5), prog(frame, why, 8));
  const heroEyes = frame >= why ? 'wide' : frame >= doubt ? 'sad' : frame >= knowWrong ? 'narrow' : 'normal';
  const heroMouth = frame >= why ? 'o' : frame >= doubt ? 'worried' : frame >= knowWrong ? 'smirk' : 'flat';

  // object: the mug
  const mugX = 780, mugY = FLOOR - 170;

  // thought bubble content: mug ✓ -> flickering mug/shoe -> big ?
  const thoughtS = pop(frame, knowWrong, 11) * (1 - prog(frame, brainIn - 6, 8));
  const flicker = frame >= doubt && frame < why && Math.floor((frame - doubt) / 5) % 2 === 1;

  return (
    <AbsoluteFill>
      <Backdrop top="#0e1117" bottom="#06070a" floorY={null} />
      <Camera zoom={camZoom} shake={sh} originX={30} originY={60}>
        <Stage>
          <Room door={doorP} red={red} />
          {/* pedestal + mug */}
          <rect x={mugX - 70} y={FLOOR - 110} width={140} height={110} fill="#20252f" stroke="#3a4152" strokeWidth={4} />
          <g transform={`translate(${mugX} ${mugY}) scale(0.9)`} opacity={prog(frame, L('s3'), 12)}>
            <circle r={110} fill={COLORS.blue} opacity={0.08 + 0.05 * Math.sin(frame / 8)} />
            {Icon.mug('#f4f4f2')}
          </g>
          {/* crowd */}
          {crowd.map((c, i) => {
            const at = crowdAt + i * 3;
            const s = pop(frame, at, 12);
            if (s <= 0) return null;
            const x = lerp(c.homeX, c.ringX, close);
            const y = lerp(c.homeY, c.ringY, close);
            const moving = close > 0.02 && close < 0.98;
            const pointP = prog(frame, pointAt + (i % 4) * 2, 10);
            let p = idle(POSES.stand, frame, `c${i}`);
            p = mixPose(p, idle(POSES.point, frame, `c${i}`, 0.4), pointP);
            if (moving) p = mixPose(p, walkPose(frame - closeAt + i * 3, 0.7), 0.6);
            const faceLeft = x > heroX ? -1 : 1;
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>
                <Stickman x={x} y={y} scale={c.back ? 0.9 : 1.12} flip={faceLeft as 1 | -1} pose={p} variant="crowd" frame={frame} blinkSeed={i}
                  eyes={frame >= closeAt ? 'narrow' : 'normal'} mouth={frame >= sayAt ? (frame < sayAt + 50 ? 'open' : 'smirk') : 'flat'} brows={frame >= closeAt ? 'angry' : 'none'} />
              </g>
            );
          })}
          {/* hero */}
          {frame >= enter - 2 && (
            <Stickman x={heroX} y={FLOOR + 20} scale={1.25} pose={heroPose} variant="hero" frame={frame} eyes={heroEyes as never} mouth={heroMouth as never}
              brows={frame >= doubt ? 'worried' : 'none'} sweat={frame >= doubt ? 0.9 : 0} look={frame >= closeAt && frame < why ? [Math.sin(frame / 12) * 0.8, 0] : [0.4, 0]} />
          )}
          {/* crowd speech */}
          {[{i: 0, dx: -20, dy: -430, t: "IT'S A SHOE."}, {i: 4, dx: 0, dy: -470, t: 'A SHOE!'}, {i: 8, dx: 0, dy: -430, t: 'OBVIOUSLY\nA SHOE.'}].map((b, k) => {
            const c = crowd[b.i];
            const s = pop(frame, sayAt + k * 6, 11) * (1 - prog(frame, closeAt + 10, 10));
            return <SpeechBubble key={k} x={c.homeX + b.dx} y={c.homeY + b.dy} tx={c.homeX - 20} ty={c.homeY - 300} text={b.t} scale={s} w={b.t.includes('\n') ? 260 : 270} h={b.t.includes('\n') ? 120 : 90} size={34} />;
          })}
          {/* hero thought */}
          <ThoughtBubble x={heroX + 40} y={330} tx={heroX + 10} ty={FLOOR - 340} r={115} scale={thoughtS} stroke={frame >= doubt ? COLORS.red : COLORS.blue}>
            {frame < why ? (
              <g>
                <g transform="translate(-30 0) scale(0.75)">{flicker ? Icon.shoe('#333') : Icon.mug('#333')}</g>
                {frame < doubt ? (
                  <path d="M 30 0 L 48 20 L 82 -26" stroke={COLORS.green} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <text x={62} y={26} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={80} fill={COLORS.red}>?</text>
                )}
              </g>
            ) : (
              <text y={52} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={150 * (1 + 0.3 * Math.exp(-(frame - why) / 6))} fill={COLORS.red}>?</text>
            )}
          </ThoughtBubble>
        </Stage>
      </Camera>
      <Tag text="A LITTLE EXPERIMENT" at={L('s1') + 2} out={L('s2') + 20} x="50%" y="14%" color={COLORS.blue} size={40} />
      <Tag text="10 PEOPLE" at={crowdAt + 4} out={L('s4') + 30} x="72%" y="16%" color={COLORS.white} size={34} />
      {/* brain: be correct vs belong */}
      <AbsoluteFill style={{background: `rgba(4,5,8,${0.93 * dim})`}} />
      {dim > 0 && <BrainBalance frame={frame} correctAt={B('brainCorrect')} belongAt={B('brainBelong')} opacity={dim} />}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(120,0,10,0.5) 100%)', opacity: red * 0.8}} />
      <FilmLook vignette={0.75} grain={0.3} />
    </AbsoluteFill>
  );
};

const BrainBalance: React.FC<{frame: number; correctAt: number; belongAt: number; opacity: number}> = ({frame, correctAt, belongAt, opacity}) => {
  const tilt = -6 * prog(frame, correctAt, 10, easeOut) + 22 * prog(frame, belongAt, 18, easeOut) + wiggle(frame, 'bal', 1.2, 1);
  const left = pop(frame, correctAt, 11);
  const right = pop(frame, belongAt, 11);
  const R = (tilt * Math.PI) / 180;
  const arm = 360;
  const lx = 960 - Math.cos(R) * arm, ly = 560 - Math.sin(R) * arm;
  const rx = 960 + Math.cos(R) * arm, ry = 560 + Math.sin(R) * arm;
  return (
    <AbsoluteFill style={{opacity}}>
      <Stage>
        <g transform={`translate(960 260) scale(2.6)`}>{Icon.brain(COLORS.blue)}</g>
        <path d="M 960 560 L 920 860 L 1000 860 Z" fill="#2a2f3a" />
        <line x1={lx} y1={ly} x2={rx} y2={ry} stroke="#c9d0d8" strokeWidth={10} strokeLinecap="round" />
        <circle cx={960} cy={560} r={14} fill="#c9d0d8" />
        {[{x: lx, y: ly, s: left, label: 'BE CORRECT', c: COLORS.blue, icon: <path d="M -26 0 L -6 20 L 28 -24" stroke={COLORS.blue} strokeWidth={10} fill="none" strokeLinecap="round" />},
          {x: rx, y: ry, s: right, label: 'BELONG', c: COLORS.red, icon: Icon.crowd(COLORS.red)}].map((p, i) => (
          <g key={i}>
            <line x1={p.x} y1={p.y} x2={p.x - 70} y2={p.y + 120} stroke="#888" strokeWidth={3} />
            <line x1={p.x} y1={p.y} x2={p.x + 70} y2={p.y + 120} stroke="#888" strokeWidth={3} />
            <path d={`M ${p.x - 90} ${p.y + 120} L ${p.x + 90} ${p.y + 120} Q ${p.x} ${p.y + 170} ${p.x - 90} ${p.y + 120} Z`} fill="#3a404c" />
            <g transform={`translate(${p.x} ${p.y + 60}) scale(${p.s})`}>
              {p.icon}
              <text y={-60} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={40} fill={p.c} letterSpacing={3}>{p.label}</text>
            </g>
          </g>
        ))}
      </Stage>
    </AbsoluteFill>
  );
};
