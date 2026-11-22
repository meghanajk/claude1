# Bill Gates reel (silent, 1080x1920, 30 fps)

Final video: `out/bill-gates-reel.mp4`

## Edit the text
All on-screen text is in **`src/script.json`** (one string per card). Wrap words in
`**double asterisks**` to highlight them in gold. Card length is worked out from the word
count (`src/timing.ts`): about 1 s per 3 words, at least 3 s, at most 4 s; the first card
(the hook) is held for 4 s.

## Re-render
```bash
npm install
REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render   # REMOTION_BROWSER is optional
npm run studio                                                    # live preview
```

## Media
- `media/_source/` — the files exactly as provided (never modified).
- `media/cardNN.*` — one file per card, matched by filename order (`card01` = first line).
  Most are photos cut out of the provided screenshots by `scripts/extract_cards.py`.
  A missing `cardNN` file shows a plain dark background.
- `media_processed/` — what Remotion uses. Built by `npm run media`
  (`scripts/process_media.py`): 9:16 smart crop on the face, light denoise, 4x super-resolution
  (EDSR model for stills, FSRCNN for video frames, `models/`) when the upscale is above 2.5x, Lanczos to
  1080x1920, light sharpening, one shared cool/clean grade. Videos are trimmed to the card length
  and have no audio. Per-card crop/start overrides live in `scripts/media_config.json`.
  The EDSR model is not committed (38 MB); fetch it once with
  `curl -L -o models/EDSR_x4.pb https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x4.pb`.
  Needs Python 3 with `opencv-contrib-python-headless<5` and `ffmpeg`.
  If you change a card's length, re-run `npm run media` so the video clips are trimmed to match.
