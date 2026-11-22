"""Card timing. Keep in sync with src/timing.ts."""
import json, math, re
from pathlib import Path

FPS = 30
SCRIPT = Path(__file__).resolve().parent.parent / "src/script.json"

def word_count(text):
    return len(re.sub(r"\*\*", "", text).split())

def card_seconds(text, index):
    if index == 0:
        return 4.0  # hook: held longest (the 4 s maximum)
    s = max(3.0, word_count(text) / 3 + 0.5)
    return min(4.0, max(2.5, s))

def card_frames(text, index):
    return math.ceil(card_seconds(text, index) * FPS)

def cards():
    return json.loads(SCRIPT.read_text())["cards"]
