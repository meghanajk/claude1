#!/usr/bin/env python3
"""Build ./media (raw per-card cuts) and ./media_processed (9:16, enhanced, muted).

Originals in ./media/sources are never modified.
Run from the repo root:  python3 tools/prepare_media.py
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CARDS = json.loads((ROOT / "reel/src/data/cards.json").read_text())["cards"]
SRC = json.loads((ROOT / "tools/media_sources.json").read_text())
RAW = ROOT / "media"
OUT = ROOT / "media_processed"
OUT.mkdir(exist_ok=True)

# Must match reel/src/timing.ts
HOOK_EXTRA, LAST_EXTRA, TRANSITION = 0.8, 0.6, 0.2


def card_seconds(i, card):
    if card.get("durationSec"):
        return float(card["durationSec"])
    words = len(card["text"].replace("**", "").split())
    d = min(4.0, max(2.5, words / 3))
    if i == 0:
        d += HOOK_EXTRA
    if i == len(CARDS) - 1:
        d += LAST_EXTRA
    return d


# Shared enhancement chain: gentle denoise at native res -> Lanczos upscale ->
# light unsharp -> consistent warm, slightly contrasty grade.
def grade(w, h, temporal):
    dn = "hqdn3d=2:1.5:3:3" if temporal else "hqdn3d=2:1.5:0:0"
    return ",".join([
        dn,
        f"scale={w}:{h}:flags=lanczos+accurate_rnd+full_chroma_int",
        "unsharp=5:5:0.6:5:5:0.0",
        "eq=contrast=1.08:saturation=1.08:brightness=0.005:gamma=0.98",
        "colorbalance=rs=0.03:bs=-0.03:rm=0.04:gm=0.01:bm=-0.04:rh=0.02:bh=-0.03",
        "format=yuv420p" if temporal else "format=rgb24",
    ])


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"ffmpeg failed: {' '.join(cmd)}\n{r.stderr[-2000:]}")


def main():
    missing, report = [], []
    for i, card in enumerate(CARDS):
        cid = f"card{i + 1:02d}"
        spec = SRC["cards"].get(cid)
        if not spec:
            missing.append(cid)
            continue
        src = ROOT / SRC["sources"][spec["src"]]
        dur = card_seconds(i, card) + TRANSITION + 0.2
        if "box" in spec:  # still image from a screenshot
            x, y, w, h = spec["box"]
            raw = RAW / f"{cid}.png"
            Image.open(src).convert("RGB").crop((x, y, x + w, y + h)).save(raw)
            # images get headroom for the Ken Burns zoom
            run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf",
                 grade(1296, 2304, False), str(OUT / f"{cid}.png")])
            report.append((cid, f"{w}x{h}", round(2304 / h, 1)))
        else:  # video segment
            x, y, w, h = spec["crop"]
            speed = spec.get("speed", 1.0)
            src_len = dur * speed
            if "end" in spec:
                src_len = min(src_len, spec["end"] - spec["start"])
            raw = RAW / f"{cid}.mp4"
            # raw cut: full frame, original audio kept, no processing
            run(["ffmpeg", "-v", "error", "-y", "-ss", str(spec["start"]), "-i", str(src),
                 "-t", f"{src_len:.3f}", "-c:v", "libx264", "-crf", "10", "-preset", "fast",
                 "-c:a", "aac", str(raw)])
            vf = f"crop={w}:{h}:{x}:{y},setpts=PTS/{speed},fps=30," + grade(1080, 1920, True)
            run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf", vf, "-an",
                 "-t", f"{dur:.3f}", "-c:v", "libx264", "-crf", "15", "-preset", "slow",
                 "-movflags", "+faststart", str(OUT / f"{cid}.mp4")])
            report.append((cid, f"{w}x{h}", round(1920 / h, 1)))
        print(f"{cid}: {card_seconds(i, card):.2f}s  <- {src.name}")
    print("\nsource crop size / upscale factor:")
    for cid, size, f in report:
        flag = "  LOW QUALITY (heavy upscale)" if f >= 4 else ""
        print(f"  {cid}: {size} x{f}{flag}")
    if missing:
        print("MISSING media (plain dark background used):", ", ".join(missing))


if __name__ == "__main__":
    main()
