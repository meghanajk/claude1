import React from 'react';
import {COLORS, FONT_TITLE, FONT_UI, clamp, wiggle} from '../lib/anim';

type P = [number, number];

/** Marionette control bar + strings to the given points. `draw` lowers the strings, `snap` cuts them. */
export const PuppetStrings: React.FC<{
  bar: P; targets: P[]; frame: number; draw?: number; snap?: number; opacity?: number; color?: string; barColor?: string; showBar?: boolean; barWidth?: number; rot?: number; width?: number;
}> = ({bar, targets, frame, draw = 1, snap = 0, opacity = 1, color = 'rgba(255,255,255,0.75)', barColor = COLORS.red, showBar = true, barWidth = 260, rot = 0, width = 2.2}) => {
  const ends: P[] = targets.map((_, i) => {
    const off = (i - (targets.length - 1) / 2) / Math.max(1, (targets.length - 1) / 2);
    const a = (rot * Math.PI) / 180;
    return [bar[0] + Math.cos(a) * off * barWidth * 0.5, bar[1] + Math.sin(a) * off * barWidth * 0.5];
  });
  return (
    <g opacity={opacity}>
      {targets.map((t, i) => {
        const s = ends[i];
        const ex = s[0] + (t[0] - s[0]) * draw;
        const ey = s[1] + (t[1] - s[1]) * draw;
        if (snap > 0) {
          // cut in the middle: upper half retracts upward, lower half falls
          const mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2;
          const up = clamp(snap * 1.4);
          const fall = snap * snap * 500;
          return (
            <g key={i}>
              <path d={`M ${s[0]} ${s[1]} Q ${(s[0] + mx) / 2 + wiggle(frame, i, 30 * up)} ${(s[1] + my) / 2} ${mx + (s[0] - mx) * up} ${my + (s[1] - my) * up}`} stroke={color} strokeWidth={width} fill="none" opacity={1 - up * 0.6} />
              <path d={`M ${mx + wiggle(frame, `f${i}`, 40 * snap)} ${my + fall} Q ${(mx + t[0]) / 2 + 30 * snap} ${(my + t[1]) / 2 + fall} ${t[0]} ${t[1] + fall * 0.4}`} stroke={color} strokeWidth={width} fill="none" opacity={1 - snap} />
            </g>
          );
        }
        const sag = wiggle(frame, `sag${i}`, 6, 1.4);
        return <path key={i} d={`M ${s[0]} ${s[1]} Q ${(s[0] + ex) / 2 + sag} ${(s[1] + ey) / 2} ${ex} ${ey}`} stroke={color} strokeWidth={width} fill="none" />;
      })}
      {showBar && (
        <g transform={`translate(${bar[0]} ${bar[1]}) rotate(${rot})`} opacity={1 - clamp(snap * 2)}>
          <rect x={-barWidth / 2} y={-9} width={barWidth} height={18} rx={9} fill={barColor} />
          <rect x={-9} y={-barWidth * 0.32} width={18} height={barWidth * 0.64} rx={9} fill={barColor} transform="rotate(90)" opacity={0.0} />
          <rect x={-barWidth * 0.22} y={-48} width={barWidth * 0.44} height={14} rx={7} fill={barColor} opacity={0.85} />
          <rect x={-7} y={-60} width={14} height={70} rx={7} fill={barColor} />
        </g>
      )}
    </g>
  );
};

/** Speech bubble (SVG). (x,y) = bubble center; tail points to (tx,ty). */
export const SpeechBubble: React.FC<{
  x: number; y: number; tx: number; ty: number; text: string; scale?: number; w?: number; h?: number; color?: string; textColor?: string; size?: number; border?: string; opacity?: number; font?: string; clip?: number; strike?: number;
}> = ({x, y, tx, ty, text, scale = 1, w = 300, h = 110, color = COLORS.white, textColor = '#0b0c10', size = 36, border = '#0b0c10', opacity = 1, font = FONT_UI, clip = 1, strike = 0}) => {
  if (scale <= 0.001) return null;
  const lines = text.split('\n');
  const bx = tx - x, by = ty - y;
  const ang = Math.atan2(by, bx);
  const baseW = 30;
  const px = Math.cos(ang + Math.PI / 2) * baseW * 0.5, py = Math.sin(ang + Math.PI / 2) * baseW * 0.5;
  const ex = Math.cos(ang) * Math.min(w, h) * 0.35, ey = Math.sin(ang) * Math.min(w, h) * 0.35;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <path d={`M ${ex + px} ${ey + py} L ${bx / scale} ${by / scale} L ${ex - px} ${ey - py} Z`} fill={color} stroke={border} strokeWidth={4} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2.4} fill={color} stroke={border} strokeWidth={4} />
      <path d={`M ${ex + px * 0.7} ${ey + py * 0.7} L ${ex - px * 0.7} ${ey - py * 0.7}`} stroke={color} strokeWidth={8} />
      <clipPath id={`bc${Math.round(x)}${Math.round(y)}`}><rect x={-w / 2} y={-h / 2} width={w * clip} height={h} /></clipPath>
      <g clipPath={`url(#bc${Math.round(x)}${Math.round(y)})`}>
        {lines.map((l, i) => (
          <text key={i} x={0} y={(i - (lines.length - 1) / 2) * size * 1.15 + size * 0.36} textAnchor="middle" fontFamily={font} fontWeight={900} fontSize={size} fill={textColor}>{l}</text>
        ))}
      </g>
      {strike > 0 && <line x1={-w * 0.4} y1={0} x2={-w * 0.4 + w * 0.8 * strike} y2={0} stroke={COLORS.red} strokeWidth={8} strokeLinecap="round" />}
    </g>
  );
};

/** Thought bubble with trailing circles toward (tx,ty). Children rendered centred inside. */
export const ThoughtBubble: React.FC<{x: number; y: number; tx: number; ty: number; r?: number; scale?: number; children?: React.ReactNode; color?: string; stroke?: string}> = ({x, y, tx, ty, r = 110, scale = 1, children, color = 'rgba(255,255,255,0.96)', stroke = COLORS.blue}) => {
  if (scale <= 0.001) return null;
  const puffs = 9;
  return (
    <g>
      {[0.18, 0.1, 0.05].map((k, i) => {
        const px = tx + (x - tx) * (0.25 + i * 0.22);
        const py = ty + (y - ty) * (0.25 + i * 0.22);
        return <circle key={i} cx={px} cy={py} r={r * k * scale} fill={color} stroke={stroke} strokeWidth={3} opacity={clamp(scale * 2 - i * 0.3)} />;
      }).reverse()}
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        {new Array(puffs).fill(0).map((_, i) => {
          const a = (i / puffs) * Math.PI * 2;
          return <circle key={i} cx={Math.cos(a) * r * 0.78} cy={Math.sin(a) * r * 0.55} r={r * 0.36} fill={color} stroke={stroke} strokeWidth={4} />;
        })}
        <ellipse cx={0} cy={0} rx={r * 0.95} ry={r * 0.68} fill={color} />
        {children}
      </g>
    </g>
  );
};

/** Retro monitor / TV. Content is rendered inside a clipped screen area (0,0)-(w,h). */
export const Screen: React.FC<{x: number; y: number; w: number; h: number; on?: number; children?: React.ReactNode; frame: number; tint?: string; scale?: number; id: string; stand?: boolean}> = ({x, y, w, h, on = 1, children, frame, tint = COLORS.blue, scale = 1, id, stand = true}) => {
  const flick = 0.92 + 0.08 * Math.sin(frame * 1.7 + x);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {stand && <rect x={w / 2 - 14} y={h + 18} width={28} height={30} fill="#2a2e36" />}
      {stand && <rect x={w / 2 - 60} y={h + 44} width={120} height={10} rx={5} fill="#2a2e36" />}
      <rect x={-14} y={-14} width={w + 28} height={h + 32} rx={16} fill="#1b1e24" stroke="#3a3f49" strokeWidth={3} />
      <clipPath id={`scr-${id}`}><rect x={0} y={0} width={w} height={h} rx={6} /></clipPath>
      <g clipPath={`url(#scr-${id})`}>
        <rect x={0} y={0} width={w} height={h} fill="#05070a" />
        <g opacity={on * flick}>
          <rect x={0} y={0} width={w} height={h} fill={tint} opacity={0.14} />
          {children}
          {new Array(Math.ceil(h / 6)).fill(0).map((_, i) => <rect key={i} x={0} y={i * 6} width={w} height={2} fill="#000" opacity={0.18} />)}
        </g>
        {on < 1 && on > 0 && <rect x={0} y={h / 2 - (h / 2) * on} width={w} height={h * on} fill="#fff" opacity={0.3 * (1 - on)} />}
      </g>
      <circle cx={w - 10} cy={h + 9} r={3.5} fill={on > 0.5 ? COLORS.green : '#552'} />
    </g>
  );
};

/** Horizontal meter with label, e.g. BELIEF 72%. */
export const Meter: React.FC<{x: number; y: number; w?: number; value: number; label: string; color?: string; size?: number}> = ({x, y, w = 360, value, label, color = COLORS.blue, size = 26}) => (
  <g transform={`translate(${x} ${y})`}>
    <text x={0} y={-14} fontFamily={FONT_UI} fontWeight={800} fontSize={size} fill={COLORS.white} letterSpacing={3}>{label}</text>
    <text x={w} y={-14} textAnchor="end" fontFamily={FONT_UI} fontWeight={800} fontSize={size} fill={color}>{Math.round(value * 100)}%</text>
    <rect x={0} y={0} width={w} height={20} rx={10} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
    <rect x={3} y={3} width={Math.max(0, (w - 6) * clamp(value))} height={14} rx={7} fill={color} />
  </g>
);

/** Emotion badge (FEAR / GUILT ...). */
export const EmotionBadge: React.FC<{x: number; y: number; label: string; color: string; icon: React.ReactNode; scale?: number; pulse?: number}> = ({x, y, label, color, icon, scale = 1, pulse = 0}) => {
  if (scale <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * (1 + pulse * 0.06)})`}>
      <circle r={70} fill={color} opacity={0.16 + pulse * 0.1} />
      <circle r={58} fill="#0d0f13" stroke={color} strokeWidth={5} />
      <g transform="scale(1.15)">{icon}</g>
      <text y={100} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={38} letterSpacing={4} fill={color}>{label}</text>
    </g>
  );
};

// ------------------------------------------------------------------ simple icon set (centred at 0,0, ~80px)
export const Icon = {
  heart: (c = COLORS.red) => <path d="M0 28 C -40 0 -38 -30 -18 -32 C -8 -33 -2 -26 0 -20 C 2 -26 8 -33 18 -32 C 38 -30 40 0 0 28 Z" fill={c} />,
  brain: (c = COLORS.blue) => (
    <g fill="none" stroke={c} strokeWidth={5} strokeLinecap="round">
      <path d="M -4 -32 C -20 -36 -34 -26 -32 -12 C -44 -6 -42 12 -30 16 C -30 30 -12 34 -4 26 Z" />
      <path d="M 4 -32 C 20 -36 34 -26 32 -12 C 44 -6 42 12 30 16 C 30 30 12 34 4 26 Z" />
      <path d="M -18 -14 C -10 -10 -12 0 -20 2 M 18 -14 C 10 -10 12 0 20 2 M -14 14 C -8 10 -4 16 -4 20 M 14 14 C 8 10 4 16 4 20" />
    </g>
  ),
  fear: (c = COLORS.red) => (
    <g stroke={c} strokeWidth={5} fill="none" strokeLinecap="round">
      <circle r={26} />
      <circle cx={-9} cy={-6} r={4} fill={c} /><circle cx={9} cy={-6} r={4} fill={c} />
      <ellipse cx={0} cy={12} rx={6} ry={8} />
    </g>
  ),
  guilt: (c = '#ff8a3d') => (
    <g fill={c}>
      <path d="M -26 -6 L 26 -6 L 32 28 L -32 28 Z" />
      <rect x={-8} y={-18} width={16} height={14} rx={3} />
      <text y={20} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={22} fill="#0d0f13">10T</text>
    </g>
  ),
  insecurity: (c = '#b07bff') => (
    <g stroke={c} strokeWidth={5} fill="none" strokeLinecap="round">
      <circle cx={0} cy={-12} r={12} />
      <path d="M -20 26 C -20 6 20 6 20 26" />
      <path d="M 26 -26 L 32 -32 M 30 -16 L 38 -18 M -26 -26 L -32 -32" />
    </g>
  ),
  excitement: (c = COLORS.yellow) => <path d="M 4 -34 L -18 4 L -2 4 L -8 34 L 18 -6 L 2 -6 Z" fill={c} />,
  phone: (c = COLORS.white) => (
    <g>
      <rect x={-22} y={-38} width={44} height={76} rx={8} fill="none" stroke={c} strokeWidth={5} />
      <circle cx={0} cy={28} r={3.5} fill={c} />
    </g>
  ),
  billboard: (c = COLORS.white) => (
    <g stroke={c} strokeWidth={5} fill="none">
      <rect x={-36} y={-30} width={72} height={40} rx={4} />
      <path d="M -18 10 L -18 34 M 18 10 L 18 34" />
      <text x={0} y={-3} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={18} fill={c} stroke="none">BUY</text>
    </g>
  ),
  crowd: (c = COLORS.white) => (
    <g fill={c}>
      {[-24, 0, 24].map((x, i) => (
        <g key={i} transform={`translate(${x} ${i === 1 ? -6 : 4})`}>
          <circle cy={-14} r={9} />
          <path d="M -12 22 C -12 2 12 2 12 22 Z" />
        </g>
      ))}
    </g>
  ),
  relationship: (c = COLORS.white) => (
    <g>
      <circle cx={-16} cy={-12} r={10} fill={c} /><circle cx={16} cy={-12} r={10} fill={c} />
      <path d="M -30 24 C -30 4 -2 4 -2 24 Z M 2 24 C 2 4 30 4 30 24 Z" fill={c} />
      <path d="M 0 -30 C -6 -38 -14 -32 0 -22 C 14 -32 6 -38 0 -30 Z" fill={COLORS.red} />
    </g>
  ),
  remote: (c = COLORS.white) => (
    <g>
      <rect x={-18} y={-40} width={36} height={80} rx={10} fill="#22262e" stroke={c} strokeWidth={4} />
      <circle cx={0} cy={-24} r={7} fill={COLORS.red} />
      {[-6, 6, 18].map((y) => [-8, 8].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill={c} />))}
    </g>
  ),
  shield: (c = COLORS.blue) => (
    <g>
      <path d="M 0 -38 L 30 -26 C 30 6 20 24 0 38 C -20 24 -30 6 -30 -26 Z" fill="none" stroke={c} strokeWidth={6} strokeLinejoin="round" />
      <path d="M -12 0 L -2 10 L 14 -10" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" />
    </g>
  ),
  magnifier: (c = COLORS.white) => (
    <g stroke={c} strokeWidth={7} fill="none" strokeLinecap="round">
      <circle cx={-6} cy={-6} r={20} />
      <path d="M 9 9 L 28 28" />
    </g>
  ),
  pause: (c = COLORS.white) => (
    <g fill={c}><rect x={-20} y={-26} width={13} height={52} rx={4} /><rect x={7} y={-26} width={13} height={52} rx={4} /></g>
  ),
  question: (c = COLORS.white) => <text y={24} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={74} fill={c}>?</text>,
  bulb: (c = COLORS.yellow) => (
    <g>
      <circle cy={-8} r={22} fill={c} />
      <rect x={-10} y={14} width={20} height={14} rx={3} fill="#bbb" />
    </g>
  ),
  mug: (c = COLORS.white) => (
    <g>
      <path d="M -34 -34 L 26 -34 L 22 36 C 22 42 18 46 12 46 L -20 46 C -26 46 -30 42 -30 36 Z" fill={c} />
      <path d="M 24 -18 C 50 -18 50 22 22 22" fill="none" stroke={c} strokeWidth={9} />
      <path d="M -16 -48 C -22 -58 -10 -62 -16 -72 M 2 -48 C -4 -58 8 -62 2 -72" stroke="rgba(255,255,255,0.5)" strokeWidth={4} fill="none" strokeLinecap="round" />
    </g>
  ),
  shoe: (c = COLORS.white) => (
    <path d="M -46 18 L -46 -18 C -30 -16 -22 -24 -18 -30 L -6 -26 C 0 -10 22 -4 40 0 C 50 4 50 18 44 22 L -40 24 Z" fill={c} />
  ),
  clock: (c = COLORS.white, h = 6) => (
    <g stroke={c} strokeWidth={5} fill="none" strokeLinecap="round">
      <circle r={34} />
      <path d={`M 0 0 L 0 -24`} />
      <path d={`M 0 0 L ${Math.sin((h / 12) * Math.PI * 2) * 16} ${-Math.cos((h / 12) * Math.PI * 2) * 16}`} />
    </g>
  ),
  cap: (c = COLORS.red) => <path d="M -28 4 C -28 -22 28 -22 28 4 Z M 20 0 L 46 6 L 20 8 Z" fill={c} />,
  thumbsUp: (c = COLORS.blue) => <path d="M -24 -2 L -12 -2 L -12 30 L -24 30 Z M -8 -2 L 2 -26 C 6 -32 14 -30 12 -20 L 8 -8 L 26 -8 C 32 -8 34 -2 32 4 L 26 26 C 24 30 22 30 18 30 L -8 30 Z" fill={c} />,
  pendulum: (c = COLORS.yellow, a = 0) => (
    <g transform={`rotate(${a})`}>
      <path d="M 0 0 L 0 70" stroke="#ccc" strokeWidth={3} />
      <circle cy={80} r={14} fill={c} />
      <path d="M -6 80 C -6 72 6 72 6 80 C 6 86 -2 88 -2 82" stroke="#0d0f13" strokeWidth={2.5} fill="none" />
    </g>
  ),
};

/** Red cross-out mark drawn over something. */
export const CrossOut: React.FC<{x: number; y: number; size?: number; p: number}> = ({x, y, size = 120, p}) => {
  if (p <= 0) return null;
  const a = clamp(p * 2), b = clamp(p * 2 - 1);
  return (
    <g stroke={COLORS.red} strokeWidth={14} strokeLinecap="round">
      <line x1={x - size} y1={y - size} x2={x - size + 2 * size * a} y2={y - size + 2 * size * a} />
      {b > 0 && <line x1={x + size} y1={y - size} x2={x + size - 2 * size * b} y2={y - size + 2 * size * b} />}
    </g>
  );
};

/** Asch line-judgement cards. `answer` highlights a choice (A/B/C). */
export const AschCards: React.FC<{x: number; y: number; scale?: number; p?: number; correctGlow?: number; equalP?: number; vertical?: boolean; opacity?: number}> = ({x, y, scale = 1, p = 1, correctGlow = 0, equalP = 0, vertical = false, opacity}) => {
  const ref = 200;
  const comps = [{k: 'A', len: 140}, {k: 'B', len: 260}, {k: 'C', len: 200}];
  const cardW = 300, cardH = 340;
  const gap = vertical ? 0 : 60;
  const card2x = vertical ? 0 : cardW + gap;
  const card2y = vertical ? cardH + 50 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity ?? clamp(p * 2)}>
      <g transform={`translate(${-(vertical ? cardW / 2 : cardW + gap / 2)} ${vertical ? -(cardH + 25) : -cardH / 2})`}>
        <rect width={cardW} height={cardH} rx={14} fill="#f1efe8" stroke="#c7c2b6" strokeWidth={4} />
        <text x={cardW / 2} y={44} textAnchor="middle" fontFamily={FONT_UI} fontWeight={800} fontSize={26} fill="#555">REFERENCE</text>
        <line x1={cardW / 2} y1={cardH - 40} x2={cardW / 2} y2={cardH - 40 - ref * clamp(p * 1.5)} stroke="#111" strokeWidth={14} strokeLinecap="round" />
        {equalP > 0 && <line x1={cardW / 2 + 30} y1={cardH - 40} x2={cardW / 2 + 30} y2={cardH - 40 - ref} stroke={COLORS.blue} strokeWidth={4} strokeDasharray="10 8" opacity={equalP} />}
      </g>
      <g transform={`translate(${vertical ? -cardW / 2 : gap / 2} ${card2y - (vertical ? cardH / 2 - 25 : cardH / 2)})`}>
        <rect width={cardW + 40} height={cardH} rx={14} fill="#f1efe8" stroke="#c7c2b6" strokeWidth={4} />
        {comps.map((c, i) => {
          const cx = 70 + i * 100;
          const isC = c.k === 'C';
          return (
            <g key={c.k}>
              {isC && correctGlow > 0 && <rect x={cx - 34} y={cardH - 60 - c.len} width={68} height={c.len + 60} rx={12} fill={COLORS.blue} opacity={0.28 * correctGlow} />}
              <line x1={cx} y1={cardH - 52} x2={cx} y2={cardH - 52 - c.len * clamp(p * 1.5 - i * 0.15)} stroke="#111" strokeWidth={14} strokeLinecap="round" />
              <text x={cx} y={cardH - 14} textAnchor="middle" fontFamily={FONT_TITLE} fontSize={34} fill={isC && correctGlow > 0 ? COLORS.blueDeep : '#333'}>{c.k}</text>
              {isC && equalP > 0 && <line x1={cx + 26} y1={cardH - 52} x2={cx + 26} y2={cardH - 52 - ref} stroke={COLORS.blue} strokeWidth={4} strokeDasharray="10 8" opacity={equalP} />}
            </g>
          );
        })}
      </g>
    </g>
  );
};
