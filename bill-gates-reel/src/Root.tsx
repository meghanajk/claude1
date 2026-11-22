import {Composition} from 'remotion';
import {Reel} from './Reel';
import {FPS, TOTAL_FRAMES} from './timing';

export const RemotionRoot = () => (
  <Composition id="BillGatesReel" component={Reel} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
);
