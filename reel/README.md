# Sheetal Devi reel (silent, 1080x1920, 30fps)

- Script / text: `src/data/cards.json` (one card per line, `**word**` = highlight).
- Media mapping & crops: `../tools/media_sources.json`; originals in `../media/sources`.
- Rebuild processed media (crop, denoise, Lanczos upscale, sharpen, warm grade, muted):
  `python3 ../tools/prepare_media.py` (run again after changing text length, it trims clips to card length)
- Preview: `npm run studio`  ·  Render: `npm run render` -> `out/sheetal-devi-reel.mp4`

## AI upscaling (stills)
Stills are upscaled with Real-ESRGAN x4plus before grading. One-time setup:
```
python3 -m venv .sr && .sr/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch && .sr/bin/pip install spandrel pillow numpy
curl -L -o RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
SR_PYTHON=.sr/bin/python SR_MODEL=RealESRGAN_x4plus.pth python3 tools/prepare_media.py
```
Without SR_PYTHON/SR_MODEL the script falls back to Lanczos upscaling.
