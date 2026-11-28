import {Easing, interpolate, random, spring} from 'remotion';

export const FPS = 30;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0..1 progress of `frame` through [start, start+dur], eased (default: cubic in-out). */
export const prog = (frame: number, start: number, dur: number, ease: (t: number) => number = Easing.inOut(Easing.cubic)) =>
  ease(clamp((frame - start) / Math.max(1, dur)));

export const easeOut = Easing.out(Easing.cubic);
export const easeIn = Easing.in(Easing.cubic);
export const easeBack = Easing.out(Easing.back(1.8));

/** Springy pop 0..~1.1..1 starting at `start`. */
export const pop = (frame: number, start: number, damping = 11, stiffness = 160) =>
  frame < start ? 0 : spring({frame: frame - start, fps: FPS, config: {damping, stiffness, mass: 0.6}});

/** Fade in at `a`, fade out at `b` (frames), with `d` frame ramps. */
export const inOut = (frame: number, a: number, b: number, d = 10) =>
  clamp(Math.min((frame - a) / d, (b - frame) / d));

/** Smooth pseudo-noise built from detuned sines (deterministic). */
export const wiggle = (frame: number, seed: number | string, amp = 1, freq = 1) => {
  const p1 = random(`${seed}-a`) * 100;
  const p2 = random(`${seed}-b`) * 100;
  const p3 = random(`${seed}-c`) * 100;
  const t = (frame / FPS) * freq;
  return amp * (0.55 * Math.sin(t * 2.1 + p1) + 0.3 * Math.sin(t * 3.7 + p2) + 0.15 * Math.sin(t * 7.3 + p3));
};

/** Camera shake that decays after `start`. */
export const shakeAt = (frame: number, start: number, amp = 14, decay = 12) => {
  if (frame < start) return {x: 0, y: 0};
  const k = Math.exp(-(frame - start) / decay);
  return {x: wiggle(frame, `sx${start}`, amp * k, 18), y: wiggle(frame, `sy${start}`, amp * k, 18)};
};

export const map = (frame: number, input: number[], output: number[], ease?: (t: number) => number) =>
  interpolate(frame, input, output, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

export const COLORS = {
  bg: '#0b0c10',
  bg2: '#15171d',
  white: '#f4f4f2',
  grey: '#8d96a3',
  dim: '#4a505a',
  red: '#ff2e3f',
  redDeep: '#8a0d18',
  blue: '#38b6ff',
  blueDeep: '#0d3b66',
  yellow: '#ffd23f',
  green: '#3ddc84',
};

export const FONT_TITLE = 'Anton, Impact, sans-serif';
export const FONT_UI = 'Montserrat, Arial, sans-serif';
