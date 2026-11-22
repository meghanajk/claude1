# Dulquer Salmaan reel (silent, 1080x1920, 30 fps)

Final video: `out/dulquer_reel.mp4`.

## Edit text
All captions are in `src/data/script.json` (one string per card). Wrap words in
`**double asterisks**` to highlight them. Card length is calculated from word count
(about 1 s per 3 words, 2.5–3.5 s; the hook is 3.5 s), so editing text retimes the video.

## Re-render
```bash
npm install
npm run media    # media/ -> media_processed/ (crop 9:16, denoise, upscale, sharpen, warm grade, mute + trim videos)
npm run render   # -> out/dulquer_reel.mp4
npm run studio   # live preview
./scripts/check_frames.sh   # one still per card -> out/check/grid.jpg
```
Re-run `npm run media` after changing text, because video clips are trimmed to each card's length.

## Media
- `media/cardNN.*`: original files (never modified). Replace one to change that card's visual.
- `media/media_config.json`: per-card source crop, face focus point and video start time.
- `media_processed/`: generated copies plus `quality_report.txt`.
- If a card file is missing, that card gets a plain dark background.
