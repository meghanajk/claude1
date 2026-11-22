import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {Card, TRANSITION, timeline} from './timing';

// ---- Font (one font only: Inter Display Bold, bundled in public/fonts) ----
const FONT = 'ReelSans';
const fontHandle = delayRender('font', {timeoutInMilliseconds: 120000});
const face = new FontFace(FONT, `url(${staticFile('fonts/InterDisplay-Bold.otf')}) format('opentype')`, {
  weight: '700',
});
face
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(fontHandle);
  })
  .catch(() => continueRender(fontHandle));

// ---- Style tokens (taken from the reference reel) ----
// Solid black caption box, white text; highlighted phrases sit on a
// saffron -> white -> green bar with dark text.
const BOX_BG = '#000000';
const TEXT = '#FFFFFF';
const HL_TEXT = '#0A0A0A';
const HL_BAR = 'linear-gradient(90deg, #FF8A1E 0%, #FFB15C 30%, #F4FFF0 55%, #6BE35A 78%, #22C21C 100%)';

const ease = Easing.bezier(0.22, 1, 0.36, 1);

const Media: React.FC<{card: Card; frames: number}> = ({card, frames}) => {
  const f = useCurrentFrame();
  const src = staticFile(`media/${card.media}`);
  const isVideo = /\.(mp4|mov|webm)$/i.test(card.media);
  // Slow Ken Burns zoom (stronger on stills, gentle on video).
  const kb = interpolate(f, [0, frames + TRANSITION], isVideo ? [1.0, 1.04] : [1.0, 1.09]);
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${kb})`,
  };
  if (!card.media) return <AbsoluteFill style={{background: '#0d0d10'}} />;
  return isVideo ? <OffthreadVideo src={src} muted style={style} /> : <Img src={src} style={style} />;
};

// Parse "**highlight** normal" into segments.
const parse = (text: string) =>
  text.split('**').map((t, i) => ({t, hl: i % 2 === 1})).filter((s) => s.t.length > 0);

const Caption: React.FC<{text: string; frames: number; hook: boolean}> = ({text, frames, hook}) => {
  const f = useCurrentFrame();
  const inP = interpolate(f, [0, 8], [0, 1], {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const outP = interpolate(f, [frames - 4, frames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fontSize = hook ? 92 : 66;
  let hlIndex = 0;
  let wordIndex = 0;

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 100,
          top: hook ? '57%' : '60%',
          transform: `translateY(-50%) translateY(${(1 - inP) * 36}px) scale(${0.96 + 0.04 * inP})`,
          transformOrigin: 'left center',
          opacity: inP * outP,
          display: 'flex',
          justifyContent: 'flex-start',
        }}
      >
        <div
          style={{
            background: BOX_BG,
            padding: hook ? '28px 34px 32px' : '22px 28px 26px',
            fontFamily: FONT,
            fontWeight: 700,
            fontSize,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            color: TEXT,
            maxWidth: 880,
          }}
        >
          {parse(text).map((seg, si) => {
            if (!seg.hl) {
              wordIndex += seg.t.split(/\s+/).length;
              return <span key={si}>{seg.t}</span>;
            }
            const start = 4 + hlIndex * 4;
            hlIndex++;
            const wipe = interpolate(f, [start, start + 7], [0, 100], {
              easing: ease,
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const words = seg.t.split(/(\s+)/);
            return (
              <span
                key={si}
                style={{
                  backgroundImage: HL_BAR,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${wipe}% 100%`,
                  WebkitBoxDecorationBreak: 'clone',
                  boxDecorationBreak: 'clone',
                  padding: '0 0.12em',
                  margin: '0 -0.04em',
                  fontSize: '1.05em',
                  color: wipe > 40 ? HL_TEXT : TEXT,
                }}
              >
                {words.map((w, wi) => {
                  if (/^\s+$/.test(w)) return w;
                  const ws = start + (wordIndex++ % 6);
                  const s = interpolate(f, [ws, ws + 6], [0.7, 1], {
                    easing: Easing.out(Easing.back(2.2)),
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });
                  return (
                    <span key={wi} style={{display: 'inline-block', transform: `scale(${s})`}}>
                      {w}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CardScene: React.FC<{card: Card; index: number; frames: number; last: boolean}> = ({
  card,
  index,
  frames,
  last,
}) => {
  const f = useCurrentFrame();
  const capFrom = index === 0 ? 0 : TRANSITION - 2;
  const capLen = frames - capFrom - (last ? 0 : TRANSITION);
  // Quick zoom-punch + fade in over the previous card (no blur).
  const first = index === 0;
  const punch = first ? 1 : interpolate(f, [0, TRANSITION + 4], [1.14, 1], {easing: ease, extrapolateRight: 'clamp'});
  const opacity = first ? 1 : interpolate(f, [0, TRANSITION], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{opacity}}>
      <AbsoluteFill style={{transform: `scale(${punch})`}}>
        <Media card={card} frames={frames} />
      </AbsoluteFill>
      {/* subtle dark gradient for legibility (no blur) */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      {/* caption lands after the media transition and is gone before the next one starts */}
      <Sequence from={capFrom} durationInFrames={capLen}>
        <Caption text={card.text} frames={capLen} hook={first} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    {timeline.map(({card, index, from, frames}) => {
      // Each card starts TRANSITION frames early (overlapping the previous one), except the first.
      const start = index === 0 ? 0 : from - TRANSITION;
      const len = frames + (index === 0 ? 0 : TRANSITION);
      return (
        <Sequence key={index} from={start} durationInFrames={len}>
          <CardScene card={card} index={index} frames={len} last={index === timeline.length - 1} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
