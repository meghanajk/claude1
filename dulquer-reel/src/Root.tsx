import { Composition } from "remotion";
import script from "./data/script.json";
import { Reel } from "./Reel";
import { totalFrames } from "./timing";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    durationInFrames={totalFrames()}
    fps={script.fps}
    width={script.width}
    height={script.height}
  />
);
