import {Config} from '@remotion/cli/config';

// Processed media is served from ./media_processed (originals stay in ./media).
Config.setPublicDir('./media_processed');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('swangle');
Config.setBrowserExecutable(process.env.REMOTION_BROWSER ?? null);
