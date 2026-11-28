import {Config} from '@remotion/cli/config';
import fs from 'fs';

// Use the locally installed Chromium headless shell when available (no browser download needed).
const candidates = [
  process.env.REMOTION_CHROME,
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
].filter(Boolean) as string[];
const found = candidates.find((p) => fs.existsSync(p));
if (found) Config.setBrowserExecutable(found);

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
