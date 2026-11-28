import React from 'react';
import {Composition, Still} from 'remotion';
import {MainVideo} from './MainVideo';
import {Short01Conformity} from './shorts/Short01Conformity';
import {Short02IllusoryTruth} from './shorts/Short02IllusoryTruth';
import {Short03Gaslighting} from './shorts/Short03Gaslighting';
import {Thumbnail} from './Thumbnail';
import {TIMELINES} from './lib/timeline';
import {ensureFonts} from './lib/fonts';

ensureFonts();

export const RemotionRoot: React.FC = () => (
  <>
    {/* 16:9 landscape main video */}
    <Composition id="FactmanMain" component={MainVideo} durationInFrames={TIMELINES.main.durationInFrames} fps={30} width={1920} height={1080} />
    {/* 9:16 vertical Shorts */}
    <Composition id="Short01Conformity" component={Short01Conformity} durationInFrames={TIMELINES.short1.durationInFrames} fps={30} width={1080} height={1920} />
    <Composition id="Short02IllusoryTruth" component={Short02IllusoryTruth} durationInFrames={TIMELINES.short2.durationInFrames} fps={30} width={1080} height={1920} />
    <Composition id="Short03Gaslighting" component={Short03Gaslighting} durationInFrames={TIMELINES.short3.durationInFrames} fps={30} width={1080} height={1920} />
    {/* Thumbnail (exported at 1280x720) */}
    <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} />
  </>
);
