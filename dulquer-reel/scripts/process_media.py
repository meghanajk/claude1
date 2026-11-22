#!/usr/bin/env python3
"""Prepare per-card media for the Remotion reel.

Reads ./media/cardNN.(jpg|png|mp4|...) + ./media/media_config.json, never modifies
them, and writes graded 9:16 copies to ./media_processed/. Also writes
src/data/media_manifest.json (which card has which processed file) and
media_processed/quality_report.txt.

Pipeline (ffmpeg): source crop (strip phone UI) -> optional delogo -> light
denoise (hqdn3d) -> smart 9:16 crop around the face/subject (fills the frame; no stretching,
no blurred fill) -> Lanczos upscale -> light unsharp -> shared warm grade. Videos are trimmed to
their card's duration, re-timed to 30 fps and have audio removed.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media"
OUT = ROOT / "media_processed"
SCRIPT = ROOT / "src" / "data" / "script.json"
MANIFEST = ROOT / "src" / "data" / "media_manifest.json"

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}
VID_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}

VW, VH = 1080, 1920        # video output
IW, IH = 1440, 2560        # image output (headroom for Ken Burns zoom)

DENOISE = "hqdn3d=1.5:1.5:3:3"
SHARPEN = "unsharp=5:5:0.55:5:5:0.0"
GRADE = ("eq=contrast=1.07:saturation=1.12:brightness=0.005,"
         "colorbalance=rs=0.03:bs=-0.04:rm=0.03:bm=-0.03:rh=0.02:bh=-0.02")
LOW_QUALITY_UPSCALE = 3.0  # flag files enlarged more than this (vs 1080 wide)


def words(text):
    return len(re.sub(r"\*\*", "", text).split())


def card_seconds(i, text, timing):
    """Must match cardFrames() in src/timing.ts."""
    if i == 0:
        return timing["hookSeconds"]
    s = words(text) * timing["secondsPerWord"]
    return max(timing["minSeconds"], min(timing["maxSeconds"], s))


def card_frames(i, text, data):
    return round(card_seconds(i, text, data["timing"]) * data["fps"])


def probe(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "json", str(path)])
    s = json.loads(out)["streams"][0]
    return s["width"], s["height"]


def even(v):
    return int(v) // 2 * 2


def cover_crop(region, focus):
    """Largest 9:16 box inside region, centred on focus (face sits ~40% from top)."""
    rx, ry, rw, rh = region
    fx, fy = focus if focus else (rx + rw / 2, ry + rh * 0.42)
    if rw / rh > 9 / 16:
        ch, cw = rh, rh * 9 / 16
    else:
        cw, ch = rw, rw * 16 / 9
    cx = min(max(fx - cw / 2, rx), rx + rw - cw)
    cy = min(max(fy - ch * 0.40, ry), ry + rh - ch)
    return even(cw), even(ch), even(cx), even(cy)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise SystemExit(f"ffmpeg failed: {' '.join(cmd)}")


def build_filter(cfg, src_w, src_h, W, H):
    region = cfg.get("srcCrop", [0, 0, src_w, src_h])
    pre = []
    if "delogo" in cfg:
        x, y, w, h = cfg["delogo"]
        pre.append(f"delogo=x={x}:y={y}:w={w}:h={h}")
    cw, ch, cx, cy = cover_crop(region, cfg.get("focus"))
    pre += [f"crop={cw}:{ch}:{cx}:{cy}", DENOISE,
            f"scale={W}:{H}:flags=lanczos", SHARPEN, GRADE, "setsar=1"]
    return f"[0:v]{','.join(pre)}[out]", cw


def main():
    data = json.loads(SCRIPT.read_text())
    cfg_all = json.loads((MEDIA / "media_config.json").read_text())
    OUT.mkdir(exist_ok=True)
    manifest, missing, low = {}, [], []
    for i, text in enumerate(data["cards"]):
        key = f"card{i + 1:02d}"
        files = sorted(p for p in MEDIA.glob(key + ".*")
                       if p.suffix.lower() in IMG_EXT | VID_EXT)
        if not files:
            missing.append(key)
            manifest[key] = None
            print(f"{key}: MISSING -> dark background")
            continue
        src = files[0]
        cfg = cfg_all.get(key, {})
        sw, sh = probe(src)
        is_video = src.suffix.lower() in VID_EXT
        W, H = (VW, VH) if is_video else (IW, IH)
        graph, eff_w = build_filter(cfg, sw, sh, W, H)
        upscale = VW / eff_w
        if is_video:
            dur = card_frames(i, text, data) / data["fps"]
            dst = OUT / f"{key}.mp4"
            run(["ffmpeg", "-y", "-v", "error", "-ss", str(cfg.get("start", 0)),
                 "-i", str(src), "-t", f"{dur:.3f}", "-filter_complex", graph,
                 "-map", "[out]", "-an", "-r", str(data["fps"]),
                 "-c:v", "libx264", "-preset", "slow", "-crf", "15",
                 "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst)])
        else:
            dst = OUT / f"{key}.jpg"
            run(["ffmpeg", "-y", "-v", "error", "-i", str(src),
                 "-filter_complex", graph, "-map", "[out]", "-frames:v", "1",
                 "-q:v", "2", str(dst)])
        manifest[key] = {"file": dst.name, "type": "video" if is_video else "image"}
        flag = upscale > LOW_QUALITY_UPSCALE
        if flag:
            low.append(f"{key} ({src.name}): source detail only ~{eff_w:.0f}px wide, "
                       f"enlarged {upscale:.1f}x")
        print(f"{key}: {src.name} -> {dst.name}  upscale {upscale:.1f}x"
              + ("  [LOW QUALITY]" if flag else ""))

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    report = ["Missing media (dark background used): " + (", ".join(missing) or "none"),
              "Low-quality sources (consider replacing):"] + \
             ([f"  - {l}" for l in low] or ["  none"])
    (OUT / "quality_report.txt").write_text("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
