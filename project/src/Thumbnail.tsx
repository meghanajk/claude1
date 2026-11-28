import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLORS, FONT_TITLE, FONT_UI} from './lib/anim';
import {Backdrop, FilmLook, Particles, Stage} from './components/Atmosphere';
import {POSES, Stickman, worldJoint} from './components/Stickman';
import {PuppetStrings} from './components/Props';
import {Emblem} from './components/Brand';

/** YouTube thumbnail (designed at 1920x1080, exported at 1280x720). */
export const Thumbnail: React.FC = () => {
  const pose = {...POSES.marionette, head: 18, ra1: 128, la1: -108};
  const hx = 520, hy = 1010, s = 2.05;
  const targets: [number, number][] = [worldJoint(pose, 'lHand', hx, hy, s), [worldJoint(pose, 'head', hx, hy, s)[0], worldJoint(pose, 'head', hx, hy, s)[1] - 80], worldJoint(pose, 'rHand', hx, hy, s)];
  return (
    <AbsoluteFill>
      <Backdrop top="#1a0609" bottom="#040304" light="rgba(255,46,63,0.35)" lightX={30} lightY={35} lightSize={70} />
      <Particles count={70} seed="thumb" color="#ff8a94" opacity={0.5} />
      <Stage>
        {/* giant puppeteer eyes */}
        <g>
          <ellipse cx={360} cy={170} rx={70} ry={42} fill={COLORS.red} opacity={0.25} />
          <ellipse cx={600} cy={170} rx={70} ry={42} fill={COLORS.red} opacity={0.25} />
          <ellipse cx={360} cy={170} rx={36} ry={20} fill="#ff4655" />
          <ellipse cx={600} cy={170} rx={36} ry={20} fill="#ff4655" />
        </g>
        <PuppetStrings frame={0} bar={[hx + 40, 300]} rot={-8} targets={targets} color="rgba(255,255,255,0.9)" barColor={COLORS.red} barWidth={380} width={4} />
        <Stickman x={hx} y={hy} scale={s} pose={pose} variant="hero" frame={10} eyes="spiral" mouth="smile" />
      </Stage>
      <div style={{position: 'absolute', right: 70, top: 150, width: 1050, textAlign: 'right'}}>
        <div style={{fontFamily: FONT_TITLE, fontSize: 150, lineHeight: 1.0, color: COLORS.white, WebkitTextStroke: '10px #000', paintOrder: 'stroke fill', textShadow: '0 10px 0 #000'}}>SOMEONE IS</div>
        <div style={{fontFamily: FONT_TITLE, fontSize: 230, lineHeight: 0.95, color: COLORS.red, WebkitTextStroke: '12px #000', paintOrder: 'stroke fill', textShadow: `0 0 60px ${COLORS.red}, 0 10px 0 #000`}}>CONTROLLING</div>
        <div style={{fontFamily: FONT_TITLE, fontSize: 170, lineHeight: 1.0, color: COLORS.yellow, WebkitTextStroke: '10px #000', paintOrder: 'stroke fill', textShadow: '0 10px 0 #000'}}>YOUR MIND?</div>
        <div style={{display: 'inline-block', marginTop: 30, padding: '14px 30px', background: COLORS.blue, borderRadius: 14, fontFamily: FONT_UI, fontWeight: 900, fontSize: 46, color: '#06121f', letterSpacing: 2}}>THE PSYCHOLOGY OF MANIPULATION</div>
      </div>
      <div style={{position: 'absolute', left: 50, bottom: 40, display: 'flex', alignItems: 'center', gap: 14}}>
        <Emblem size={90} />
        <div style={{fontFamily: FONT_TITLE, fontSize: 70, letterSpacing: 4}}><span style={{color: '#fff'}}>FACT</span><span style={{color: COLORS.red}}>MAN</span></div>
      </div>
      <FilmLook vignette={0.6} grain={0.2} />
    </AbsoluteFill>
  );
};
