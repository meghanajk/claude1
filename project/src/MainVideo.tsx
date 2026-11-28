import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {TIMELINES, TimelineProvider, sceneFrames} from './lib/timeline';
import {COLORS, FPS, clamp} from './lib/anim';
import {Subtitles} from './components/Subtitles';
import {Bug} from './components/Brand';
import {SCENES} from './scenes';

const XFADE = 12; // frames of cross-dissolve between scenes

const FadeIn: React.FC<{frames: number; children: React.ReactNode}> = ({frames, children}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{opacity: frames ? clamp(frame / frames) : 1}}>{children}</AbsoluteFill>;
};

export const MainVideo: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => {
  const tl = TIMELINES.main;
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const titleEnd = tl.scenes[1].start;
  const endStart = tl.beats.logo;
  const bugOpacity = t > titleEnd + 1 && t < endStart - 4 ? 0.55 : 0;
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {tl.scenes.map((s, i) => {
        const {from, to} = sceneFrames(tl, s.id);
        const x = i === 0 ? 0 : XFADE;
        const C = SCENES[s.id];
        return (
          <Sequence key={s.id} name={s.id} from={from - x} durationInFrames={to - from + x + (i === tl.scenes.length - 1 ? 0 : 1)}>
            <TimelineProvider tl={tl} offset={from - x}>
              <FadeIn frames={x}>
                <C />
              </FadeIn>
            </TimelineProvider>
          </Sequence>
        );
      })}
      <AbsoluteFill style={{opacity: bugOpacity}}>
        <Bug opacity={1} />
      </AbsoluteFill>
      <Subtitles captions={tl.captions} />
      {withAudio && <Audio src={staticFile('audio/main_mix.wav')} />}
    </AbsoluteFill>
  );
};
