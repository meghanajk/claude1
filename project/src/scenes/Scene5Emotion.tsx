import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, lerp, pop, prog, shakeAt, wiggle} from '../lib/anim';
import {useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, Flash, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose, walkPose, worldJoint} from '../components/Stickman';
import {EmotionBadge, Icon, PuppetStrings, SpeechBubble} from '../components/Props';
import {ChapterCard, ImpactText} from '../components/Typography';

const FLOOR = 860;

const EMOTIONS = [
  {label: 'FEAR', color: COLORS.red, icon: Icon.fear(COLORS.red), beat: 'emFear'},
  {label: 'GUILT', color: '#ff8a3d', icon: Icon.guilt('#ff8a3d'), beat: 'emGuilt'},
  {label: 'INSECURITY', color: '#b07bff', icon: Icon.insecurity('#b07bff'), beat: 'emInsecurity'},
  {label: 'EXCITEMENT', color: COLORS.yellow, icon: Icon.excitement(COLORS.yellow), beat: 'emExcitement'},
];

/** Part A: logic vs emotions (e1-e3). */
const LogicVsEmotion: React.FC<{frame: number; at: number; shieldAt: number; targetAt: number; out: number}> = ({frame, at, shieldAt, targetAt, out}) => {
  if (frame > out + 2) return null;
  const sh = pop(frame, shieldAt, 11);
  const lock = prog(frame, targetAt - 6, 14, easeOut);
  const arrowT = (frame - (shieldAt + 4)) / 26;
  return (
    <Stage>
      <g transform={`translate(640 470) scale(${pop(frame, at, 12) * 2.2})`}>{Icon.brain(COLORS.blue)}</g>
      <text x={640} y={720} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={64} fill={COLORS.blue} opacity={pop(frame, at, 12)} letterSpacing={6}>LOGIC</text>
      <g transform={`translate(640 470) scale(${sh * 3.6})`} opacity={0.75}>{Icon.shield(COLORS.blue)}</g>
      <g transform={`translate(1280 470) scale(${pop(frame, at + 6, 12) * 2.6 * (1 + 0.06 * Math.sin(frame / 4))})`}>{Icon.heart(COLORS.red)}</g>
      <text x={1280} y={720} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={64} fill={COLORS.red} opacity={pop(frame, at + 6, 12)} letterSpacing={6}>EMOTIONS</text>
      {/* arrow that curves around the shield toward the heart */}
      {arrowT > 0 && arrowT < 1.4 && (() => {
        const t = clamp(arrowT);
        const x = lerp(200, 1280, t), y = 470 - Math.sin(t * Math.PI) * 330;
        return <path d={`M ${x - 60} ${y + 10} L ${x} ${y} M ${x - 18} ${y - 14} L ${x} ${y} L ${x - 14} ${y + 18}`} stroke={COLORS.white} strokeWidth={8} fill="none" strokeLinecap="round" opacity={1 - clamp(arrowT - 1) * 2.5} />;
      })()}
      {lock > 0 && (
        <g transform={`translate(1280 470) rotate(${(1 - lock) * 180 + frame}) scale(${2.4 - lock * 1.1})`} opacity={lock}>
          <circle r={90} fill="none" stroke={COLORS.red} strokeWidth={5} />
          {[0, 90, 180, 270].map((a) => <line key={a} x1={0} y1={-70} x2={0} y2={-120} stroke={COLORS.red} strokeWidth={6} transform={`rotate(${a})`} />)}
        </g>
      )}
    </Stage>
  );
};

/** Part B: guilt + fear conversation (e4-e6). */
const Conversation: React.FC<{frame: number; at: number; guilt: number; fear: number; boundary: number; erase: number; out: number}> = ({frame, at, guilt, fear, boundary, erase, out}) => {
  if (frame < at - 2 || frame > out + 2) return null;
  const leave = prog(frame, fear, 30);
  const back = prog(frame, erase - 10, 30);
  const manipX = 1300 + leave * 220 * (1 - back) - back * 60;
  const manipFlip = frame >= fear && frame < erase - 10 ? 1 : -1;
  const manipWalking = (frame >= fear && frame < fear + 30) || (frame >= erase - 10 && frame < erase + 20);
  const heroReach = prog(frame, erase - 10, 20);
  const heroX = 640 + heroReach * 260;
  const slump = prog(frame, guilt, 12) * (1 - prog(frame, fear, 14));
  let heroPose = idle(POSES.talk, frame, 'eh');
  if (frame >= at + 50) heroPose = mixPose(heroPose, idle(POSES.slump, frame, 'eh'), slump);
  if (frame >= fear) heroPose = mixPose(heroPose, idle(POSES.reach, frame, 'eh'), prog(frame, fear + 6, 12));
  if (heroReach > 0 && heroReach < 1) heroPose = mixPose(heroPose, walkPose(frame), 0.6);
  if (frame >= erase + 20) heroPose = mixPose(heroPose, idle(POSES.marionette, frame, 'eh'), prog(frame, erase + 20, 14));
  const manipPose = manipWalking ? walkPose(frame) : idle(frame >= guilt && frame < fear ? POSES.crossed : frame >= erase ? POSES.pointUp : POSES.talk, frame, 'em');
  const lineP = prog(frame, boundary - 14, 16) * (1 - prog(frame, erase, 16));
  const guiltS = pop(frame, guilt, 10) * (1 - prog(frame, fear, 10));
  const fearS = pop(frame, fear, 10) * (1 - prog(frame, erase + 30, 10));
  const stringsP = prog(frame, erase + 20, 14);
  const mHand = worldJoint(manipPose, 'rHand', manipX, FLOOR, 1.4, manipFlip as 1 | -1);
  return (
    <Stage>
      {/* boundary line */}
      <line x1={960} y1={FLOOR + 50} x2={960} y2={FLOOR + 50 - 260 * lineP} stroke={COLORS.blue} strokeWidth={10} strokeLinecap="round" opacity={lineP} />
      <line x1={960} y1={FLOOR + 50} x2={960} y2={FLOOR + 50 - 260 * lineP} stroke={COLORS.blue} strokeWidth={30} opacity={lineP * 0.25} />
      {lineP > 0.3 && <text x={960} y={FLOOR - 240} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={28} fill={COLORS.blue} opacity={lineP} letterSpacing={3}>BOUNDARY</text>}
      <Stickman x={manipX} y={FLOOR} scale={1.4} flip={manipFlip as 1 | -1} pose={manipPose} variant="manipulator" frame={frame} eyes={frame >= erase ? 'narrow' : 'angry'} mouth={frame >= erase ? 'grin' : frame >= guilt ? 'frown' : 'flat'} brows={frame >= guilt ? 'angry' : 'none'} />
      <Stickman x={heroX} y={FLOOR} scale={1.4} pose={heroPose} variant="hero" frame={frame} eyes={frame >= erase + 20 ? 'dots' : frame >= fear ? 'wide' : frame >= guilt ? 'sad' : 'normal'}
        mouth={frame >= erase + 20 ? 'worried' : frame >= fear ? 'open' : frame >= guilt ? 'frown' : 'flat'} brows={frame >= guilt ? 'worried' : 'none'} sweat={frame >= fear ? 0.9 : 0} />
      <SpeechBubble x={600} y={300} tx={640} ty={FLOOR - 430} text={"I don't agree..."} scale={pop(frame, at + 6, 11) * (1 - prog(frame, guilt, 8))} w={340} h={90} size={34} />
      <SpeechBubble x={1320} y={270} tx={1300} ty={FLOOR - 430} text={"After everything\nI've done for you?"} scale={pop(frame, guilt - 8, 11) * (1 - prog(frame, fear, 8))} w={420} h={140} size={36} color="#2a0b10" textColor="#fff" border={COLORS.red} />
      <SpeechBubble x={1460} y={280} tx={manipX} ty={FLOOR - 430} text={"Fine. Maybe I'll\njust leave."} scale={pop(frame, fear + 4, 11) * (1 - prog(frame, erase - 10, 8))} w={400} h={140} size={36} color="#2a0b10" textColor="#fff" border={COLORS.red} />
      <SpeechBubble x={760} y={280} tx={heroX} ty={FLOOR - 430} text={"OK, OK... sorry!"} scale={pop(frame, erase, 11)} w={360} h={90} size={34} />
      <EmotionBadge x={640} y={230} label="GUILT" color="#ff8a3d" icon={Icon.guilt('#ff8a3d')} scale={guiltS} pulse={Math.sin(frame / 4)} />
      <EmotionBadge x={heroX} y={230} label="FEAR" color={COLORS.red} icon={Icon.fear(COLORS.red)} scale={fearS * (1 - prog(frame, erase - 4, 6))} pulse={Math.sin(frame / 3)} />
      {stringsP > 0 && (
        <PuppetStrings frame={frame} bar={[mHand[0], mHand[1] - 20]} showBar={false} draw={stringsP} color="rgba(255,46,63,0.8)" barWidth={30}
          targets={[worldJoint(heroPose, 'lHand', heroX, FLOOR, 1.4), worldJoint(heroPose, 'head', heroX, FLOOR, 1.4), worldJoint(heroPose, 'rHand', heroX, FLOOR, 1.4)]} />
      )}
    </Stage>
  );
};

/** Part D: emotion strings (e9). */
const EmotionStrings: React.FC<{frame: number; at: number; yank: number}> = ({frame, at, yank}) => {
  if (frame < at - 2) return null;
  const jerk = frame > yank ? Math.sin((frame - yank) / 3) * 14 * Math.exp(-(frame - yank) / 20) : 0;
  const rot = wiggle(frame, 'eb', 8, 0.8) + jerk;
  const heroPose = idle({...POSES.marionette, ra1: 118 + rot * 2, la1: -118 + rot * 2, head: 10 + rot}, frame, 'es');
  const hx = 960, hy = FLOOR + 40;
  const bar: [number, number] = [960, 150];
  const targets: [number, number][] = [
    worldJoint(heroPose, 'lHand', hx, hy, 1.5), worldJoint(heroPose, 'head', hx, hy - 55, 1.5), worldJoint(heroPose, 'rHand', hx, hy, 1.5), worldJoint(heroPose, 'rFoot', hx, hy, 1.5),
  ];
  const draw = prog(frame, at, 16, easeOut);
  return (
    <Stage>
      <Stickman x={960} y={-140} scale={3.2} variant="manipulator" pose={idle(POSES.pointUp, frame, 'big')} eyes="angry" mouth="grin" frame={frame} opacity={0.35} />
      <PuppetStrings frame={frame} bar={bar} rot={rot} targets={targets} draw={draw} color="rgba(255,46,63,0.85)" barWidth={560} width={3} />
      {EMOTIONS.map((e, i) => {
        const t = targets[i];
        const off = (i - 1.5) / 1.5;
        const sx = bar[0] + Math.cos((rot * Math.PI) / 180) * off * 280, sy = bar[1] + Math.sin((rot * Math.PI) / 180) * off * 280;
        const mx = lerp(sx, t[0], 0.45), my = lerp(sy, t[1], 0.45);
        return (
          <g key={i} transform={`translate(${mx} ${my}) scale(${pop(frame, at + 6 + i * 4, 11) * 0.6})`}>
            <rect x={-150} y={-36} width={300} height={72} rx={36} fill="#0d0f13" stroke={e.color} strokeWidth={5} />
            <text y={16} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={46} fill={e.color} letterSpacing={3}>{e.label}</text>
          </g>
        );
      })}
      <Stickman x={hx} y={hy} scale={1.5} pose={heroPose} variant="hero" frame={frame} eyes="sad" mouth="worried" brows="worried" />
    </Stage>
  );
};

export const Scene5Emotion: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const convo = B('convo');
  const manip = B('emoManip');
  const badgesAt = L('e8');
  const stringsAt = L('e9');
  const sh = shakeAt(frame, B('guiltHit'), 10, 10);
  const sh2 = shakeAt(frame, manip, 16, 10);
  const redPulse = 0.5 + 0.5 * Math.sin(frame / 9);
  const redLevel = prog(frame, convo, 30) * 0.6 + prog(frame, manip, 10) * 0.4;
  const manipDim = prog(frame, manip - 4, 8) * (1 - prog(frame, badgesAt - 10, 10));
  return (
    <AbsoluteFill>
      <Backdrop top="#170a0d" bottom="#050304" light={`rgba(255,46,63,${0.1 + 0.12 * redLevel * redPulse})`} lightY={30} floorY={FLOOR} floorColor="rgba(255,120,130,0.18)" />
      <Particles count={35} seed="emo" color="#ff9aa3" opacity={0.3} />
      <Camera shake={{x: sh.x + sh2.x, y: sh.y + sh2.y}} zoom={1 + prog(frame, convo, 400) * 0.06}>
        <LogicVsEmotion frame={frame} at={L('e1')} shieldAt={B('logicShield')} targetAt={B('targetHeart')} out={convo} />
        {frame >= convo - 2 && frame < manip + 2 && <AbsoluteFill style={{opacity: prog(frame, convo - 2, 8)}}><Conversation frame={frame} at={convo} guilt={B('guiltHit')} fear={B('fearHit')} boundary={B('boundary')} erase={B('eraseBoundary')} out={manip} /></AbsoluteFill>}
        {frame >= badgesAt - 4 && frame < stringsAt + 2 && (
          <Stage>
            {EMOTIONS.map((e, i) => (
              <EmotionBadge key={i} x={330 + i * 420} y={470} label={e.label} color={e.color} icon={e.icon} scale={pop(frame, B(e.beat), 10) * 1.6 * (1 - prog(frame, stringsAt - 6, 8))} pulse={Math.sin(frame / 4 + i)} />
            ))}
          </Stage>
        )}
        {frame >= stringsAt - 4 && <AbsoluteFill style={{opacity: prog(frame, stringsAt - 4, 8)}}><EmotionStrings frame={frame} at={stringsAt} yank={B('emStrings')} /></AbsoluteFill>}
      </Camera>
      <AbsoluteFill style={{background: `rgba(10,2,4,${0.85 * manipDim})`}} />
      <ImpactText text="EMOTIONAL" at={manip - 10} out={badgesAt - 10} size={150} y="40%" glow={COLORS.red} />
      <ImpactText text="MANIPULATION" at={manip - 2} out={badgesAt - 10} size={170} y="58%" color={COLORS.red} glow={COLORS.red} underline={COLORS.red} />
      <Flash at={manip} color={COLORS.red} dur={10} max={0.5} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(160,0,15,0.55) 100%)', opacity: redLevel * (0.6 + 0.4 * redPulse)}} />
      <ChapterCard num="TRICK #3" title="USE THEIR EMOTIONS" at={0} out={L('e1') - 4} />
      <FilmLook vignette={0.8} grain={0.3} />
    </AbsoluteFill>
  );
};
