import React from 'react';
import {random} from 'remotion';
import {COLORS, wiggle} from '../lib/anim';

/**
 * FACTMAN stickman rig.
 * Angles are in degrees measured from "hanging straight down"; positive rotates toward the
 * direction the character faces (+x when flip = 1). Elbow/knee angles are relative to the upper limb.
 */
export type Pose = {
  lean: number; head: number;
  la1: number; la2: number; ra1: number; ra2: number;
  ll1: number; ll2: number; rl1: number; rl2: number;
  crouch: number;
};

export const POSES: Record<string, Pose> = {
  stand:     {lean: 0, head: 0, la1: -10, la2: -6, ra1: 10, ra2: 6, ll1: -7, ll2: 0, rl1: 7, rl2: 0, crouch: 0},
  point:     {lean: 4, head: -4, la1: -12, la2: -8, ra1: 92, ra2: -4, ll1: -8, ll2: 0, rl1: 10, rl2: 0, crouch: 0},
  pointUp:   {lean: -3, head: -10, la1: -12, la2: -8, ra1: 150, ra2: 0, ll1: -8, ll2: 0, rl1: 8, rl2: 0, crouch: 0},
  think:     {lean: 2, head: -8, la1: -6, la2: 80, ra1: 22, ra2: 138, ll1: -6, ll2: 0, rl1: 6, rl2: 0, crouch: 0},
  shrug:     {lean: 0, head: 10, la1: -48, la2: -80, ra1: 48, ra2: 80, ll1: -7, ll2: 0, rl1: 7, rl2: 0, crouch: 0},
  scared:    {lean: -8, head: -6, la1: -140, la2: -45, ra1: 140, ra2: 45, ll1: -12, ll2: 6, rl1: 10, rl2: -6, crouch: 6},
  slump:     {lean: 16, head: 26, la1: 4, la2: 0, ra1: 12, ra2: 2, ll1: -5, ll2: 4, rl1: 6, rl2: -4, crouch: 8},
  confident: {lean: -2, head: -6, la1: -42, la2: 88, ra1: 42, ra2: -88, ll1: -13, ll2: 0, rl1: 13, rl2: 0, crouch: 0},
  wave:      {lean: 0, head: -4, la1: -10, la2: -6, ra1: 150, ra2: 20, ll1: -7, ll2: 0, rl1: 7, rl2: 0, crouch: 0},
  reach:     {lean: 12, head: -6, la1: -20, la2: -10, ra1: 80, ra2: -2, ll1: -14, ll2: 0, rl1: 16, rl2: 0, crouch: 2},
  crossed:   {lean: -2, head: 4, la1: -8, la2: 100, ra1: 8, ra2: -100, ll1: -9, ll2: 0, rl1: 9, rl2: 0, crouch: 0},
  marionette:{lean: 0, head: 14, la1: -118, la2: 35, ra1: 118, ra2: -35, ll1: -6, ll2: 8, rl1: 8, rl2: -8, crouch: -6},
  handsHead: {lean: 4, head: 10, la1: -150, la2: -115, ra1: 150, ra2: 115, ll1: -8, ll2: 0, rl1: 8, rl2: 0, crouch: 2},
  talk:      {lean: 4, head: -4, la1: -12, la2: -10, ra1: 55, ra2: 55, ll1: -7, ll2: 0, rl1: 9, rl2: 0, crouch: 0},
  defiant:   {lean: -2, head: -12, la1: -14, la2: -10, ra1: 170, ra2: 4, ll1: -12, ll2: 0, rl1: 12, rl2: 0, crouch: 0},
  hesitant:  {lean: 6, head: 18, la1: -8, la2: 40, ra1: 28, ra2: 70, ll1: -5, ll2: 0, rl1: 5, rl2: 0, crouch: 2},
  shield:    {lean: -4, head: -2, la1: -30, la2: -60, ra1: 85, ra2: 80, ll1: -13, ll2: 0, rl1: 13, rl2: 0, crouch: 0},
};

export const mixPose = (a: Pose, b: Pose, t: number): Pose => {
  const o = {} as Pose;
  (Object.keys(a) as (keyof Pose)[]).forEach((k) => (o[k] = a[k] + (b[k] - a[k]) * t));
  return o;
};

/** Natural walk cycle. One full cycle = 24 frames (0.8 s) = two steps (matches footstep SFX). */
export const walkPose = (frame: number, energy = 1): Pose => {
  const ph = (frame / 24) * Math.PI * 2;
  const s = Math.sin(ph);
  return {
    lean: 5 * energy, head: -3,
    ll1: 26 * s * energy, ll2: -(10 + 22 * Math.max(0, Math.cos(ph))) * energy,
    rl1: -26 * s * energy, rl2: -(10 + 22 * Math.max(0, -Math.cos(ph))) * energy,
    la1: 22 * s * energy - 4, la2: 14 + 8 * energy,
    ra1: -22 * s * energy + 4, ra2: 14 + 8 * energy,
    crouch: 3 * Math.abs(Math.cos(ph)) * energy,
  };
};

/** Subtle breathing / idle motion layered on any pose. */
export const idle = (p: Pose, frame: number, seed: string | number = 0, amt = 1): Pose => ({
  ...p,
  head: p.head + wiggle(frame, `h${seed}`, 3 * amt, 0.6),
  la1: p.la1 + wiggle(frame, `la${seed}`, 3 * amt, 0.5),
  ra1: p.ra1 + wiggle(frame, `ra${seed}`, 3 * amt, 0.5),
  lean: p.lean + wiggle(frame, `l${seed}`, 1.2 * amt, 0.4),
  crouch: p.crouch + (Math.sin((frame / 30) * 2.4 + Number(String(seed).length)) * 1.2 * amt),
});

const R = (d: number) => (d * Math.PI) / 180;
const THIGH = 60, SHIN = 60, TORSO = 96, UPPER = 52, FORE = 50, HEAD_R = 38, NECK = 8;

export type Joints = {
  hip: [number, number]; neck: [number, number]; shoulder: [number, number]; head: [number, number];
  lElbow: [number, number]; lHand: [number, number]; rElbow: [number, number]; rHand: [number, number];
  lKnee: [number, number]; lFoot: [number, number]; rKnee: [number, number]; rFoot: [number, number];
};

const dir = (deg: number, len: number): [number, number] => [Math.sin(R(deg)) * len, Math.cos(R(deg)) * len];
const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]];

export const computeJoints = (p: Pose): Joints => {
  const legY = (a1: number, a2: number) => Math.cos(R(a1)) * THIGH + Math.cos(R(a1 + a2)) * SHIN;
  const hipH = Math.max(legY(p.ll1, p.ll2), legY(p.rl1, p.rl2));
  const hip: [number, number] = [0, -hipH + p.crouch];
  const up = (len: number): [number, number] => [Math.sin(R(p.lean)) * len, -Math.cos(R(p.lean)) * len];
  const neck = add(hip, up(TORSO));
  const shoulder = add(hip, up(TORSO * 0.86));
  const headDir = p.lean + p.head * 0.35;
  const head = add(neck, [Math.sin(R(headDir)) * (NECK + HEAD_R), -Math.cos(R(headDir)) * (NECK + HEAD_R)]);
  const lElbow = add(shoulder, dir(p.la1 + p.lean, UPPER));
  const lHand = add(lElbow, dir(p.la1 + p.la2 + p.lean, FORE));
  const rElbow = add(shoulder, dir(p.ra1 + p.lean, UPPER));
  const rHand = add(rElbow, dir(p.ra1 + p.ra2 + p.lean, FORE));
  const lKnee = add(hip, dir(p.ll1, THIGH));
  const lFoot = add(lKnee, dir(p.ll1 + p.ll2, SHIN));
  const rKnee = add(hip, dir(p.rl1, THIGH));
  const rFoot = add(rKnee, dir(p.rl1 + p.rl2, SHIN));
  return {hip, neck, shoulder, head, lElbow, lHand, rElbow, rHand, lKnee, lFoot, rKnee, rFoot};
};

/** Joint position in world (svg) coordinates for a stickman placed at x,y with scale/flip. */
export const worldJoint = (p: Pose, key: keyof Joints, x: number, y: number, scale = 1, flip = 1): [number, number] => {
  const j = computeJoints(p)[key];
  return [x + j[0] * scale * flip, y + j[1] * scale];
};

export type Eyes = 'normal' | 'wide' | 'narrow' | 'closed' | 'angry' | 'spiral' | 'dots' | 'sad' | 'happy';
export type Mouth = 'smile' | 'frown' | 'flat' | 'open' | 'worried' | 'grin' | 'o' | 'smirk' | 'none' | 'shout';
export type Variant = 'hero' | 'crowd' | 'manipulator' | 'shadow' | 'ghost';

const PALETTES: Record<Variant, {outer: string | null; inner: string; outerW: number; innerW: number; head: string; headStroke: string; face: string}> = {
  hero:        {outer: COLORS.white, inner: '#0a0a0c', outerW: 15, innerW: 7, head: COLORS.white, headStroke: '#0a0a0c', face: '#0a0a0c'},
  crowd:       {outer: null, inner: '#9aa3ad', outerW: 0, innerW: 9, head: '#c3cad2', headStroke: '#2a2e35', face: '#16181c'},
  manipulator: {outer: COLORS.red, inner: '#14060a', outerW: 14, innerW: 7, head: '#1a0b0e', headStroke: COLORS.red, face: COLORS.red},
  shadow:      {outer: null, inner: '#000000', outerW: 0, innerW: 17, head: '#000000', headStroke: '#000000', face: COLORS.red},
  ghost:       {outer: null, inner: 'rgba(255,255,255,0.35)', outerW: 0, innerW: 8, head: 'rgba(255,255,255,0.18)', headStroke: 'rgba(255,255,255,0.4)', face: 'rgba(255,255,255,0.6)'},
};

export type StickmanProps = {
  x: number; y: number; scale?: number; flip?: 1 | -1;
  pose?: Pose; variant?: Variant;
  eyes?: Eyes; mouth?: Mouth; brows?: 'none' | 'worried' | 'angry' | 'raised';
  look?: [number, number];
  frame?: number; blinkSeed?: string | number;
  opacity?: number; tint?: string; headTint?: string;
  sweat?: number; glow?: string; eyeGlow?: boolean;
  blur?: number;
};

export const Stickman: React.FC<StickmanProps> = ({
  x, y, scale = 1, flip = 1, pose = POSES.stand, variant = 'hero', eyes = 'normal', mouth = 'flat', brows = 'none',
  look = [0.25, 0], frame = 0, blinkSeed = 0, opacity = 1, tint, headTint, sweat = 0, glow, eyeGlow, blur = 0,
}) => {
  const pal = PALETTES[variant];
  const j = computeJoints(pose);
  const inner = tint ?? pal.inner;
  const limb = (pts: [number, number][], back = false) => {
    const d = `M ${pts.map((p) => p.join(' ')).join(' L ')}`;
    return (
      <g opacity={back ? 0.92 : 1}>
        {pal.outer && <path d={d} stroke={pal.outer} strokeWidth={pal.outerW} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        <path d={d} stroke={inner} strokeWidth={pal.innerW} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  };
  // blink: every ~3.3 s, 4 frames
  const period = 100 + Math.floor(random(`blink${blinkSeed}`) * 40);
  const phase = (frame + Math.floor(random(`bo${blinkSeed}`) * period)) % period;
  const blink = eyes !== 'closed' && phase < 4 ? 0.12 : 1;
  const fx = look[0] * 11, fy = look[1] * 9;
  const fc = pal.face;
  const eyeGlowF = eyeGlow || variant === 'shadow' || variant === 'manipulator';

  const eye = (ex: number) => {
    const cx = ex + fx, cy = -6 + fy;
    switch (eyes) {
      case 'wide':
        return (
          <g key={ex}>
            <circle cx={cx} cy={cy} r={10} fill={variant === 'hero' || variant === 'crowd' ? '#fff' : 'none'} stroke={fc} strokeWidth={3} />
            <circle cx={cx + look[0] * 3} cy={cy + look[1] * 3} r={4.2 * blink} fill={fc} />
          </g>
        );
      case 'narrow':
        return <path key={ex} d={`M ${cx - 7} ${cy} Q ${cx} ${cy - 4} ${cx + 7} ${cy}`} stroke={fc} strokeWidth={4} fill="none" strokeLinecap="round" />;
      case 'closed':
        return <path key={ex} d={`M ${cx - 7} ${cy} Q ${cx} ${cy + 5} ${cx + 7} ${cy}`} stroke={fc} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
      case 'happy':
        return <path key={ex} d={`M ${cx - 7} ${cy + 2} Q ${cx} ${cy - 7} ${cx + 7} ${cy + 2}`} stroke={fc} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <ellipse key={ex} cx={cx} cy={cy + 2} rx={4.5} ry={5.5 * blink} fill={fc} />;
      case 'dots':
        return <circle key={ex} cx={cx} cy={cy} r={3.6 * blink} fill={fc} />;
      case 'spiral': {
        const rot = frame * 12;
        return (
          <g key={ex} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
            <path d="M0 0 C 2 -2 5 0 4 3 C 3 7 -3 7 -5 3 C -8 -2 -4 -8 2 -8 C 8 -8 11 -2 10 3" stroke={fc} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          </g>
        );
      }
      case 'angry':
      default:
        return <ellipse key={ex} cx={cx} cy={cy} rx={5} ry={7.5 * blink} fill={fc} />;
    }
  };

  const mouthPath = (() => {
    const mx = fx * 0.8, my = 16 + fy * 0.6;
    switch (mouth) {
      case 'smile': return <path d={`M ${mx - 12} ${my - 2} Q ${mx} ${my + 9} ${mx + 12} ${my - 2}`} stroke={fc} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
      case 'frown': return <path d={`M ${mx - 11} ${my + 5} Q ${mx} ${my - 5} ${mx + 11} ${my + 5}`} stroke={fc} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
      case 'open': return <ellipse cx={mx} cy={my + 2} rx={7} ry={8} fill={fc} />;
      case 'shout': return <path d={`M ${mx - 11} ${my - 3} L ${mx + 11} ${my - 3} L ${mx + 5} ${my + 10} L ${mx - 5} ${my + 10} Z`} fill={fc} />;
      case 'o': return <circle cx={mx} cy={my + 2} r={4.5} fill="none" stroke={fc} strokeWidth={3} />;
      case 'worried': return <path d={`M ${mx - 12} ${my + 3} Q ${mx - 6} ${my - 3} ${mx} ${my + 3} Q ${mx + 6} ${my + 9} ${mx + 12} ${my + 2}`} stroke={fc} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
      case 'grin': return (
        <g>
          <path d={`M ${mx - 16} ${my - 4} Q ${mx} ${my + 14} ${mx + 16} ${my - 4} Z`} fill={fc} />
          <path d={`M ${mx - 10} ${my} L ${mx - 6} ${my + 5} L ${mx - 2} ${my + 1} L ${mx + 2} ${my + 6} L ${mx + 6} ${my + 1} L ${mx + 10} ${my + 4}`} stroke={pal.head} strokeWidth={1.6} fill="none" />
        </g>
      );
      case 'smirk': return <path d={`M ${mx - 10} ${my + 2} Q ${mx + 2} ${my + 6} ${mx + 13} ${my - 5}`} stroke={fc} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
      case 'none': return null;
      case 'flat':
      default: return <path d={`M ${mx - 9} ${my + 2} L ${mx + 9} ${my + 2}`} stroke={fc} strokeWidth={3.5} strokeLinecap="round" />;
    }
  })();

  const browEls = (() => {
    if (brows === 'none') return null;
    const by = -20 + fy;
    const s = brows === 'worried' ? 1 : brows === 'angry' ? -1 : 0;
    const raise = brows === 'raised' ? -4 : 0;
    return (
      <g stroke={fc} strokeWidth={3.5} strokeLinecap="round">
        <path d={`M ${-21 + fx} ${by + raise + s * -3} L ${-7 + fx} ${by + raise + s * 3}`} />
        <path d={`M ${7 + fx} ${by + raise + s * 3} L ${21 + fx} ${by + raise + s * -3}`} />
      </g>
    );
  })();

  const filterId = `blur-${variant}-${Math.round(blur)}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * flip} ${scale})`} opacity={opacity} filter={blur ? `url(#${filterId})` : undefined}>
      {blur > 0 && (
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={blur} /></filter>
        </defs>
      )}
      {glow && (
        <g opacity={0.5}>
          <circle cx={j.head[0]} cy={j.head[1]} r={HEAD_R + 22} fill={glow} opacity={0.25} />
        </g>
      )}
      {/* back limbs */}
      {limb([j.hip, j.lKnee, j.lFoot], true)}
      {limb([j.shoulder, j.lElbow, j.lHand], true)}
      {/* torso */}
      {limb([j.hip, j.neck])}
      {/* front limbs */}
      {limb([j.hip, j.rKnee, j.rFoot])}
      {limb([j.shoulder, j.rElbow, j.rHand])}
      {/* head */}
      <g transform={`translate(${j.head[0]} ${j.head[1]}) rotate(${pose.head + pose.lean * 0.4})`}>
        {pal.outer && <circle r={HEAD_R + 3.5} fill={pal.outer} />}
        <circle r={HEAD_R} fill={headTint ?? pal.head} stroke={pal.headStroke} strokeWidth={variant === 'hero' ? 4 : 3} />
        <g filter={eyeGlowF ? undefined : undefined}>
          {eyeGlowF && (
            <g opacity={0.55}>
              <circle cx={-13 + fx} cy={-6 + fy} r={12} fill={COLORS.red} opacity={0.35} />
              <circle cx={13 + fx} cy={-6 + fy} r={12} fill={COLORS.red} opacity={0.35} />
            </g>
          )}
          {eye(-13)}
          {eye(13)}
          {browEls}
          {mouthPath}
        </g>
        {sweat > 0 && (
          <path d={`M ${30} ${-14 + (frame % 30) * 0.4} q 5 9 0 12 q -5 -3 0 -12`} fill={COLORS.blue} opacity={sweat} />
        )}
      </g>
    </g>
  );
};
