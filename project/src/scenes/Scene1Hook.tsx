import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI, clamp, easeOut, lerp, map, pop, prog, shakeAt, wiggle} from '../lib/anim';
import {useTimeline} from '../lib/timeline';
import {Backdrop, Camera, FilmLook, Flash, GlitchBurst, Letterbox, Particles, Stage} from '../components/Atmosphere';
import {POSES, Stickman, idle, mixPose, walkPose, worldJoint} from '../components/Stickman';
import {PuppetStrings} from '../components/Props';

const FLOOR = 870;
const S = 1.55; // hero scale

/** Floating advert / misinformation / memory cards around the hero. */
const FloatCard: React.FC<{x: number; y: number; at: number; frame: number; kind: 'ad' | 'news' | 'memory'; text: string; seed: string; rot?: number; out: number}> = ({x, y, at, frame, kind, text, seed, rot = 0, out}) => {
  const s = pop(frame, at, 9);
  if (s <= 0) return null;
  const o = 1 - prog(frame, out, 12);
  const fx = x + wiggle(frame, seed + 'x', 14, 0.5) - prog(frame, out, 14) * 80;
  const fy = y + wiggle(frame, seed + 'y', 12, 0.5);
  const glitch = kind !== 'ad' && random(`${seed}${Math.floor(frame / 3)}`) < 0.18 ? (random(`${seed}g${frame}`) - 0.5) * 22 : 0;
  const w = kind === 'memory' ? 220 : 280, h = kind === 'memory' ? 200 : 110;
  return (
    <g transform={`translate(${fx + glitch} ${fy}) rotate(${rot + wiggle(frame, seed + 'r', 4, 0.4)}) scale(${s})`} opacity={o}>
      {kind === 'ad' && (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12} fill={COLORS.yellow} stroke="#0b0c10" strokeWidth={5} />
          <text y={14} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={46} fill={COLORS.red}>{text}</text>
        </g>
      )}
      {kind === 'news' && (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8} fill="#f4f4f2" />
          <rect x={-w / 2} y={-h / 2} width={w} height={34} rx={8} fill={COLORS.red} />
          <text x={-w / 2 + 14} y={-h / 2 + 25} fontFamily={FONT_UI} fontWeight={900} fontSize={22} fill="#fff">BREAKING</text>
          <text y={36} textAnchor="middle" fontFamily={FONT_UI} fontWeight={900} fontSize={30} fill="#111">{text}</text>
        </g>
      )}
      {kind === 'memory' && (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#e9e4d8" />
          <rect x={-w / 2 + 14} y={-h / 2 + 14} width={w - 28} height={h - 60} fill="#2a3340" />
          <g opacity={0.8} transform={`translate(${-20 + glitch} ${h / 2 - 60}) scale(0.32)`}>
            <Stickman x={-60} y={0} pose={POSES.wave} variant="crowd" frame={frame} />
            <Stickman x={90} y={0} pose={POSES.stand} variant="crowd" flip={-1} frame={frame} />
          </g>
          <text y={h / 2 - 16} textAnchor="middle" fontFamily={FONT_UI} fontWeight={800} fontSize={22} fill="#333">{text}</text>
          <rect x={-w / 2} y={-h / 2 + ((frame * 7) % h)} width={w} height={8} fill={COLORS.blue} opacity={0.35} />
        </g>
      )}
    </g>
  );
};

/** Close-up of the hero's eye with the puppeteer reflected in the pupil. */
const EyeCloseUp: React.FC<{frame: number; start: number; opacity: number}> = ({frame, start, opacity}) => {
  if (opacity <= 0) return null;
  const t = frame - start;
  const z = 1 + t * 0.004;
  const dart = wiggle(frame, 'eyedart', 10, 2.2);
  return (
    <AbsoluteFill style={{opacity}}>
      <Stage>
        <defs>
          <radialGradient id="skin" cx="50%" cy="45%" r="70%">
            <stop offset="0" stopColor="#fafafa" />
            <stop offset="1" stopColor="#9a9a9a" />
          </radialGradient>
          <radialGradient id="iris" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.82" stopColor="#0b0b0d" />
            <stop offset="1" stopColor="#30343c" />
          </radialGradient>
          <clipPath id="pupilClip"><ellipse cx={0} cy={0} rx={230} ry={330} /></clipPath>
        </defs>
        <rect width={1920} height={1080} fill="url(#skin)" />
        <g transform={`translate(${960 + dart} 540) scale(${z})`}>
          <ellipse cx={0} cy={0} rx={230} ry={330} fill="url(#iris)" />
          <g clipPath="url(#pupilClip)">
            {/* reflection: puppeteer + strings */}
            <g opacity={0.8} transform="translate(0 120) scale(0.75)">
              <Stickman x={0} y={140} scale={1.2} variant="shadow" pose={POSES.pointUp} eyes="angry" frame={frame} eyeGlow />
              {[-60, -20, 20, 60].map((x, i) => <line key={i} x1={x * 2} y1={-480} x2={x * 0.9} y2={-120} stroke={COLORS.red} strokeWidth={3} opacity={0.7} />)}
            </g>
          </g>
          <ellipse cx={-80} cy={-160} rx={46} ry={62} fill="#fff" opacity={0.85} />
          <ellipse cx={70} cy={150} rx={16} ry={22} fill="#fff" opacity={0.4} />
        </g>
      </Stage>
    </AbsoluteFill>
  );
};

/** "Hidden world": rows of stickmen all hanging from strings that vanish into darkness. */
const HiddenWorld: React.FC<{frame: number; start: number; opacity: number}> = ({frame, start, opacity}) => {
  if (opacity <= 0) return null;
  const t = frame - start;
  const zoom = 1.25 - prog(frame, start, 90, easeOut) * 0.25;
  return (
    <AbsoluteFill style={{opacity}}>
      <Backdrop top="#0d0507" bottom="#020203" light="rgba(255,46,63,0.18)" lightY={20} floorY={null} />
      <Camera zoom={zoom}>
        <Stage>
          {[0, 1, 2].map((row) => {
            const n = 9 + row * 3;
            const sc = 0.55 - row * 0.12;
            const y = 900 - row * 120;
            return (
              <g key={row} opacity={1 - row * 0.28}>
                {new Array(n).fill(0).map((_, i) => {
                  const x = ((i + 0.5) / n) * 1920 + (row % 2) * 40;
                  const p = idle(POSES.marionette, frame + i * 7, `hw${row}${i}`, 2);
                  const hand1 = worldJoint(p, 'lHand', x, y, sc);
                  const hand2 = worldJoint(p, 'rHand', x, y, sc);
                  const head = worldJoint(p, 'head', x, y, sc);
                  const bob = Math.sin((frame + i * 9) / 14) * 6;
                  return (
                    <g key={i} transform={`translate(0 ${bob})`}>
                      {[hand1, head, hand2].map((pt, k) => (
                        <line key={k} x1={pt[0] + (k - 1) * 10} y1={-50} x2={pt[0]} y2={pt[1]} stroke="rgba(255,90,100,0.45)" strokeWidth={1.6} />
                      ))}
                      <Stickman x={x} y={y} scale={sc} pose={p} variant={row === 0 && i === Math.floor(n / 2) ? 'hero' : 'crowd'} eyes="dots" mouth="none" frame={frame + i} blinkSeed={`${row}${i}`} />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </Stage>
      </Camera>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, transparent 35%)'}} />
      <div style={{position: 'absolute', top: 120 + (1 - prog(frame, start + 6, 20, easeOut)) * 30, width: '100%', textAlign: 'center', opacity: prog(frame, start + 6, 20), fontFamily: FONT_UI, fontWeight: 800, fontSize: 38, letterSpacing: 16, color: '#ff9aa3'}}>
        THE HIDDEN WORLD OF
      </div>
      <div style={{position: 'absolute', top: 172, width: '100%', textAlign: 'center', opacity: prog(frame, start + 18, 20), fontFamily: FONT_TITLE, fontSize: 96, letterSpacing: 8, color: COLORS.white, textShadow: `0 0 40px ${COLORS.red}`}}>
        PSYCHOLOGICAL MANIPULATION
      </div>
      <Flash at={start} color="#fff" dur={10} max={0.7} />
    </AbsoluteFill>
  );
};

/** Main title card. */
const TitleCard: React.FC<{frame: number; hit: number; sub: number}> = ({frame, hit, sub}) => {
  if (frame < hit - 1) return null;
  const sh = shakeAt(frame, hit, 22, 10);
  const p1 = prog(frame, hit - 2, 8, easeOut);
  const p2 = pop(frame, hit, 9);
  const subP = prog(frame, sub, 16, easeOut);
  const barDrop = prog(frame, hit - 6, 16, easeOut);
  const zoom = 1 + (frame - hit) * 0.0012;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 60% 55% at 50% 52%, #2a0a0f 0%, #07080b 75%)'}}>
      <Particles count={60} color="#ff8a94" seed="title" opacity={0.45} />
      <AbsoluteFill style={{transform: `translate(${sh.x}px, ${sh.y}px) scale(${zoom})`}}>
        <Stage>
          <PuppetStrings frame={frame} bar={[960, 120 - (1 - barDrop) * 300]} rot={wiggle(frame, 'tb', 3, 0.5)} barWidth={520}
            targets={[[560, 430], [780, 400], [960, 395], [1140, 400], [1360, 430]]} draw={barDrop} color="rgba(255,120,130,0.55)" />
        </Stage>
        <div style={{position: 'absolute', top: 420, width: '100%', textAlign: 'center'}}>
          <div style={{fontFamily: FONT_TITLE, fontSize: 92, letterSpacing: 10, color: COLORS.white, opacity: p1, transform: `scale(${1 + (1 - p1) * 0.6})`}}>HOW EASILY CAN SOMEONE</div>
          <div style={{fontFamily: FONT_TITLE, fontSize: 168, letterSpacing: 8, lineHeight: 1.05, transform: `scale(${p2})`, color: COLORS.white, textShadow: `0 0 40px ${COLORS.red}, 0 0 120px ${COLORS.red}88`}}>
            <span style={{color: COLORS.red}}>CONTROL</span> YOUR MIND?
          </div>
          <div style={{marginTop: 26, fontFamily: FONT_UI, fontWeight: 800, fontSize: 40, letterSpacing: 14, color: COLORS.blue, opacity: subP, transform: `translateY(${(1 - subP) * 20}px)`}}>
            THE PSYCHOLOGY OF MANIPULATION
          </div>
        </div>
      </AbsoluteFill>
      <Flash at={hit} color="#fff" dur={9} max={0.9} />
      <GlitchBurst at={hit} dur={8} />
    </AbsoluteFill>
  );
};

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const {L, E, B} = useTimeline();
  const walkStart = B('walkStart'), walkStop = B('walkStop');
  const shadowAt = B('shadowHit');
  const stringsAt = B('stringsDrop');
  const freeze = B('freeze');
  const eyeZoom = B('eyeZoom');
  const welcome = B('welcome');
  const titleHit = B('titleHit');

  // hero path: walk from left to centre, then gets "caught" by strings
  const walkT = clamp((frame - walkStart) / (walkStop - walkStart));
  const heroX = lerp(330, 900, walkT);
  const walking = frame >= walkStart && frame < walkStop;
  const caught = prog(frame, stringsAt, 16, easeOut);
  const jerk = frame > stringsAt ? Math.sin((frame - stringsAt) / 5) * 10 * Math.exp(-(frame - stringsAt) / 40) : 0;
  const barRot = wiggle(frame, 'bar', 9, 0.9) + jerk;
  let pose = walking ? walkPose(frame - walkStart) : idle(POSES.stand, frame, 'hero');
  if (frame >= walkStop) {
    const mar = {...POSES.marionette, ra1: POSES.marionette.ra1 + barRot * 2, la1: POSES.marionette.la1 + barRot * 2, head: 14 + barRot, lean: barRot * 0.4};
    pose = mixPose(idle(POSES.stand, frame, 'hero'), mar, caught);
  }
  const frozen = frame >= freeze;
  const heroY = FLOOR - caught * 26 + (frame >= walkStop ? Math.sin(frame / 9) * 4 : 0);

  // shadow puppeteer behind the hero
  const shadowIn = prog(frame, shadowAt - 10, 30, easeOut);
  const shadowX = heroX - 360 + wiggle(frame, 'shx', 10, 0.3);
  const shadowPose = mixPose(POSES.stand, POSES.pointUp, prog(frame, stringsAt - 8, 14));
  const shadowHand = worldJoint(shadowPose, 'rHand', shadowX, FLOOR + 10, 2.7);
  const bar: [number, number] = [shadowHand[0] + 230, Math.min(shadowHand[1], 300) - 20];
  const targets = [worldJoint(pose, 'lHand', heroX, heroY, S), worldJoint(pose, 'head', heroX, heroY, S), worldJoint(pose, 'rHand', heroX, heroY, S)];
  targets[1] = [targets[1][0], targets[1][1] - 38 * S];

  // camera: slow follow, then push to the face, then zoom into the eye
  const camX = (heroX - 960) * 0.35;
  const push = prog(frame, freeze, 50, easeOut);
  const eyeP = prog(frame, eyeZoom, 22, (t) => t * t * t);
  const headPt = worldJoint(pose, 'head', heroX, heroY, S);
  const zoom = 1 + push * 0.8 + eyeP * 9;
  const originX = (headPt[0] / 1920) * 100;
  const originY = ((headPt[1] - 6) / 1080) * 100;
  const sh = shakeAt(frame, shadowAt, 10, 14);

  const eyeOpacity = clamp((frame - eyeZoom - 16) / 6) * (1 - clamp((frame - welcome) / 4));
  const worldOpacity = clamp((frame - welcome) / 3) * (1 - prog(frame, titleHit - 3, 4));
  const cardsOut = freeze;

  return (
    <AbsoluteFill>
      <Backdrop top="#101217" bottom="#050608" light={`rgba(${Math.round(56 + 200 * shadowIn)},${Math.round(182 - 130 * shadowIn)},${Math.round(255 - 190 * shadowIn)},0.16)`} lightX={45} lightY={35} floorY={FLOOR} />
      <Particles count={45} seed="hook" opacity={0.35} />
      <Camera zoom={zoom} x={camX * (1 - push)} shake={sh} originX={originX + (camX / 1920) * 100 * (1 - push)} originY={originY}>
        <Stage>
          {/* street lamp cone */}
          <path d={`M 860 0 L 1160 0 L 1500 ${FLOOR} L 520 ${FLOOR} Z`} fill="url(#cone)" opacity={0.6} />
          <defs>
            <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9fd8ff" stopOpacity={0.16} />
              <stop offset="1" stopColor="#9fd8ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* shadow puppeteer */}
          <g opacity={shadowIn * (frozen ? 1 - prog(frame, freeze, 20) * 0.5 : 1)}>
            <Stickman x={shadowX} y={FLOOR + 10} scale={2.7} variant="shadow" pose={idle(shadowPose, frame, 'sh', 0.6)} eyes="angry" mouth="none" frame={frame} blur={2} eyeGlow />
          </g>
          {/* strings */}
          {frame >= stringsAt - 2 && (
            <PuppetStrings frame={frame} bar={bar} rot={barRot} targets={targets} draw={prog(frame, stringsAt - 2, 12, easeOut)} color="rgba(255,255,255,0.7)" barColor="#26070b" barWidth={240} />
          )}
          {/* floating cards */}
          <FloatCard frame={frame} at={B('adBuy')} x={heroX + 330} y={330} kind="ad" text="BUY NOW!" seed="c1" rot={-6} out={cardsOut} />
          <FloatCard frame={frame} at={B('adBuy') + 6} x={heroX - 330} y={480} kind="ad" text="50% OFF" seed="c2" rot={5} out={cardsOut} />
          <FloatCard frame={frame} at={B('adBelieve')} x={heroX + 420} y={560} kind="news" text="TRUST US." seed="c3" rot={4} out={cardsOut} />
          <FloatCard frame={frame} at={B('adBelieve') + 6} x={heroX - 120} y={210} kind="news" text="EVERYONE AGREES" seed="c4" rot={-3} out={cardsOut} />
          <FloatCard frame={frame} at={B('adDoubt')} x={heroX + 250} y={140} kind="memory" text="DID IT HAPPEN?" seed="c5" rot={8} out={cardsOut} />
          <FloatCard frame={frame} at={B('adDoubt') + 5} x={heroX - 430} y={260} kind="memory" text="SUMMER 2019?" seed="c6" rot={-9} out={cardsOut} />
          {/* hero */}
          <Stickman x={heroX} y={heroY} scale={S} pose={pose} variant="hero" frame={frame}
            eyes={frame >= freeze ? 'wide' : frame >= stringsAt ? 'wide' : 'normal'}
            mouth={frame >= freeze ? 'o' : frame >= stringsAt ? 'worried' : 'flat'}
            brows={frame >= stringsAt ? 'worried' : 'none'} look={frame >= freeze ? [0, 0] : [0.35, 0]} sweat={frame >= L('h2') ? 0.9 : 0} />
        </Stage>
      </Camera>
      {/* darken during the freeze */}
      <AbsoluteFill style={{background: '#000', opacity: prog(frame, freeze, 20) * 0.35 * (1 - eyeP)}} />
      <Letterbox amount={prog(frame, freeze, 20)} />
      <EyeCloseUp frame={frame} start={eyeZoom + 16} opacity={eyeOpacity} />
      <HiddenWorld frame={frame} start={welcome} opacity={worldOpacity} />
      <TitleCard frame={frame} hit={titleHit} sub={B('subtitleHit')} />
      <FilmLook vignette={0.8} grain={0.3} />
      <Flash at={E('h4') + 1} color="#000" dur={1} max={0} />
    </AbsoluteFill>
  );
};
