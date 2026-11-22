# Bill Gates reel (silent, 1080x1920, 30 fps)

Final video: `out/bill-gates-reel.mp4`

## Look (retention edit)
- Hook: 7 words, huge, centred, first words on screen within 0.3 s.
- 1.5-2.2 s per card, 26.2 s total. Teaser card at 5 s ("Then he did the unthinkable.").
- Pattern interrupts every 3-4 cards: year counter (cards 2, 10), gold flash teaser (4),
  punch zoom + shake + white flash (7, 10, 13).
- Every card: fast push-in zoom, quick blur-in on the cut, text slides up and pops word by
  word, highlighted words pop in gold.
- Text in the lower third over a soft gradient (no box), never over faces.
- Thin gold progress bar at the top.
- The outro uses the hook image and pulls back out to the hook's first frame, so replays loop.
Sizes and colours: `src/style.ts`.

## Edit the text / timing
Everything is in **`src/script.json`**, one object per card:
`text` (wrap words in `**` for gold), `seconds`, optional `style` (`hook`, `teaser`, `outro`),
`count` (`{"from": 1900, "to": 1955}` animates that year), `fx` (`punch`, `flash`).
Pictures are matched by order: card N uses `media_processed/cardNN.*` (card 4 has none on purpose).

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
  If you change a video card's `seconds`, re-run `python3 scripts/process_media.py card08 card09 card13`.
