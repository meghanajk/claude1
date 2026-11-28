import '@fontsource/anton/400.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import {continueRender, delayRender} from 'remotion';

/** Block rendering until the bundled fonts are ready (prevents fallback-font frames). */
let started = false;
export const ensureFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading fonts');
  Promise.all([
    document.fonts.load('400 80px Anton'),
    document.fonts.load('800 40px Montserrat'),
    document.fonts.load('900 40px Montserrat'),
  ])
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
};
