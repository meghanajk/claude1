import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, FPS, clamp, easeOut, lerp, pop, prog, shakeAt, wiggle} from '../lib/anim';
import {TimelineProvider, sceneFrames, useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, Flash, GlitchBurst, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose, walkPose, worldJoint} from '../components/Stickman';
import {CrossOut, Icon, PuppetStrings} from '../components/Props';
import {Scene1Hook} from './Scene1Hook';
import {Scene2Setup} from './Scene2Setup';
import {Scene3Conformity} from './Scene3Conformity';
import {Scene4IllusoryTruth} from './Scene4IllusoryTruth';
import {Scene5Emotion} from './Scene5Emotion';
import {Scene6Gaslighting} from './Scene6Gaslighting';

const FLOOR = 900;
const CLIP = 9;

/** Re-plays short moments of earlier scenes (absolute time `sec` in the main timeline). */
const MONTAGE: {scene: string; C: React.FC; sec: number}[] = [
  {scene: 'hook', C: Scene1Hook, sec: 9.5},
  {scene: 'setup', C: Scene2Setup, sec: 35.0},
  {scene: 'conformity', C: Scene3Conformity, sec: 71.5},
  {scene: 'illusory', C: Scene4IllusoryTruth, sec: 104.5},
  {scene: 'emotion', C: Scene5Emotion, sec: 141.5},
  {scene: 'gaslighting', C: Scene6Gaslighting, sec: 187.5},
];

const Montage: React.FC<{at: number}> = ({at}) => {
  const {tl} = useTimeline();
  const frame = useCurrentFrame();
  if (frame < at || frame > at + MONTAGE.length * CLIP + 2) return null;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {MONTAGE.map((m, k) => {
        const {from} = sceneFrames(tl, m.scene);
        const offset = from - 12;
        const local = Math.round(m.sec * FPS) - offset;
        const start = at + k * CLIP;
        if (frame < start || frame >= start + CLIP) return null; // only one clip visible at a time
        const zoom = 1.06 + (frame - start) * 0.012;
        return (
          <Sequence key={k} from={start - local} durationInFrames={local + CLIP} layout="none">
            <AbsoluteFill style={{transform: `scale(${zoom}) rotate(${(k % 2 ? 1 : -1) * 1.2}deg)`, filter: 'contrast(1.15) saturate(1.2)'}}>
              <TimelineProvider tl={tl} offset={offset}>
                <m.C />
              </TimelineProvider>
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {MONTAGE.map((_, k) => <GlitchBurst key={k} at={at + k * CLIP} dur={4} strength={1.5} />)}
      <AbsoluteFill style={{border: `10px solid ${COLORS.red}`, boxShadow: `inset 0 0 120px ${COLORS.red}88`}} />
    </AbsoluteFill>
  );
};

const SOURCES = [
  {label: 'ADVERTISING', icon: Icon.billboard, beat: 'nAds', x: 330, joint: 'lHand' as const},
  {label: 'SOCIAL PRESSURE', icon: Icon.crowd, beat: 'nSocial', x: 770, joint: 'head' as const},
  {label: 'ONLINE TRENDS', icon: Icon.phone, beat: 'nOnline', x: 1150, joint: 'rHand' as const},
  {label: 'RELATIONSHIPS', icon: Icon.relationship, beat: 'nRel', x: 1590, joint: 'rFoot' as const},
];

export const Scene7Revelation: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const remote = B('remote');
  const remoteX = B('remoteX');
  const montage = B('montage');
  const hypno = B('hypnotist');
  const hypnoX = B('hypnoX');
  const invisible = B('invisible');
  const choice = B('ownChoice');
  const brk = B('breakStrings');
  const afterMontage = montage + MONTAGE.length * CLIP;

  const sh = shakeAt(frame, brk, 26, 14);
  const sh0 = shakeAt(frame, B('revealQ'), 10, 10);
  const bright = prog(frame, brk, 40, easeOut);

  // hero centre stage
  const hx = 960;
  const marionette = prog(frame, B('nAds') - 4, 14) * (1 - prog(frame, brk, 10));
  const strRot = wiggle(frame, 'rv', 6, 0.6);
  let heroPose = idle(POSES.stand, frame, 'rv');
  heroPose = mixPose(heroPose, {...POSES.marionette, ra1: 110 + strRot * 2, la1: -110 + strRot * 2, head: 8 + strRot}, marionette * (frame >= invisible ? 0.25 : 1));
  if (frame >= invisible && frame < brk) heroPose = mixPose(heroPose, walkPose(frame - invisible, 0.6), 0.45 * (1 - prog(frame, choice, 12)));
  if (frame >= brk) heroPose = mixPose(heroPose, idle(POSES.defiant, frame, 'rv'), prog(frame, brk - 3, 8));
  const stringsOpacity = frame < invisible ? 1 : frame < choice ? 1 - prog(frame, invisible, 30) * 0.88 : 0.12 + prog(frame, choice, 20) * 0.88;
  const stringColor = frame >= choice ? `rgba(255,46,63,0.9)` : 'rgba(255,255,255,0.75)';

  const wordsAt = [B('rNotice'), B('rBelieve'), B('rFeel'), B('rDecide')];
  const words = ['NOTICE', 'BELIEVE', 'FEEL', 'DECIDE'];
  const wordPos = [[560, 330], [1360, 330], [520, 640], [1400, 640]];
  const wordsOut = montage - 2;

  const inSources = frame >= B('nAds') - 6;
  return (
    <AbsoluteFill>
      <Backdrop top={`rgb(${lerp(16, 30, bright)},${lerp(14, 60, bright)},${lerp(20, 110, bright)})`} bottom={`rgb(${lerp(5, 12, bright)},${lerp(5, 24, bright)},${lerp(8, 48, bright)})`}
        light={frame >= brk ? `rgba(255,220,160,${0.35 * bright})` : 'rgba(255,46,63,0.12)'} lightY={25} lightSize={70} floorY={FLOOR} />
      <Particles count={45} seed="rv" color={frame >= brk ? '#ffe2a8' : '#ff9aa3'} opacity={0.35} />
      <Camera shake={{x: sh.x + sh0.x, y: sh.y + sh0.y}} zoom={1 + prog(frame, 0, 80) * 0.08 - prog(frame, montage, 20) * 0.08 + prog(frame, choice, 60) * 0.1 - prog(frame, brk, 30) * 0.1}>
        <Stage>
          {/* glowing brain over the head at the start */}
          <g transform={`translate(${hx} 300) scale(${pop(frame, 4, 12) * 1.8 * (1 - prog(frame, montage - 4, 6))})`} opacity={0.9}>{Icon.brain(COLORS.blue)}</g>
          {/* remote control */}
          {frame >= remote - 16 && frame < montage && (
            <g>
              <g transform={`translate(${lerp(1900, 1520, prog(frame, remote - 16, 14, easeOut))} 470) rotate(-35) scale(1.8)`}>{Icon.remote()}</g>
              {frame >= remote && frame < remoteX && <path d={`M 1450 430 Q 1250 ${360 + Math.sin(frame) * 30} ${hx + 60} 330`} stroke={COLORS.red} strokeWidth={6} fill="none" strokeDasharray="20 12" strokeDashoffset={-frame * 6} />}
              <CrossOut x={1520} y={470} size={110} p={prog(frame, remoteX, 8)} />
            </g>
          )}
          {/* influence words */}
          {words.map((w, i) => {
            const s = pop(frame, wordsAt[i], 11) * (1 - prog(frame, wordsOut, 6));
            if (s <= 0) return null;
            return (
              <g key={w}>
                <line x1={hx} y1={FLOOR - 360} x2={wordPos[i][0]} y2={wordPos[i][1]} stroke={COLORS.blue} strokeWidth={3} strokeDasharray="10 8" opacity={s * 0.7} />
                <g transform={`translate(${wordPos[i][0]} ${wordPos[i][1]}) scale(${s})`}>
                  <rect x={-150} y={-46} width={300} height={92} rx={46} fill="#0b1422" stroke={COLORS.blue} strokeWidth={5} />
                  <text y={20} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={58} fill={COLORS.white} letterSpacing={4}>{w}</text>
                </g>
              </g>
            );
          })}
          {/* hypnotist + master manipulator, crossed out */}
          {frame >= hypno - 30 && frame < B('nAds') + 4 && (
            <g opacity={prog(frame, hypno - 30, 10) * (1 - prog(frame, B('nAds') - 6, 8))}>
              <Stickman x={420} y={FLOOR} scale={1.2} pose={idle(POSES.point, frame, 'hy')} variant="crowd" tint="#7d6bb0" frame={frame} eyes="spiral" mouth="smirk" />
              <rect x={385} y={FLOOR - 455} width={70} height={60} fill="#111" /><rect x={365} y={FLOOR - 400} width={110} height={10} fill="#111" />
              <g transform={`translate(${420 + 1.2 * 100} ${FLOOR - 290})`}>{Icon.pendulum(COLORS.yellow, Math.sin(frame / 6) * 30)}</g>
              <Stickman x={1500} y={FLOOR} scale={1.2} flip={-1} pose={idle(POSES.pointUp, frame, 'mm')} variant="manipulator" frame={frame} eyes="angry" mouth="grin" />
              <CrossOut x={440} y={FLOOR - 200} size={170} p={prog(frame, hypnoX, 8)} />
              <CrossOut x={1500} y={FLOOR - 200} size={170} p={prog(frame, hypnoX + 4, 8)} />
            </g>
          )}
          {/* sources + strings */}
          {inSources && SOURCES.map((s, i) => {
            const at = B(s.beat);
            const sc = pop(frame, at, 11) * (1 - prog(frame, brk + 20, 20) * 0.3);
            if (sc <= 0) return null;
            const target = worldJoint(heroPose, s.joint, hx, FLOOR, 1.35);
            const tgt: [number, number] = s.joint === 'head' ? [target[0], target[1] - 50] : target;
            const draw = prog(frame, at, 12, easeOut);
            const snap = prog(frame, brk + i, 22);
            const iconOp = frame >= invisible && frame < choice ? 0.35 : 1;
            return (
              <g key={s.label}>
                <PuppetStrings frame={frame} bar={[s.x, 250]} targets={[tgt]} showBar={false} draw={draw} snap={snap} color={stringColor} opacity={stringsOpacity} barWidth={2} width={3.5} />
                <g transform={`translate(${s.x} 180) scale(${sc})`} opacity={iconOp}>
                  <circle r={74} fill="#0e1118" stroke={frame >= choice && frame < brk ? COLORS.red : 'rgba(255,255,255,0.6)'} strokeWidth={5} />
                  {s.icon()}
                  <text y={118} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={28} fill={COLORS.white} letterSpacing={2}>{s.label}</text>
                </g>
              </g>
            );
          })}
          <Stickman x={hx} y={FLOOR} scale={1.35} pose={heroPose} variant="hero" frame={frame}
            eyes={frame >= brk ? 'normal' : frame >= choice ? 'wide' : frame >= invisible ? 'happy' : marionette > 0.5 ? 'dots' : 'normal'}
            mouth={frame >= brk ? 'smile' : frame >= choice ? 'o' : frame >= invisible ? 'smile' : 'flat'} brows={frame >= brk ? 'angry' : 'none'} glow={frame >= brk ? COLORS.yellow : undefined} />
          {/* light rays after the break */}
          {bright > 0 && new Array(9).fill(0).map((_, i) => (
            <path key={i} d={`M 960 -100 L ${200 + i * 190} 1080 L ${260 + i * 190} 1080 Z`} fill="#ffe8b0" opacity={0.05 * bright} />
          ))}
        </Stage>
      </Camera>
      {frame >= choice - 10 && frame < brk + 10 && (
        <div style={{position: 'absolute', top: '33%', width: '100%', textAlign: 'center', fontFamily: FONT_TITLE, fontSize: 104, letterSpacing: 8, color: COLORS.white, opacity: prog(frame, choice - 10, 10) * (1 - prog(frame, brk, 8)), textShadow: `0 0 40px ${COLORS.red}`}}>
          "YOUR OWN CHOICE"
        </div>
      )}
      <Montage at={montage} />
      <Flash at={brk} dur={16} max={0.95} />
      <Flash at={afterMontage} dur={6} max={0.4} />
      <FilmLook vignette={0.75 - bright * 0.3} grain={0.3} />
    </AbsoluteFill>
  );
};
