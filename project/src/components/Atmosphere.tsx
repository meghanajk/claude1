import React from 'react';
import {AbsoluteFill, Img, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, wiggle} from '../lib/anim';

/** Dark cinematic background: gradient, light pool, optional floor and haze. */
export const Backdrop: React.FC<{
  top?: string; bottom?: string; light?: string; lightX?: number; lightY?: number; lightSize?: number;
  floorY?: number | null; floorColor?: string; intensity?: number;
}> = ({top = '#14161c', bottom = '#060709', light = 'rgba(56,182,255,0.10)', lightX = 50, lightY = 40, lightSize = 60, floorY = null, floorColor = 'rgba(255,255,255,0.10)', intensity = 1}) => {
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse ${lightSize}% ${lightSize * 0.8}% at ${lightX}% ${lightY}%, ${light} 0%, transparent 70%)`, opacity: intensity}} />
      {floorY !== null && (
        <svg width={width} height={height} style={{position: 'absolute'}}>
          <defs>
            <linearGradient id="floorFade" x1="0" x2="1">
              <stop offset="0" stopColor={floorColor} stopOpacity={0} />
              <stop offset="0.5" stopColor={floorColor} stopOpacity={1} />
              <stop offset="1" stopColor={floorColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity={0} />
              <stop offset="1" stopColor="#000" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <rect x={0} y={floorY} width={width} height={height - floorY} fill="url(#floorShade)" />
          <rect x={0} y={floorY - 1} width={width} height={3} fill="url(#floorFade)" />
        </svg>
      )}
    </AbsoluteFill>
  );
};

/** Floating dust particles (deterministic). */
export const Particles: React.FC<{count?: number; color?: string; seed?: string; speed?: number; opacity?: number}> = ({count = 40, color = '#ffffff', seed = 'p', speed = 1, opacity = 0.5}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <svg width={width} height={height} style={{position: 'absolute', pointerEvents: 'none'}}>
      {new Array(count).fill(0).map((_, i) => {
        const r = random(`${seed}${i}`);
        const x0 = random(`${seed}x${i}`) * width;
        const y0 = random(`${seed}y${i}`) * height;
        const vy = (6 + r * 18) * speed;
        const y = (((y0 - frame * vy * 0.033) % height) + height) % height;
        const x = x0 + wiggle(frame, `${seed}w${i}`, 25, 0.3);
        const size = 1 + r * 2.6;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 25 + i));
        return <circle key={i} cx={x} cy={y} r={size} fill={color} opacity={opacity * tw * (0.3 + r * 0.7)} />;
      })}
    </svg>
  );
};

/** Film grain + vignette overlay (cheap: one tiled texture shifted every frame). */
export const FilmLook: React.FC<{vignette?: number; grain?: number; tint?: string}> = ({vignette = 0.75, grain = 0.35, tint}) => {
  const frame = useCurrentFrame();
  // grain pattern changes every 3 frames (film-like, and far cheaper to encode than per-frame noise)
  const g = Math.floor(frame / 3);
  const ox = Math.floor(random(`gx${g}`) * 512);
  const oy = Math.floor(random(`gy${g}`) * 512);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {tint && <AbsoluteFill style={{background: tint, mixBlendMode: 'overlay'}} />}
      <AbsoluteFill style={{backgroundImage: `url(${staticFile('textures/grain.png')})`, backgroundPosition: `${ox}px ${oy}px`, opacity: grain * 0.4, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 45%, rgba(0,0,0,${vignette}) 100%)`}} />
    </AbsoluteFill>
  );
};

/** Camera rig: zoom/pan (in px, relative to frame center) + shake + rotation. */
export const Camera: React.FC<{zoom?: number; x?: number; y?: number; rotate?: number; shake?: {x: number; y: number}; originX?: number; originY?: number; children: React.ReactNode}> = ({
  zoom = 1, x = 0, y = 0, rotate = 0, shake = {x: 0, y: 0}, originX = 50, originY = 50, children,
}) => (
  <AbsoluteFill style={{transform: `translate(${-x + shake.x}px, ${-y + shake.y}px) scale(${zoom}) rotate(${rotate}deg)`, transformOrigin: `${originX}% ${originY}%`}}>
    {children}
  </AbsoluteFill>
);

/** Full-frame SVG canvas in the composition's coordinate space. */
export const Stage: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => {
  const {width, height} = useVideoConfig();
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', overflow: 'visible', ...style}}>
      {children}
    </svg>
  );
};

/** Quick white/red flash for hard cuts. */
export const Flash: React.FC<{at: number; color?: string; dur?: number; max?: number}> = ({at, color = '#fff', dur = 8, max = 0.85}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > dur) return null;
  return <AbsoluteFill style={{background: color, opacity: max * (1 - t / dur), pointerEvents: 'none'}} />;
};

/** RGB-split glitch slices over the whole frame for a few frames. */
export const GlitchBurst: React.FC<{at: number; dur?: number; strength?: number}> = ({at, dur = 9, strength = 1}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = frame - at;
  if (t < 0 || t > dur) return null;
  const k = 1 - t / dur;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {new Array(7).fill(0).map((_, i) => {
        const y = random(`gy${at}${i}${Math.floor(t / 2)}`) * height;
        const h = 6 + random(`gh${at}${i}${t}`) * 60;
        const dx = (random(`gd${at}${i}${t}`) - 0.5) * 120 * k * strength;
        const c = i % 3 === 0 ? 'rgba(255,46,63,0.55)' : i % 3 === 1 ? 'rgba(56,182,255,0.5)' : 'rgba(255,255,255,0.25)';
        return <div key={i} style={{position: 'absolute', left: dx, top: y, width, height: h, background: c, mixBlendMode: 'screen'}} />;
      })}
    </AbsoluteFill>
  );
};

export const Letterbox: React.FC<{amount?: number}> = ({amount = 0}) => {
  const {height} = useVideoConfig();
  const h = (height * 0.11) * amount;
  if (h <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: h, background: '#000'}} />
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: h, background: '#000'}} />
    </AbsoluteFill>
  );
};

export const BG = COLORS.bg;
