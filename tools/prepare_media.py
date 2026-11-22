#!/usr/bin/env python3
"""Build ./media (raw per-card cuts) and ./media_processed (9:16, enhanced, muted).

Originals in ./media/sources are never modified.
Run from the repo root:  python3 tools/prepare_media.py
"""
import json
import os
import subprocess
import tempfile
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
HOOK_SEC, LAST_SEC, TRANSITION = 2.5, 2.2, 0.0


def card_seconds(i, card):
    if card.get("durationSec"):
        return float(card["durationSec"])
    if i == 0:
        return HOOK_SEC
    if i == len(CARDS) - 1:
        return LAST_SEC
    words = len(card["text"].replace("**", "").split())
    return round(min(2.2, max(1.5, 1.2 + 0.12 * words)), 2)


# Optional AI super-resolution for stills (Real-ESRGAN x4plus via tools/ai_upscale.py).
# Set SR_PYTHON (a python with torch+spandrel) and SR_MODEL (path to RealESRGAN_x4plus.pth).
SR_PYTHON = os.environ.get("SR_PYTHON")
SR_MODEL = os.environ.get("SR_MODEL")


def ai_upscale(png):
    if not (SR_PYTHON and SR_MODEL and Path(SR_MODEL).exists()):
        return None
    tmp = Path(tempfile.mkdtemp())
    subprocess.run([SR_PYTHON, str(ROOT / "tools/ai_upscale.py"), SR_MODEL, str(tmp), str(png)],
                   check=True, capture_output=True)
    return tmp / (Path(png).stem + ".png")


# Shared enhancement chain: gentle denoise at native res -> Lanczos upscale ->
# light unsharp -> consistent warm, slightly contrasty grade.
def grade(w, h, temporal, ai=False):
    dn = "hqdn3d=2:1.5:3:3" if temporal else ("null" if ai else "hqdn3d=2:1.5:0:0")
    return ",".join([
        dn,
        f"scale={w}:{h}:flags=lanczos+accurate_rnd+full_chroma_int",
        "unsharp=5:5:0.25:5:5:0.0" if ai else "unsharp=5:5:0.6:5:5:0.0",
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
        if "reuse" in spec:  # loop card: frozen first frame of another processed card
            other = next(OUT.glob(spec["reuse"] + ".*"))
            run(["ffmpeg", "-v", "error", "-y", "-i", str(other), "-frames:v", "1",
                 "-vf", "scale=1080:1920:flags=lanczos", str(OUT / f"{cid}.png")])
            print(f"{cid}: {card_seconds(i, card):.2f}s  <- first frame of {spec['reuse']}")
            continue
        src = ROOT / SRC["sources"][spec["src"]]
        dur = card_seconds(i, card) + TRANSITION + 0.2
        if "box" in spec:  # still image from a screenshot
            x, y, w, h = spec["box"]
            raw = RAW / f"{cid}.png"
            Image.open(src).convert("RGB").crop((x, y, x + w, y + h)).save(raw)
            up = ai_upscale(raw)
            # images get headroom for the Ken Burns zoom
            run(["ffmpeg", "-v", "error", "-y", "-i", str(up or raw), "-vf",
                 grade(1296, 2304, False, ai=bool(up)), str(OUT / f"{cid}.png")])
            if up:
                h = h * 4
            report.append((cid, f"{w}x{spec['box'][3]}" + (" ai" if up else ""), round(2304 / h, 1)))
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
            # slowed clips: motion-interpolate new frames instead of duplicating them
            slow = f"setpts=PTS/{speed},minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1," if speed < 1 else ""
            vf = f"crop={w}:{h}:{x}:{y}," + slow + "fps=30," + grade(1080, 1920, True)
            run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf", vf, "-an",
                 "-t", f"{dur:.3f}", "-c:v", "libx264", "-crf", "15", "-preset", "slow",
                 "-movflags", "+faststart", str(OUT / f"{cid}.mp4")])
            report.append((cid, f"{w}x{h}", round(1920 / h, 1)))
        print(f"{cid}: {card_seconds(i, card):.2f}s  <- {src.name}")
    print("\nsource crop size / upscale factor:")
    for cid, size, f in report:
        flag = "  LOW QUALITY (heavy upscale)" if f >= 4 else ""
        flag += "  [AI x4 upscaled]" if size.endswith("ai") else ""
        print(f"  {cid}: {size} x{f}{flag}")
    if missing:
        print("MISSING media (plain dark background used):", ", ".join(missing))


if __name__ == "__main__":
    main()
