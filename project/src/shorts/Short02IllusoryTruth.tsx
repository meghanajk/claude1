import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, lerp, map, pop, prog, shakeAt} from '../lib/anim';
import {TIMELINES, useTimeline} from '../lib/timeline';
import {Backdrop, Camera, GlitchBurst, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose} from '../components/Stickman';
import {Icon, Meter, Screen} from '../components/Props';
import {GlitchText, Tag} from '../components/Typography';
import {ScreenContent} from '../scenes/Scene4IllusoryTruth';
import {EndStatement, ShortFrame} from './ShortFrame';

const FLOOR = 1330;

const Content: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const first = B('first'), second = B('second'), hundred = B('hundred');
  const effect = B('effect'), ads = B('ads'), mis = B('mis'), research = B('research');
  const ask = L('b9'), endOff = B('endOff'), endHit = B('endHit');
  const truthFeel = L('b5');

  const wall = new Array(30).fill(0).map((_, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    return {x: 20 + col * 212, y: 250 + row * 165, i, at: lerp(hundred - 4, hundred + 30, random(`w${i}`))};
  });
  const mode = (i: number): 'myth' | 'ad' | 'fake' => (frame >= mis && (i % 2 === 0 || frame >= mis + 10) ? 'fake' : frame >= ads && frame < mis ? (i % 3 ? 'ad' : 'myth') : 'myth');
  const offAt = (i: number) => endOff + Math.floor(random(`o${i}`) * 18);

  const count = frame < second ? 1 : frame < hundred ? 2 : Math.floor(map(frame, [hundred, hundred + 40], [3, 100]));
  const belief = map(frame, [first, second, second + 20, hundred, hundred + 40, truthFeel + 40, ask, ask + 20], [0.05, 0.05, 0.25, 0.3, 0.7, 0.88, 0.88, 0.3]);
  const hypno = prog(frame, hundred + 20, 20) * (1 - prog(frame, ask, 8));
  let pose = idle(POSES.crossed, frame, 's2');
  if (frame >= hundred) pose = mixPose(pose, {...idle(POSES.stand, frame, 's2'), head: Math.max(0, Math.sin(frame / 7)) * 16}, prog(frame, hundred, 20));
  if (frame >= ask) pose = mixPose(pose, idle(POSES.think, frame, 's2'), prog(frame, ask, 10));
  const sh = shakeAt(frame, effect, 18, 10);
  const effDim = prog(frame, effect - 4, 8) * (1 - prog(frame, E('b6') + 10, 10));
  const screen2 = pop(frame, second, 11);

  return (
    <AbsoluteFill>
      <Backdrop top="#0b1324" bottom="#04060a" light="rgba(56,182,255,0.18)" lightY={40} lightSize={90} floorY={FLOOR} />
      <Particles count={35} seed="s2" color="#9fd8ff" opacity={0.3} />
      <Camera shake={sh} zoom={1 + prog(frame, 0, 60) * 0.04}>
        <Stage>
          {wall.map((s) => {
            const p = pop(frame, s.at, 12);
            if (p <= 0) return null;
            const o = 1 - prog(frame, offAt(s.i), 6);
            return (
              <g key={s.i} transform={`translate(${s.x + 95} ${s.y + 65}) scale(${p}) translate(${-s.x - 95} ${-s.y - 65})`} opacity={0.6 + 0.4 * o}>
                <Screen id={`v${s.i}`} x={s.x} y={s.y} w={190} h={130} frame={frame} on={o} stand={false}>
                  <ScreenContent w={190} h={130} mode={mode(s.i)} frame={frame} seed={s.i} />
                </Screen>
              </g>
            );
          })}
          {/* main screen(s) */}
          <g opacity={1 - prog(frame, hundred + 10, 10) * 0.0}>
            <Screen id="m1" x={190} y={330} w={700} h={430} frame={frame} on={prog(frame, 0, 4) * (1 - prog(frame, endOff, 6))} scale={1 - screen2 * 0.0}>
              <ScreenContent w={700} h={430} mode={mode(1)} frame={frame} seed={77} />
            </Screen>
          </g>
          <Stickman x={540} y={FLOOR} scale={1.35} pose={pose} variant="hero" frame={frame}
            eyes={hypno > 0.5 ? 'spiral' : frame < hundred ? 'narrow' : 'normal'} mouth={hypno > 0.5 ? 'smile' : frame < hundred ? 'smirk' : 'flat'} brows={frame < hundred ? 'raised' : 'none'} look={[0, -0.6]} />
          {hypno > 0 && new Array(4).fill(0).map((_, i) => {
            const k = (frame / 20 + i / 4) % 1;
            return <circle key={i} cx={540} cy={FLOOR - 1.35 * 290} r={40 + k * 240} fill="none" stroke={COLORS.yellow} strokeWidth={3} opacity={(1 - k) * 0.5 * hypno} />;
          })}
          {frame >= research && frame < ask + 2 && (
            <g transform={`translate(860 ${FLOOR - 470}) scale(${pop(frame, research, 10) * 1.3})`} opacity={1 - prog(frame, ask - 4, 6)}>
              {Icon.bulb(COLORS.yellow)}
            </g>
          )}
          {frame >= ask && frame < endOff + 4 && (
            <g transform={`translate(540 ${FLOOR - 560}) scale(${pop(frame, B('ask'), 10) * 2.2})`} opacity={1 - prog(frame, endOff, 6)}>
              {Icon.magnifier(COLORS.white)}
            </g>
          )}
        </Stage>
      </Camera>
      {/* belief meter panel */}
      <AbsoluteFill style={{opacity: prog(frame, first, 10) * (1 - prog(frame, effect - 6, 6)) + prog(frame, E('b6') + 10, 10) * (1 - prog(frame, endOff - 4, 6))}}>
        <Stage>
          <rect x={290} y={790} width={500} height={110} rx={16} fill="rgba(5,7,12,0.9)" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
          <Meter x={330} y={860} w={420} value={belief} label="FEELS TRUE" color={belief > 0.5 ? COLORS.yellow : COLORS.blue} size={30} />
        </Stage>
      </AbsoluteFill>
      <Tag text={`HEARD × ${count}`} at={first} out={effect - 6} x="50%" y="17%" color={count > 2 ? COLORS.yellow : COLORS.white} size={42} />
      <Tag text="EVEN IF YOU KNOW BETTER" at={research + 4} out={ask - 4} x="50%" y="17%" color={COLORS.yellow} size={36} />
      <Tag text="ASK: WHY DOES IT FEEL TRUE?" at={B('ask') - 4} out={endOff} x="50%" y="17%" color={COLORS.blue} size={36} />
      <GlitchBurst at={hundred} />
      <GlitchBurst at={mis} dur={6} />
      <AbsoluteFill style={{background: `rgba(3,4,8,${0.85 * effDim})`}} />
      <GlitchText text="ILLUSORY" at={effect - 4} out={E('b6') + 8} size={170} y="30%" pulses={[effect + 14]} />
      <GlitchText text="TRUTH" at={effect - 2} out={E('b6') + 8} size={170} y="40%" pulses={[effect + 14]} />
      <GlitchText text="EFFECT" at={effect} out={E('b6') + 8} size={170} y="50%" color={COLORS.red} pulses={[effect + 14]} />
      <EndStatement at={endHit - 2} y="38%" size={140} lines={[{text: 'FAMILIARITY', color: COLORS.blue}, {text: 'IS NOT'}, {text: 'PROOF.', color: COLORS.red}]} />
    </AbsoluteFill>
  );
};

export const Short02IllusoryTruth: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => (
  <ShortFrame tl={TIMELINES.short2} audio="audio/short2_mix.wav" title="THE LIE THAT BECOMES TRUTH" accent={COLORS.yellow} withAudio={withAudio}>
    <Content />
  </ShortFrame>
);
