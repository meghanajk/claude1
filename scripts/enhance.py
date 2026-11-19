# Crop each photo to 9:16 around the face, then upscale + global enhancement only
# (denoise, sharpen, levels/contrast, mild warm grade). No local/face edits.
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import numpy as np
crops = {1: (230, 0, 650, 746), 2: (180, 0, 659, 851), 3: (37, 0, 504, 830)}
for i, box in crops.items():
    im = Image.open(f"photos/raw{i}.png").convert("L").crop(box)
    im = im.filter(ImageFilter.MedianFilter(3))               # denoise JPEG noise
    im = im.resize((1440, 2560), Image.LANCZOS)                # 9:16, headroom for zoom
    im = im.filter(ImageFilter.GaussianBlur(0.8))              # soften upscale blocks
    im = ImageOps.autocontrast(im, cutoff=0.5)                 # fix levels
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im = im.filter(ImageFilter.UnsharpMask(radius=3, percent=90, threshold=2))
    # mild warm grade on monochrome
    a = np.asarray(im).astype(np.float32) / 255
    rgb = np.stack([a*1.00+0.02, a*0.97+0.01, a*0.90], -1).clip(0, 1)
    Image.fromarray((rgb*255).astype(np.uint8)).save(f"photos/photo{i}_916.png")
    print(i, "done")
