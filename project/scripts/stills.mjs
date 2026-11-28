// Render individual frames for visual QA:  node scripts/stills.mjs <compositionId> <outDir> <frame> [frame...]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import path from 'path';

const [, , id, outDir, ...frames] = process.argv;
const chrome = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browserExecutable = fs.existsSync(chrome) ? chrome : undefined;
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const composition = await selectComposition({serveUrl, id, browserExecutable});
fs.mkdirSync(outDir, {recursive: true});
for (const f of frames) {
  await renderStill({composition, serveUrl, frame: Number(f), output: path.join(outDir, `${id}_${String(f).padStart(5, '0')}.png`), browserExecutable, scale: 0.5});
  console.log('frame', f);
}
