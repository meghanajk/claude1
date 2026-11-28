// Render FACTMAN deliverables into ../output
//   node scripts/render.mjs full | shorts | thumb | all | <CompositionId>
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {execFileSync} from 'child_process';

const OUT = path.resolve('..', 'output');
const JOBS = {
  FactmanMain: 'FACTMAN_Mind_Control_Full_Video.mp4',
  Short01Conformity: 'FACTMAN_Short_01_Conformity.mp4',
  Short02IllusoryTruth: 'FACTMAN_Short_02_Illusory_Truth.mp4',
  Short03Gaslighting: 'FACTMAN_Short_03_Gaslighting.mp4',
};
const GROUPS = {
  full: ['FactmanMain'],
  shorts: ['Short01Conformity', 'Short02IllusoryTruth', 'Short03Gaslighting'],
  thumb: ['Thumbnail'],
};
GROUPS.all = [...GROUPS.full, ...GROUPS.shorts, ...GROUPS.thumb];

const arg = process.argv[2] || 'all';
const ids = GROUPS[arg] || [arg];
const chrome = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browserExecutable = fs.existsSync(chrome) ? chrome : undefined;

fs.mkdirSync(OUT, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
for (const id of ids) {
  const composition = await selectComposition({serveUrl, id, browserExecutable});
  if (id === 'Thumbnail') {
    const output = path.join(OUT, 'FACTMAN_Thumbnail.png');
    await renderStill({composition, serveUrl, output, browserExecutable, frame: 0, scale: 2 / 3});
    console.log('wrote', output);
    continue;
  }
  const output = path.join(OUT, JOBS[id]);
  const master = path.join(OUT, `.master_${JOBS[id]}`);
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: master, browserExecutable,
    crf: 16, pixelFormat: 'yuv420p', audioCodec: 'aac', audioBitrate: '192k',
    imageFormat: 'jpeg', jpegQuality: 92,
    concurrency: Math.max(1, os.cpus().length),
    timeoutInMilliseconds: 120000,
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 100);
      if (p !== last && p % 5 === 0) {
        last = p;
        console.log(`${id}: ${p}%  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      }
    },
  });
  // Finalize: convert full-range JPEG frames to standard TV-range BT.709 yuv420p, efficient x264 encode,
  // AAC audio copied, faststart for web/YouTube upload.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', master,
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-profile:v', 'high', '-tune', 'animation',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'copy', '-movflags', '+faststart', output], {stdio: 'inherit'});
  fs.unlinkSync(master);
  console.log('wrote', output, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
