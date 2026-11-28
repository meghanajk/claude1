import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, clamp, easeOut, lerp, pop, prog, shakeAt} from '../lib/anim';
import {TIMELINES, useTimeline} from '../lib/timeline';
import {Backdrop, Camera, Flash, GlitchBurst, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose, walkPose} from '../components/Stickman';
import {AschCards, SpeechBubble} from '../components/Props';
import {Tag} from '../components/Typography';
import {EndStatement, ShortFrame} from './ShortFrame';

const FLOOR = 1290;

const Content: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const labAt = L('a2');
  const linesAt = B('lines');
  const obvious = B('obvious');
  const secret = B('secret');
  const oneByOne = B('oneByOne');
  const realQ = B('realQ');
  const many = B('many');
  const aloneAt = L('a10');
  const endAt = L('a11');
  const endHit = B('endHit');
  const sh = shakeAt(frame, 0, 20, 10);
  const sh2 = shakeAt(frame, many, 12, 10);

  // ---------- hook (a1): hero surrounded by a pointing crowd
  const hookOut = labAt;
  const ring = new Array(6).fill(0).map((_, i) => {
    const a = Math.PI * (0.95 + (i / 5) * 1.1);
    return {x: 540 + Math.cos(a) * 380, y: FLOOR - 40 + Math.sin(a) * -60 + (i % 2) * 70};
  });

  // ---------- lab
  const n = 6, heroIdx = 4;
  const seatX = (i: number) => 120 + i * 168;
  const zoomHero = prog(frame, realQ, 14) * (1 - prog(frame, many + 40, 14));
  const heroX = seatX(heroIdx);
  const glow = prog(frame, obvious, 10) * (1 - prog(frame, secret, 10)) + prog(frame, L('a9'), 10) * (1 - prog(frame, aloneAt, 8));
  const labOut = aloneAt;

  // ---------- alone vs group
  const walkToGroup = prog(frame, aloneAt + 24, 30);

  return (
    <AbsoluteFill>
      <Backdrop top="#12151d" bottom="#05060a" light="rgba(56,182,255,0.14)" lightY={45} lightSize={90} floorY={FLOOR} />
      <Particles count={40} seed="s1" opacity={0.35} />
      <Camera shake={{x: sh.x + sh2.x, y: sh.y + sh2.y}} zoom={1 + zoomHero * 0.3} originX={(heroX / 1080) * 100} originY={64}>
        {frame < hookOut + 4 && (
          <AbsoluteFill style={{opacity: 1 - prog(frame, hookOut - 4, 8)}}>
            <Stage>
              {ring.map((c, i) => (
                <g key={i}>
                  <Stickman x={c.x} y={c.y} scale={1.3} flip={c.x > 540 ? -1 : 1} pose={idle(mixPose(POSES.stand, POSES.point, prog(frame, 3 + i * 2, 8)), frame, `r${i}`)} variant="crowd" frame={frame} eyes="narrow" mouth="open" brows="angry" blinkSeed={i} />
                  <SpeechBubble x={c.x + (c.x > 540 ? -30 : 30)} y={c.y - 540} tx={c.x} ty={c.y - 420} text="B!" scale={pop(frame, B('wrongWord') + i * 3, 10)} w={110} h={80} size={46} color="#ffe1e4" border={COLORS.red} />
                </g>
              ))}
              <Stickman x={540} y={FLOOR + 40} scale={1.9} pose={idle(POSES.handsHead, frame, 'hh')} variant="hero" frame={frame} eyes="wide" mouth="o" brows="worried" sweat={1} look={[Math.sin(frame / 6) * 0.8, 0]} />
            </Stage>
          </AbsoluteFill>
        )}
        {frame >= labAt - 4 && frame < labOut + 6 && (
          <AbsoluteFill style={{opacity: prog(frame, labAt - 4, 8) * (1 - prog(frame, labOut - 4, 8))}}>
            <Stage>
              <AschCards x={540} y={590} scale={1.3} p={prog(frame, linesAt - 6, 26, easeOut)} correctGlow={glow} equalP={glow} opacity={prog(frame, labAt, 10)} />
              <rect x={40} y={FLOOR - 110} width={1000} height={26} rx={8} fill="#2a2f3a" />
              {new Array(n).fill(0).map((_, i) => {
                const x = seatX(i);
                const isHero = i === heroIdx;
                const order = i < heroIdx ? i : i - 1;
                const sayT = oneByOne + Math.round(order * 0.28 * 30);
                const actor = !isHero && frame >= secret;
                const p = isHero
                  ? idle(frame >= many ? POSES.hesitant : frame >= realQ ? POSES.think : POSES.stand, frame, 'h')
                  : idle(frame >= sayT && frame < sayT + 30 ? POSES.pointUp : POSES.stand, frame, `a${i}`);
                return (
                  <g key={i}>
                    <Stickman x={x} y={FLOOR} scale={0.9} pose={p} variant={isHero ? 'hero' : 'crowd'} frame={frame} blinkSeed={i} tint={actor ? '#b8636c' : undefined}
                      eyes={isHero ? (frame >= realQ ? 'wide' : 'normal') : actor ? 'narrow' : 'normal'} mouth={isHero ? (frame >= realQ ? 'worried' : 'flat') : actor ? 'smirk' : 'flat'}
                      look={isHero ? [0, -0.6] : actor && frame >= realQ ? [clamp((heroX - x) / 300, -1, 1), 0] : [0, -0.6]} sweat={isHero && frame >= realQ ? 1 : 0} brows={isHero && frame >= realQ ? 'worried' : 'none'} />
                    {actor && <g opacity={pop(frame, secret + i * 2, 10)}><rect x={x - 52} y={FLOOR - 170} width={104} height={40} rx={10} fill="#140508" stroke={COLORS.red} strokeWidth={3} /><text x={x} y={FLOOR - 139} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={30} fill={COLORS.red}>ACTOR</text></g>}
                    <SpeechBubble x={x} y={FLOOR - 375} tx={x} ty={FLOOR - 305} text={isHero ? '...A' : 'A'} scale={isHero ? pop(frame, many + 6, 10) : pop(frame, sayT, 11)} w={isHero ? 120 : 90} h={76} size={44}
                      color={isHero ? '#fff' : '#ffe1e4'} border={isHero ? '#000' : COLORS.red} />
                  </g>
                );
              })}
            </Stage>
          </AbsoluteFill>
        )}
        {frame >= aloneAt - 4 && (
          <AbsoluteFill style={{opacity: prog(frame, aloneAt - 4, 8)}}>
            <Stage>
              <path d={`M 160 300 L 380 300 L 520 ${FLOOR} L 20 ${FLOOR} Z`} fill="rgba(160,210,255,0.08)" />
              {new Array(7).fill(0).map((_, i) => (
                <Stickman key={i} x={600 + (i % 4) * 120 + (i >= 4 ? 60 : 0)} y={FLOOR - (i >= 4 ? 80 : 0)} scale={0.85} flip={-1} pose={idle(POSES.crossed, frame, `g${i}`)} variant="crowd" frame={frame} eyes="narrow" mouth="flat" blinkSeed={i} opacity={i >= 4 ? 0.7 : 1} />
              ))}
              <Stickman x={lerp(270, 520, walkToGroup)} y={FLOOR + 20} scale={1.1} pose={walkToGroup > 0 && walkToGroup < 1 ? walkPose(frame, 0.6) : idle(POSES.hesitant, frame, 'al')} variant="hero" frame={frame} eyes="sad" mouth="worried" brows="worried" />
            </Stage>
          </AbsoluteFill>
        )}
      </Camera>
      <Tag text="SOLOMON ASCH · 1950s" at={B('asch') - 4} out={L('a5')} x="50%" y="17%" color={COLORS.blue} size={38} />
      <Tag text="WHICH LINE MATCHES?" at={linesAt} out={obvious + 30} x="50%" y="17%" color={COLORS.yellow} size={38} />
      <Tag text="THE OTHERS WERE ACTORS" at={secret + 4} out={realQ} x="50%" y="17%" color={COLORS.red} size={38} solid />
      <Tag text="~75% WENT ALONG AT LEAST ONCE" at={many + 4} out={aloneAt - 2} x="50%" y="17%" color={COLORS.yellow} size={34} />
      <Tag text="ALONE" at={aloneAt + 6} out={endAt - 4} x="22%" y="30%" color={COLORS.blue} size={38} />
      <GlitchBurst at={secret} />
      <Flash at={labAt} dur={6} max={0.5} />
      <EndStatement at={endAt + 2} y="36%" size={112} lines={[{text: 'THE CROWD'}, {text: "ISN'T ALWAYS"}, {text: 'RIGHT.', color: COLORS.red}]} />
      {frame >= endHit - 2 && (
        <AbsoluteFill style={{background: '#06070a'}}>
          <EndStatement at={endHit} y="38%" size={150} lines={[{text: "IT'S JUST"}, {text: 'THE CROWD.', color: COLORS.red}]} />
        </AbsoluteFill>
      )}
      <Flash at={endHit} dur={8} max={0.8} />
    </AbsoluteFill>
  );
};

export const Short01Conformity: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => (
  <ShortFrame tl={TIMELINES.short1} audio="audio/short1_mix.wav" title="THE POWER OF THE CROWD" withAudio={withAudio}>
    <Content />
  </ShortFrame>
);
