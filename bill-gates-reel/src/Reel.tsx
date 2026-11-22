import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import {AbsoluteFill, Sequence, getStaticFiles, useCurrentFrame} from 'remotion';
import {Card} from './Card';
import {GOLD, PROGRESS_HEIGHT} from './style';
import {CARDS, TOTAL_FRAMES, cardFrames} from './timing';

// media_processed/cardNN.(png|jpg|mp4...) for each card; missing -> dark background.
const files = getStaticFiles().map((f) => f.name);
const mediaFor = (index: number) => {
  const base = `card${String(index + 1).padStart(2, '0')}.`;
  return files.find((f) => f.startsWith(base) && !f.endsWith('.json')) ?? null;
};

const ProgressBar = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: PROGRESS_HEIGHT, background: 'rgba(255,255,255,0.22)'}}>
      <div style={{height: '100%', width: `${(frame / (TOTAL_FRAMES - 1)) * 100}%`, background: GOLD, boxShadow: `0 0 12px ${GOLD}`}} />
    </div>
  );
};

export const Reel = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {CARDS.map((card, i) => {
        const d = cardFrames(card);
        const seq = (
          <Sequence key={i} from={from} durationInFrames={d}>
            <Card card={card} index={i} media={mediaFor(i)} duration={d} />
          </Sequence>
        );
        from += d;
        return seq;
      })}
      <ProgressBar />
    </AbsoluteFill>
  );
};
