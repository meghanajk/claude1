import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, lerp, pop, prog, shakeAt} from '../lib/anim';
import {useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, Flash, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose, walkPose} from '../components/Stickman';
import {Icon} from '../components/Props';
import {LogoReveal, SubscribePill} from '../components/Brand';

const FLOOR = 900;

const TIPS = [
  {beat: 'tip1', title: 'PAUSE', sub: 'before emotional decisions', icon: Icon.pause(COLORS.white), color: COLORS.blue},
  {beat: 'tip2', title: 'QUESTION', sub: 'even when everyone agrees', icon: Icon.question(COLORS.white), color: COLORS.yellow},
  {beat: 'tip3', title: 'EVIDENCE', sub: 'over repetition', icon: Icon.magnifier(COLORS.white), color: COLORS.green},
  {beat: 'tip4', title: 'THINK INDEPENDENTLY', sub: 'without guilt', icon: Icon.bulb(COLORS.yellow), color: '#b07bff'},
];

const FINALS = [
  {beat: 'final1', text: 'QUESTION EVERYTHING.', color: COLORS.white},
  {beat: 'final2', text: 'THINK INDEPENDENTLY.', color: COLORS.blue},
  {beat: 'final3', text: 'TRUST EVIDENCE.', color: COLORS.yellow},
];

export const Scene8Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const protect = B('protect');
  const walkStart = L('n2');
  const walkEnd = E('n5');
  const shadowAt = B('momentShadow');
  const logo = B('logo');
  const slogan = B('slogan');
  const f1 = B('final1');

  // hero walks toward camera: scale grows, y moves down
  const wt = clamp((frame - walkStart) / (walkEnd - walkStart));
  const sc = lerp(1.0, 1.7, easeOut(wt));
  const hy = lerp(FLOOR - 40, 950, easeOut(wt));
  const walking = frame >= walkStart && frame < walkEnd;
  let pose = walking ? walkPose(frame - walkStart, 0.8) : idle(frame >= walkEnd ? POSES.confident : POSES.stand, frame, 'end');
  if (frame < walkStart) pose = mixPose(pose, idle(POSES.shield, frame, 'end'), prog(frame, protect - 6, 10));
  const shieldS = pop(frame, protect, 11) * (1 - prog(frame, walkStart + 20, 14));
  const tipsOut = L('n6') - 4;
  const finalsOut = logo - 6;
  const shadowP = prog(frame, shadowAt - 4, 14) * (1 - prog(frame, f1, 10));
  const sh = shakeAt(frame, f1, 16, 10);
  const heroOut = prog(frame, f1 - 6, 10);
  const logoBg = prog(frame, logo - 6, 12);

  return (
    <AbsoluteFill>
      <Backdrop top="#1d3c6e" bottom="#081226" light="rgba(255,226,170,0.35)" lightY={10} lightSize={80} floorY={FLOOR} floorColor="rgba(255,255,255,0.3)" />
      <Stage>
        {new Array(10).fill(0).map((_, i) => (
          <path key={i} d={`M 960 -200 L ${100 + i * 190 + Math.sin(frame / 40 + i) * 30} 1080 L ${150 + i * 190 + Math.sin(frame / 40 + i) * 30} 1080 Z`} fill="#fff1cf" opacity={0.045} />
        ))}
      </Stage>
      <Particles count={60} seed="end" color="#ffe8b0" opacity={0.5} speed={0.7} />
      <Camera shake={sh}>
        <Stage>
          {/* shadow reappears when "someone else" is mentioned */}
          {shadowP > 0 && <Stickman x={960 + 300} y={FLOOR + 40} scale={2.7} variant="shadow" pose={idle(POSES.pointUp, frame, 'esh')} eyes="angry" mouth="none" frame={frame} opacity={shadowP * 0.85} blur={3} eyeGlow />}
          <g opacity={1 - heroOut}>
            <g transform={`translate(${frame < walkStart ? 960 : 1300} ${hy - sc * 150}) scale(${shieldS * 4})`} opacity={0.8}>{Icon.shield(COLORS.blue)}</g>
            <Stickman x={frame < walkStart ? 960 : lerp(960, 1300, prog(frame, walkStart, 20))} y={hy} scale={sc} pose={pose} variant="hero" frame={frame}
              eyes={frame >= L('n6') ? 'narrow' : 'normal'} mouth={frame >= L('n6') ? 'flat' : 'smile'} brows={frame >= L('n6') ? 'angry' : 'none'} look={[0, 0]} />
          </g>
        </Stage>
      </Camera>
      {/* tips */}
      {frame < tipsOut + 12 && TIPS.map((t, i) => {
        const at = B(t.beat);
        const p = prog(frame, at - 4, 12, easeOut);
        if (p <= 0) return null;
        const o = 1 - prog(frame, tipsOut - i * 2, 10);
        return (
          <div key={t.title} style={{position: 'absolute', left: 110 + (1 - p) * -200, top: 150 + i * 175, opacity: p * o, display: 'flex', alignItems: 'center', gap: 28}}>
            <div style={{width: 120, height: 120, borderRadius: 60, background: '#0b1322', border: `5px solid ${t.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px ${t.color}66`}}>
              <svg width={100} height={100} viewBox="-50 -50 100 100">{t.icon}</svg>
            </div>
            <div>
              <div style={{fontFamily: FONT_TITLE, fontSize: 64, color: COLORS.white, letterSpacing: 3, lineHeight: 1}}><span style={{color: t.color}}>{i + 1}.</span> {t.title}</div>
              <div style={{fontFamily: FONT_UI, fontWeight: 800, fontSize: 30, color: '#cfe0ff', marginTop: 6}}>{t.sub}</div>
            </div>
          </div>
        );
      })}
      {/* final statements */}
      {frame >= f1 - 4 && frame < finalsOut + 12 && (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', background: `rgba(5,10,22,${0.55 * prog(frame, f1 - 4, 8)})`, opacity: 1 - prog(frame, finalsOut, 10)}}>
          {FINALS.map((fx, i) => {
            const s = pop(frame, B(fx.beat), 9);
            return (
              <div key={fx.text} style={{fontFamily: FONT_TITLE, fontSize: 132, letterSpacing: 8, color: fx.color, lineHeight: 1.15, transform: `scale(${s})`, opacity: clamp(s * 2), textShadow: `0 0 40px ${fx.color}66, 0 6px 0 rgba(0,0,0,0.5)`}}>
                {fx.text}
              </div>
            );
          })}
        </AbsoluteFill>
      )}
      {/* logo */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, #12203a 0%, #04070d 75%)`, opacity: logoBg}} />
      {frame >= logo - 6 && <Particles count={50} seed="logo" color="#9fd8ff" opacity={0.4 * logoBg} />}
      <LogoReveal at={logo} tagline="STAY CURIOUS. QUESTION EVERYTHING." taglineAt={slogan} scale={0.95} />
      <SubscribePill at={E('n9') + 10} x="50%" y="86%" />
      <Flash at={f1} dur={8} max={0.5} />
      <Flash at={logo} dur={10} max={0.7} />
      <FilmLook vignette={0.6} grain={0.25} />
    </AbsoluteFill>
  );
};
