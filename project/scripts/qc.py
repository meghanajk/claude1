"""Quality control for the rendered FACTMAN deliverables.

Checks every video in ../output: resolution, fps, duration, audio stream, black frames,
peak level / clipping, integrated loudness, and SRT sanity. Optionally writes contact sheets.

Usage: python3 scripts/qc.py [--sheets DIR]
"""
import json, re, subprocess, sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent.parent / "output"
EXPECT = {
    "FACTMAN_Mind_Control_Full_Video.mp4": dict(w=1920, h=1080, dmin=240, dmax=300),
    "FACTMAN_Short_01_Conformity.mp4": dict(w=1080, h=1920, dmin=30, dmax=55),
    "FACTMAN_Short_02_Illusory_Truth.mp4": dict(w=1080, h=1920, dmin=30, dmax=55),
    "FACTMAN_Short_03_Gaslighting.mp4": dict(w=1080, h=1920, dmin=30, dmax=55),
}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(p):
    r = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(p)])
    return json.loads(r.stdout)


def check_video(p, exp):
    ok = True
    info = probe(p)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    dur = float(info["format"]["duration"])
    fps = eval(v["r_frame_rate"])
    print(f"\n== {p.name}")
    print(f"   {v['width']}x{v['height']} @ {fps:.2f} fps, {dur:.2f}s ({dur / 60:.2f} min), {v['codec_name']}/{v['pix_fmt']}, "
          f"audio: {a[0]['codec_name'] + ' ' + a[0]['sample_rate'] + 'Hz' if a else 'NONE'}, size {p.stat().st_size / 1e6:.1f} MB")
    if (v["width"], v["height"]) != (exp["w"], exp["h"]):
        print("   FAIL resolution"); ok = False
    if not (exp["dmin"] <= dur <= exp["dmax"]):
        print(f"   FAIL duration outside {exp['dmin']}-{exp['dmax']}s"); ok = False
    if not a:
        print("   FAIL no audio"); ok = False
    # black frames (pure black >= 0.25 s)
    r = run(["ffmpeg", "-hide_banner", "-i", str(p), "-vf", "blackdetect=d=0.25:pix_th=0.04", "-an", "-f", "null", "-"])
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr)
    print(f"   black segments (>=0.25s): {len(blacks)} {blacks[:5]}")
    if blacks:
        ok = False
    # audio levels
    r = run(["ffmpeg", "-hide_banner", "-i", str(p), "-af", "volumedetect,ebur128=peak=true", "-vn", "-f", "null", "-"])
    mx = re.findall(r"max_volume: (-?[\d.]+) dB", r.stderr)
    lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)
    print(f"   max volume {mx[-1] if mx else '?'} dB, integrated {lufs[-1] if lufs else '?'} LUFS, true peak {tp[-1] if tp else '?'} dBFS")
    if mx and float(mx[-1]) >= 0.0:
        print("   FAIL clipping"); ok = False
    print("   PASS" if ok else "   ISSUES FOUND")
    return ok, dur


def check_srt(p, vdur=None):
    text = p.read_text(encoding="utf-8")
    blocks = [b for b in text.strip().split("\n\n") if b.strip()]
    t = lambda s: sum(float(x) * m for x, m in zip(s.replace(",", ".").split(":"), (3600, 60, 1)))
    prev, ok = -1, True
    for b in blocks:
        lines = b.split("\n")
        a, c = lines[1].split(" --> ")
        s, e = t(a), t(c)
        if e <= s or s < prev - 1e-3 or len(lines) - 2 > 2:
            ok = False
        prev = e
    last = t(blocks[-1].split("\n")[1].split(" --> ")[1])
    print(f"   {p.name}: {len(blocks)} cues, last ends {last:.2f}s{'' if vdur is None else f' (video {vdur:.2f}s)'}  {'PASS' if ok else 'FAIL'}")
    return ok


def sheets(dst):
    dst = Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    for name in EXPECT:
        p = OUT / name
        if not p.exists():
            continue
        tile = "6x5" if "Full" in name else "6x2"
        every = 9 if "Full" in name else 3
        run(["ffmpeg", "-v", "error", "-y", "-i", str(p), "-vf", f"fps=1/{every},scale=480:-1,tile={tile}", "-frames:v", "1", str(dst / (p.stem + "_sheet.png"))])
    print("contact sheets ->", dst)


if __name__ == "__main__":
    all_ok, durs = True, {}
    for name, exp in EXPECT.items():
        p = OUT / name
        if not p.exists():
            print(f"\n== {name}: MISSING"); all_ok = False; continue
        ok, d = check_video(p, exp)
        durs[name] = d
        all_ok &= ok
    print("\n== subtitles")
    for srt in sorted(OUT.glob("*.srt")):
        all_ok &= check_srt(srt)
    thumb = OUT / "FACTMAN_Thumbnail.png"
    print(f"\n== thumbnail: {'present' if thumb.exists() else 'MISSING'}")
    if "--sheets" in sys.argv:
        sheets(sys.argv[sys.argv.index("--sheets") + 1])
    print("\nOVERALL:", "PASS" if all_ok else "CHECK ISSUES ABOVE")
