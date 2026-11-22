# Sheetal Devi reel (silent, 1080x1920, 30fps)

- Script / text: `src/data/cards.json` (one card per line, `**word**` = highlight).
- Media mapping & crops: `../tools/media_sources.json`; originals in `../media/sources`.
- Rebuild processed media (crop, denoise, Lanczos upscale, sharpen, warm grade, muted):
  `python3 ../tools/prepare_media.py` (run again after changing text length, it trims clips to card length)
- Preview: `npm run studio`  ·  Render: `npm run render` -> `out/sheetal-devi-reel.mp4`
