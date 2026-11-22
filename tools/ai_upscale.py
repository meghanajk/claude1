#!/usr/bin/env python3
"""AI super-resolution (Real-ESRGAN via spandrel, CPU).
usage: ai_upscale.py MODEL.pth OUT_DIR IN1.png [IN2.png ...]
Writes OUT_DIR/<name>.png at 4x. Tiles large inputs to bound memory."""
import sys, time
from pathlib import Path
import numpy as np, torch
from PIL import Image
from spandrel import ModelLoader

torch.set_num_threads(4)
model = ModelLoader().load_from_file(sys.argv[1]).eval()
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
TILE, PAD = 256, 16

@torch.inference_mode()
def sr(img):
    x = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = x.shape
    s = model.scale
    y = torch.zeros(1, 3, h * s, w * s)
    for ty in range(0, h, TILE):
        for tx in range(0, w, TILE):
            y0, x0 = max(ty - PAD, 0), max(tx - PAD, 0)
            y1, x1 = min(ty + TILE + PAD, h), min(tx + TILE + PAD, w)
            r = model(x[:, :, y0:y1, x0:x1])
            ey, ex = min(ty + TILE, h), min(tx + TILE, w)
            y[:, :, ty * s:ey * s, tx * s:ex * s] = r[:, :, (ty - y0) * s:(ey - y0) * s, (tx - x0) * s:(ex - x0) * s]
    a = (y[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(a)

for p in sys.argv[3:]:
    t = time.time()
    sr(Image.open(p).convert("RGB")).save(out / (Path(p).stem + ".png"))
    print(f"{Path(p).name}: {time.time() - t:.1f}s", flush=True)
