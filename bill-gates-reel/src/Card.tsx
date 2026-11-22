import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {groupTokens, parseCard} from './parse';

const FONT = "'Montserrat', sans-serif";
const GOLD = '#FFC51A';
const SAFE_X = 90; // side safe margin (px)

type Props = {
  text: string;
  index: number;
  media: string | null;
  duration: number;
  badge: {label: string; name: string};
};

const Background: React.FC<{media: string | null; duration: number}> = ({media, duration}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
  if (!media) {
    return (
      <AbsoluteFill
        style={{background: 'radial-gradient(circle at 50% 35%, #1b2433 0%, #07090d 75%)'}}
      />
    );
  }
  const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(media);
  // Slow Ken Burns zoom on stills, a very light push on videos.
  const scale = interpolate(frame, [0, duration], isVideo ? [1, 1.03] : [1.02, 1.12], {
    easing: Easing.inOut(Easing.quad),
  });
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${scale})`,
  };
  return (
    <AbsoluteFill style={{opacity: fadeIn}}>
      {isVideo ? (
        <OffthreadVideo src={staticFile(media)} muted style={style} />
      ) : (
        <Img src={staticFile(media)} style={style} />
      )}
    </AbsoluteFill>
  );
};

const Badge: React.FC<{label: string; name: string}> = ({label, name}) => (
  <div
    style={{
      position: 'absolute',
      top: 150,
      right: SAFE_X,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: '#000',
      padding: '10px 14px',
      borderRadius: 8,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 32,
      color: '#fff',
    }}
  >
    <span>{label}</span>
    <span style={{background: GOLD, color: '#111', padding: '2px 10px', borderRadius: 5}}>
      {name}
    </span>
  </div>
);

export const Card: React.FC<Props> = ({text, index, media, duration, badge}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hook = index === 0;
  const tokens = parseCard(text);
  const groups = groupTokens(tokens);

  // Soft fade + slide in, quick fade out.
  const inP = interpolate(frame, [2, 14], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const out = interpolate(frame, [duration - 6, duration - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fontSize = hook ? 80 : 68;

  let hl = 0; // highlight counter for staggered scale-ins
  return (
    <AbsoluteFill>
      <Background media={media} duration={duration} />
      {/* subtle dark gradient so text is always readable */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)',
        }}
      />
      <Badge {...badge} />
      <div
        style={{
          position: 'absolute',
          left: SAFE_X,
          right: SAFE_X,
          top: hook ? 1020 : 1080,
          display: 'flex',
          justifyContent: 'flex-start',
          opacity: inP * out,
          transform: `translateY(${(1 - inP) * 50}px)`,
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.9)',
            padding: hook ? '30px 34px 34px' : '24px 30px 28px',
            borderRadius: 6,
            fontFamily: FONT,
            fontWeight: hook ? 900 : 800,
            fontSize,
            lineHeight: 1.28,
            color: '#fff',
            letterSpacing: -0.5,
          }}
        >
          {groups.map((group, g) => (
            <React.Fragment key={g}>
              <span style={{whiteSpace: 'nowrap'}}>
              {group.map((t, gi) => { const tok = tokens[t]; return (
              <React.Fragment key={t}>
                {tok.segments.map((seg, s) => {
                  if (!seg.highlight) return <span key={s}>{seg.text}</span>;
                  const delay = 8 + hl++ * 2;
                  const pop = spring({frame: frame - delay, fps, config: {damping: 12, stiffness: 180}});
                  const isLastSeg = s === tok.segments.length - 1;
                  return (
                    <span
                      key={s}
                      style={{
                        display: 'inline-block',
                        background: GOLD,
                        color: '#111',
                        fontSize: '1.08em',
                        // inside a multi-word highlight the gap is gold too, so the bar reads as one
                        padding: isLastSeg && tok.spaceHighlighted ? '0 0.2em 0 0.14em' : '0 0.14em',
                        marginRight: isLastSeg && tok.spaceHighlighted ? '-0.04em' : 0,
                        borderRadius: 4,
                        transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
                        opacity: interpolate(pop, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}),
                        transformOrigin: '50% 60%',
                      }}
                    >
                      {seg.text}
                    </span>
                  );
                })}
              {gi < group.length - 1 ? (tok.spaceHighlighted ? '' : ' ') : null}
              </React.Fragment>); })}
              </span>
              {tokens[group[group.length - 1]].spaceHighlighted ? '\u200b' : ' '}
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
