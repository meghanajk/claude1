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
CARDS = {  # card order follows src/script.json; card04 (teaser) has no picture on purpose
    "card01": ("shot6_younger.jpg", (365, 592, 712, 935)),   # hook: lying on the computer
    "card02": ("shot8_mixed.jpg", (8, 280, 357, 735)),       # young + old portrait
    "card03": ("shot6_younger.jpg", (8, 302, 357, 543)),     # yellow sweater, computers
    "card05": ("shot7_younger.jpg", (365, 282, 712, 690)),   # yellow sweater, keyboard
    "card06": ("shot6_younger.jpg", (365, 300, 712, 505)),   # black-and-white, glasses
    "card07": ("shot6_younger.jpg", (8, 630, 357, 1142)),    # grey sweater
    "card08": ("video_young_interview.mp4", None),
    "card09": ("video_young_interview.mp4", None),
    "card10": ("shot8_mixed.jpg", (8, 822, 357, 1072)),      # Windows XP stage
    "card11": ("shot7_younger.jpg", (8, 1070, 357, 1552)),   # 1990s suit
    "card12": ("shot1_wikipedia.jpg", (0, 158, 720, 1012)),  # portrait
    "card13": ("video_podcast.mp4", None),
    "card14": ("shot6_younger.jpg", (365, 592, 712, 935)),   # outro = hook image, so replays loop
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
