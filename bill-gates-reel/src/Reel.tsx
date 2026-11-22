import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import {AbsoluteFill, Sequence, getStaticFiles} from 'remotion';
import {Card} from './Card';
import {cardFrames} from './timing';
import script from './script.json';

// Find media_processed/cardNN.(png|jpg|mp4...) for each card; missing -> dark background.
const files = getStaticFiles().map((f) => f.name);
const mediaFor = (index: number) => {
  const base = `card${String(index + 1).padStart(2, '0')}.`;
  return files.find((f) => f.startsWith(base) && !f.endsWith('.json')) ?? null;
};

export const Reel = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: '#07090d'}}>
      {script.cards.map((text, i) => {
        const duration = cardFrames(text, i);
        const seq = (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <Card
              text={text}
              index={i}
              media={mediaFor(i)}
              duration={duration}
              badge={script.badge}
            />
          </Sequence>
        );
        from += duration;
        return seq;
      })}
    </AbsoluteFill>
  );
};
