import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import {AbsoluteFill, Sequence, getStaticFiles} from 'remotion';
import {Badge, Caption, Media} from './Card';
import {TRANSITION} from './style';
import {cardFrames} from './timing';
import script from './script.json';

// media_processed/cardNN.(png|jpg|mp4...) for each card; missing -> dark background.
const files = getStaticFiles().map((f) => f.name);
const mediaFor = (index: number) => {
  const base = `card${String(index + 1).padStart(2, '0')}.`;
  return files.find((f) => f.startsWith(base) && !f.endsWith('.json')) ?? null;
};

export const Reel = () => {
  const half = TRANSITION / 2;
  const starts: number[] = [];
  let t = 0;
  for (const [i, text] of script.cards.entries()) {
    starts.push(t);
    t += cardFrames(text, i);
  }
  const total = t;
  const last = script.cards.length - 1;

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {/* media layers overlap by TRANSITION frames so they can blur-dissolve */}
      {script.cards.map((text, i) => {
        const from = i === 0 ? 0 : starts[i] - half;
        const to = i === last ? total : starts[i] + cardFrames(text, i) + half;
        return (
          <Sequence key={`m${i}`} from={from} durationInFrames={to - from}>
            <Media
              media={mediaFor(i)}
              duration={to - from}
              transitionIn={i > 0}
              transitionOut={i < last}
            />
          </Sequence>
        );
      })}
      {/* bottom shade like the reference */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 82%, rgba(0,0,0,0.8) 100%)',
        }}
      />
      {/* captions cut instantly, at the middle of each transition */}
      {script.cards.map((text, i) => (
        <Sequence key={`t${i}`} from={starts[i]} durationInFrames={cardFrames(text, i)}>
          <Caption text={text} hook={i === 0} />
        </Sequence>
      ))}
      <Badge {...script.badge} />
    </AbsoluteFill>
  );
};
