"""Cut the individual photos out of the phone screenshots in media/_source
and save them as media/cardNN.png (lossless). Videos are copied as-is.
Boxes are (x0, y0, x1, y1) in the 720x1600 screenshot; INSET trims the
rounded tile corners."""
import shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "media/_source", ROOT / "media"
INSET = 12
CARDS = {
    "card01": ("shot6_younger.jpg", (365, 592, 712, 935)),
    "card02": ("shot7_younger.jpg", (365, 780, 712, 1130)),
    "card03": ("shot6_younger.jpg", (8, 302, 357, 543)),
    "card04": ("shot6_younger.jpg", (365, 300, 712, 505)),
    "card05": ("shot6_younger.jpg", (8, 630, 357, 1142)),
    "card06": ("shot7_younger.jpg", (365, 282, 712, 690)),
    "card07": ("video_young_interview.mp4", None),
    "card08": ("shot8_mixed.jpg", (8, 822, 357, 1072)),
    "card09": ("shot7_younger.jpg", (8, 1070, 357, 1552)),
    "card10": ("shot2_grid.jpg", (8, 128, 357, 416)),
    "card11": ("video_podcast.mp4", None),
    "card12": ("shot1_wikipedia.jpg", (0, 158, 720, 1012)),
}
for name, (src, box) in CARDS.items():
    if box is None:
        shutil.copy(SRC / src, OUT / f"{name}.mp4")
        continue
    x0, y0, x1, y1 = box
    i = INSET if x0 > 0 else 0
    im = Image.open(SRC / src).convert("RGB").crop((x0 + i, y0 + i, x1 - i, y1 - i))
    im.save(OUT / f"{name}.png")
    print(name, im.size)
