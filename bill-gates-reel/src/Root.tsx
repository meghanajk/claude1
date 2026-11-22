import {Composition} from 'remotion';
import {Reel} from './Reel';
import {FPS, cardFrames} from './timing';
import script from './script.json';

const total = script.cards.reduce((sum, text, i) => sum + cardFrames(text, i), 0);

export const RemotionRoot = () => (
  <Composition
    id="BillGatesReel"
    component={Reel}
    durationInFrames={total}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
