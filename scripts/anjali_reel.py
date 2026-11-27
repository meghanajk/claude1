#!/usr/bin/env python3
"""Anjali Kulthe 26/11 reel: 720x1280, 30 fps, H.264 + AAC.

Usage:
  python scripts/anjali_reel.py --gen-images   # create missing AI images (needs OPENAI_API_KEY)
  python scripts/anjali_reel.py --test 1 4 9   # write full-size test frames to output/test/
  python scripts/anjali_reel.py                # full render -> output/anjali_reel.mp4
"""
import argparse, base64, glob, json, math, os, re, shutil, subprocess, sys, urllib.request
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

# =============================== CONFIG ======================================
SUBTITLE_HIGHLIGHT = "#FFD400"   # overridden by ./colour_ref.* if present
TEXT_COLOUR = "#FFFFFF"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, FPS = 720, 1280, 30
FONT_BOLD = os.path.join(ROOT, "fonts", "Poppins-Bold.ttf")
FONT_SEMI = os.path.join(ROOT, "fonts", "Poppins-SemiBold.ttf")
FOOTAGE_DIR = os.path.join(ROOT, "footage")
AI_DIR = os.path.join(ROOT, "images", "ai")
MUSIC = os.path.join(ROOT, "music.mp3")
OUT_DIR = os.path.join(ROOT, "output")
OUT_FILE = os.path.join(OUT_DIR, "anjali_reel.mp4")
TMP_DIR = os.path.join(OUT_DIR, "_beats")

ZOOM_FROM, ZOOM_TO = 1.00, 1.08
GRADIENT_TOP = 0.55            # gradient covers bottom 45 %
GRADIENT_MAX_ALPHA = int(0.85 * 255)
CAP_X, CAP_BOTTOM, CAP_MAXW = 64, 990, 560
CAP_SIZE, CAP_LINE_H, CAP_MAX_LINES = 38, 1.25, 3
CAP_MIN_SIZE = 32               # long captions shrink to stay within 3 lines
CAP_ANIM_S, CAP_RISE_PX = 0.25, 18
CREDIT_X, CREDIT_Y, CREDIT_SIZE = 72, 112, 15
BADGE_BOX = (580, 82, 672, 172)
SPLIT_H = 640
VIGNETTE_STRENGTH = 0.35
MUSIC_LUFS, MUSIC_FADE_IN, MUSIC_FADE_OUT = -18, 1.0, 2.0
X264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-profile:v", "high", "-level", "4.0", "-r", str(FPS), "-g", str(FPS),
        "-video_track_timescale", "15360"]

STYLE = ("Photorealistic documentary photo, vertical 9:16, shot on a phone, natural "
         "available light, slight grain, Mumbai 2008. No text, no logos, no recognisable "
         "real person. ")
# grade: "natural" | "bw" (dark high-contrast B&W) | "warm" (natural + vignette)
BEATS = [
 dict(n=1,  t=0.0,  d=4.0, grade="natural", text="On the night of 26/11, nurse **Anjali Kulthe** was on duty at **Mumbai's Cama Hospital**.",
      ai=["Old colonial-era stone hospital building entrance at dusk, street lamps on, a few people and taxis outside"]),
 dict(n=2,  t=4.0,  d=3.0, grade="natural", text="Under her care were **20 pregnant women**.",
      ai=["Crowded government maternity ward, rows of iron beds, pregnant Indian women resting, a nurse in white uniform seen from behind"]),
 dict(n=3,  t=7.0,  d=4.0, grade="bw", text="Just another regular shift. Until one glance out of a window **changed everything**.",
      ai=["Indian nurse in white uniform and cap seen from behind and side, face turned away, looking out of an old barred hospital window at night"]),
 dict(n=4,  t=11.0, d=3.0, grade="bw", split=True, text="Standing outside were **two heavily armed terrorists**.",
      ai=["Two dark silhouettes carrying rifles and backpacks standing at an iron hospital gate at night, faces not visible, street light behind",
          "Close-up of a nurse's hands gripping the bars of a hospital window at night, dark ward behind"]),
 dict(n=5,  t=14.0, d=3.0, grade="bw", text="In seconds, the hospital became **a war zone**.",
      ai=["Long dark empty hospital corridor at night, flickering tube light, smoke haze, debris on floor"]),
 dict(n=6,  t=17.0, d=3.5, grade="bw", text="But instead of running, she **slammed the ward doors shut**",
      ai=["Nurse in white uniform seen from behind pushing heavy wooden ward doors shut in a dim hospital corridor, motion blur"]),
 dict(n=7,  t=20.5, d=3.0, grade="bw", text="and moved terrified patients **to safety**.",
      ai=["Pregnant women in sarees walking hurriedly down a dim hospital corridor, guided by a nurse, seen from behind"]),
 dict(n=8,  t=23.5, d=3.5, grade="warm", text="As grenades shook the hospital, one woman **went into labour**.",
      ai=["Pregnant Indian woman in labour clutching a hospital bed rail in a dim ward, face partly hidden in shadow, nurse's hands supporting her"]),
 dict(n=9,  t=27.0, d=4.0, grade="warm", text="A delay could **cost two lives**. So Anjali made **a fearless choice**.",
      ai=["Nurse in white uniform helping a pregnant woman up a narrow old stone staircase in a dark hospital, both seen from behind"]),
 dict(n=10, t=31.0, d=4.0, grade="warm", text="Shielding her from the gunfire, she **helped bring her baby into the world**.",
      ai=["Close-up of a nurse's hands in white uniform holding a newborn baby wrapped in a cloth, soft lamp light"]),
 dict(n=11, t=35.0, d=3.0, grade="warm", text="By sunrise, **all 20 women had survived**.",
      ai=["Old hospital maternity ward at sunrise, warm golden light through tall windows, women resting on beds, peaceful"]),
 dict(n=12, t=38.0, d=3.5, grade="warm", split=True, text="Weeks later, she stood **eye-to-eye with Ajmal Kasab**",
      ai=["Silhouette of a young man sitting in a police lock-up cell behind bars, face in total shadow, single window light",
          "Back of the head and shoulders of an Indian nurse in a white uniform and cap, facing forward in a dim room"]),
 dict(n=13, t=41.5, d=3.0, grade="warm", split=True, text="and identified him **without fear**.",
      ai=["Wide shot of an old Indian courtroom with wooden benches and judge's bench, lawyers in black coats, seen from the back",
          "Nurse in white uniform standing at a wooden witness box, seen from behind, hand raised pointing"]),
 dict(n=14, t=44.5, d=3.0, grade="warm", text="\"It was **the power of the uniform**.\"",
      ai=["Portrait of a generic middle-aged Indian nurse in a white uniform and cap, calm proud expression, soft window light, shallow depth of field"]),
 dict(n=15, t=47.5, d=3.5, grade="warm", text="And for that, **India salutes them**.",
      ai=["Indian nurse in white uniform seen from behind standing on a rooftop facing the Mumbai city skyline at golden hour"]),
]
END_CARD = dict(t=51.0, d=3.0, text="Story Today")
TOTAL = END_CARD["t"] + END_CARD["d"]
# =============================================================================


def font(path, size):
    return ImageFont.truetype(path, size)


def sample_highlight():
    refs = sorted(glob.glob(os.path.join(ROOT, "colour_ref.*")))
    if not refs:
        return SUBTITLE_HIGHLIGHT, None
    im = Image.open(refs[0]).convert("RGB").resize((200, 200))
    best = max(im.getdata(), key=lambda p: (max(p) - min(p)) * max(p))  # most saturated & bright
    return "#%02X%02X%02X" % best, refs[0]


def find_footage(n):
    hits = sorted(glob.glob(os.path.join(FOOTAGE_DIR, f"{n:02d}*")))
    return hits[0] if hits else None


def footage_source(path):
    stem = os.path.splitext(os.path.basename(path))[0]
    name = re.sub(r"^\d+[_\- ]*", "", stem).replace("_", " ").strip()
    return name or "Own footage"


def ai_path(n, i):
    return os.path.join(AI_DIR, f"beat{n:02d}{'ab'[i]}.png")


def cover(im, w, h):
    return ImageOps.fit(im.convert("RGB"), (w, h), Image.LANCZOS, centering=(0.5, 0.45))


def placeholder(label, w, h):
    im = Image.new("RGB", (w, h), (52, 56, 64))
    d = ImageDraw.Draw(im)
    for y in range(0, h, 40):
        d.line([(0, y), (w, y + 200)], fill=(60, 64, 72), width=12)
    d.text((40, h * 0.3), "PLACEHOLDER", font=font(FONT_BOLD, 40), fill=(150, 150, 150))
    words, line, yy = label.split(), "", h * 0.3 + 60
    f = font(FONT_SEMI, 22)
    for wd in words:
        if d.textlength(line + " " + wd, font=f) > w - 80:
            d.text((40, yy), line, font=f, fill=(170, 170, 170)); yy += 30; line = wd
        else:
            line = (line + " " + wd).strip()
    d.text((40, yy), line, font=f, fill=(170, 170, 170))
    return im


# ------------------------------ grading --------------------------------------
_vig_cache = {}


def vignette_mask(w, h):
    if (w, h) not in _vig_cache:
        m = Image.radial_gradient("L").resize((w, h))          # 0 centre .. 255 edge
        m = m.point(lambda v: int(max(0, v - 90) * 255 / 165 * VIGNETTE_STRENGTH))
        _vig_cache[(w, h)] = m
    return _vig_cache[(w, h)]


def grade(im, kind):
    if kind == "bw":
        g = ImageOps.grayscale(im)
        g = ImageEnhance.Contrast(g).enhance(1.45)
        g = ImageEnhance.Brightness(g).enhance(0.78)
        return Image.merge("RGB", (g, g, g))
    if kind == "warm":
        black = Image.new("RGB", im.size, 0)
        return Image.composite(black, im, vignette_mask(*im.size))
    return im


# ------------------------------ overlays -------------------------------------
def gradient_overlay():
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    top = int(H * GRADIENT_TOP)
    px = ov.load()
    for y in range(top, H):
        a = int(GRADIENT_MAX_ALPHA * ((y - top) / (H - top)) ** 0.9)
        for x in range(W):
            px[x, y] = (0, 0, 0, a)
    return ov


def brand_badge(size_box=BADGE_BOX, scale=1.0):
    x0, y0, x1, y1 = size_box
    bw, bh = int((x1 - x0) * scale), int((y1 - y0) * scale)
    ss = 4
    im = Image.new("RGBA", (bw * ss, bh * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, bw * ss - 1, bh * ss - 1], radius=22 * ss * scale, fill=(196, 30, 58, 255))
    d.rounded_rectangle([12 * ss * scale, bh * ss - 16 * ss * scale, 36 * ss * scale, bh * ss - 11 * ss * scale],
                        radius=3 * ss, fill=SUBTITLE_HIGHLIGHT)
    f = font(FONT_BOLD, int(22 * ss * scale))
    d.text((11 * ss * scale, 14 * ss * scale), "Story", font=f, fill="white")
    d.text((11 * ss * scale, 40 * ss * scale), "Today", font=f, fill="white")
    return im.resize((bw, bh), Image.LANCZOS)


def parse_words(text):
    """Words as lists of (piece, highlighted). Pieces not separated by a space stay
    glued, so '**Hospital**.' keeps its full stop attached."""
    words, glue = [], False
    for i, part in enumerate(text.split("**")):
        hl = i % 2 == 1
        toks = part.split(" ")
        for j, tok in enumerate(toks):
            if tok == "":
                glue = False
                continue
            if j == 0 and glue and words:
                words[-1].append((tok, hl))
            else:
                words.append([(tok, hl)])
            glue = True
        glue = glue and not part.endswith(" ")
    return words


def layout_caption(text, f):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    space = d.textlength(" ", font=f)
    lines, cur, curw = [], [], 0
    for word in parse_words(text):
        ww = sum(d.textlength(t, font=f) for t, _ in word)
        add = ww if not cur else space + ww
        if cur and curw + add > CAP_MAXW:
            lines.append(cur); cur, curw = [word], ww
        else:
            cur.append(word); curw += add
    if cur:
        lines.append(cur)
    if len(lines) > CAP_MAX_LINES:
        raise ValueError(f"caption exceeds {CAP_MAX_LINES} lines: {text}")
    return lines, space


def fit_caption(text):
    """Largest size <= CAP_SIZE (min CAP_MIN_SIZE) that fits in CAP_MAX_LINES."""
    for size in range(CAP_SIZE, CAP_MIN_SIZE - 1, -1):
        try:
            f = font(FONT_BOLD, size)
            return size, f, *layout_caption(text, f)
        except ValueError:
            pass
    raise ValueError(f"caption does not fit even at {CAP_MIN_SIZE}px: {text}")


def caption_layer(text):
    size, f, lines, space = fit_caption(text)
    lh = size * CAP_LINE_H
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d, sd = ImageDraw.Draw(layer), ImageDraw.Draw(shadow)
    asc, desc = f.getmetrics()
    top = CAP_BOTTOM - len(lines) * lh
    for i, line in enumerate(lines):
        x, y = CAP_X, top + i * lh + (lh - (asc + desc)) / 2
        for word in line:
            for piece, hl in word:
                d.text((x, y), piece, font=f, fill=SUBTITLE_HIGHLIGHT if hl else TEXT_COLOUR)
                sd.text((x, y + 2), piece, font=f, fill=(0, 0, 0, 150))
                x += d.textlength(piece, font=f)
            x += space
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    return Image.alpha_composite(shadow, layer)


def credit_layer(label):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(FONT_SEMI, CREDIT_SIZE)
    d.text((CREDIT_X + 1, CREDIT_Y + 1), label, font=f, fill=(0, 0, 0, 140))
    d.text((CREDIT_X, CREDIT_Y), label, font=f, fill=(255, 255, 255, 235))
    return layer


# ------------------------------ sources --------------------------------------
class StillSource:
    def __init__(self, im, w, h):
        self.w, self.h = w, h
        self.base = cover(im, int(w * 1.5), int(h * 1.5))   # oversample for smooth zoom

    def frame(self, i, n):
        z = ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * (i / max(1, n - 1))
        bw, bh = self.base.size
        cw, ch = bw / z, bh / z
        x0, y0 = (bw - cw) / 2, (bh - ch) / 2
        sx, sy = cw / self.w, ch / self.h
        return self.base.transform((self.w, self.h), Image.AFFINE, (sx, 0, x0, 0, sy, y0), Image.BICUBIC)


class ClipSource:
    """Decodes a video clip (looped if short), scaled to cover, then zoomed."""
    def __init__(self, path, w, h, n):
        self.w, self.h = w, h
        bw, bh = int(w * ZOOM_TO) + 2, int(h * ZOOM_TO) + 2
        cmd = ["ffmpeg", "-v", "error", "-stream_loop", "-1", "-i", path,
               "-vf", f"fps={FPS},scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh}",
               "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        raw = subprocess.run(cmd, check=True, capture_output=True).stdout
        fs = bw * bh * 3
        self.frames = [Image.frombytes("RGB", (bw, bh), raw[k:k + fs]) for k in range(0, len(raw), fs)]
        self.bw, self.bh = bw, bh

    def frame(self, i, n):
        z = ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * (i / max(1, n - 1))
        src = self.frames[min(i, len(self.frames) - 1)]
        cw, ch = self.w * ZOOM_TO / z, self.h * ZOOM_TO / z
        x0, y0 = (self.bw - cw) / 2, (self.bh - ch) / 2
        return src.transform((self.w, self.h), Image.AFFINE, (cw / self.w, 0, x0, 0, ch / self.h, y0), Image.BICUBIC)


def make_source(path, label, w, h, n):
    if path and os.path.splitext(path)[1].lower() in (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"):
        return ClipSource(path, w, h, n)
    if path and os.path.exists(path):
        return StillSource(Image.open(path), w, h)
    return StillSource(placeholder(label, w, h), w, h)


def beat_plan(b):
    """Returns (list of (path_or_None, prompt) panels, credit label, uses_placeholder)."""
    foot = find_footage(b["n"])
    if foot:
        return [(foot, "")] * (2 if b.get("split") else 1), f"Source: {footage_source(foot)}", False
    panels = [(ai_path(b["n"], i), p) for i, p in enumerate(b["ai"][: 2 if b.get("split") else 1])]
    ph = any(not os.path.exists(p) for p, _ in panels)
    return [(p if os.path.exists(p) else None, pr) for p, pr in panels], "AI generated image", ph


# ------------------------------ rendering ------------------------------------
GRAD = None


def render_beat_frames(b):
    global GRAD
    GRAD = GRAD or gradient_overlay()
    n = round(b["d"] * FPS)
    panels, credit, _ = beat_plan(b)
    split = b.get("split")
    ph = SPLIT_H if split else H
    sources = [make_source(p, pr, W, ph, n) for p, pr in panels]
    cap = caption_layer(b["text"])
    static = Image.alpha_composite(Image.alpha_composite(GRAD, credit_layer(credit)), Image.new("RGBA", (W, H)))
    badge = brand_badge()
    anim_n = CAP_ANIM_S * FPS
    for i in range(n):
        canvas = Image.new("RGB", (W, H))
        for k, s in enumerate(sources):
            canvas.paste(grade(s.frame(i, n), b["grade"]), (0, k * SPLIT_H))
        if split:
            ImageDraw.Draw(canvas).line([(0, SPLIT_H), (W, SPLIT_H)], fill=(0, 0, 0), width=2)
        fr = Image.alpha_composite(canvas.convert("RGBA"), static)
        fr.alpha_composite(badge, (BADGE_BOX[0], BADGE_BOX[1]))
        p = min(1.0, i / anim_n)
        e = 1 - (1 - p) ** 3
        if p < 1:
            c = cap.copy()
            c.putalpha(c.getchannel("A").point(lambda v: int(v * e)))
            fr.alpha_composite(c, (0, int(round(CAP_RISE_PX * (1 - e)))))
        else:
            fr.alpha_composite(cap)
        yield fr.convert("RGB")


def render_end_frames():
    n = round(END_CARD["d"] * FPS)
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(250 - 40 * t), int(252 - 30 * t), 255))
    f = font(FONT_BOLD, 64)
    tw = d.textlength(END_CARD["text"], font=f)
    asc, desc = f.getmetrics()
    x, y = (W - tw) / 2, (H - asc - desc) / 2
    d.text((x, y), "Story", font=f, fill=(196, 30, 58))
    d.text((x + d.textlength("Story ", font=f), y), "Today", font=f, fill=(22, 34, 82))
    d.rounded_rectangle([x, y + asc + desc + 6, x + 60, y + asc + desc + 14], radius=4, fill=SUBTITLE_HIGHLIGHT)
    for _ in range(n):
        yield bg


def encode(frames, out_path, n):
    tmp = out_path + ".part.mp4"
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", *X264, "-frames:v", str(n), "-an", tmp]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fr in frames:
        p.stdin.write(fr.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        sys.exit(f"ffmpeg failed for {out_path}")
    os.replace(tmp, out_path)


def full_render():
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    os.makedirs(TMP_DIR)
    parts = []
    for b in BEATS:
        out = os.path.join(TMP_DIR, f"beat{b['n']:02d}.mp4")
        print(f"beat {b['n']:2d}  {b['t']:5.1f}s  {b['d']}s", flush=True)
        encode(render_beat_frames(b), out, round(b["d"] * FPS))
        parts.append(out)
    out = os.path.join(TMP_DIR, "beat99_end.mp4")
    encode(render_end_frames(), out, round(END_CARD["d"] * FPS))
    parts.append(out)
    lst = os.path.join(TMP_DIR, "list.txt")
    with open(lst, "w") as fh:
        fh.writelines(f"file '{os.path.basename(p)}'\n" for p in parts)
    silent = os.path.join(TMP_DIR, "video.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent], check=True)

    if os.path.exists(MUSIC):
        afilt = (f"[1:a]atrim=0:{TOTAL},asetpts=N/SR/TB,loudnorm=I={MUSIC_LUFS}:TP=-1.5:LRA=11,"
                 f"afade=t=in:d={MUSIC_FADE_IN},afade=t=out:st={TOTAL - MUSIC_FADE_OUT}:d={MUSIC_FADE_OUT},"
                 f"aresample=48000,apad[a]")
        ain = ["-i", MUSIC]
    else:
        afilt = "[1:a]anull[a]"
        ain = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
    tmp = OUT_FILE + ".part.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, *ain, "-filter_complex", afilt,
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                    "-t", str(TOTAL), "-movflags", "+faststart", tmp], check=True)
    os.replace(tmp, OUT_FILE)
    return os.path.exists(MUSIC)


def test_frames(nums):
    os.makedirs(os.path.join(OUT_DIR, "test"), exist_ok=True)
    for num in nums:
        b = next(x for x in BEATS if x["n"] == num)
        n = round(b["d"] * FPS)
        for i, fr in enumerate(render_beat_frames(b)):
            if i in (3, n - 1):
                p = os.path.join(OUT_DIR, "test", f"beat{num:02d}_f{i:03d}.png")
                fr.save(p); print(p)


# ------------------------------ AI images ------------------------------------
def gen_images():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY not set")
    os.makedirs(AI_DIR, exist_ok=True)
    for b in BEATS:
        if find_footage(b["n"]):
            continue
        for i, prompt in enumerate(b["ai"][: 2 if b.get("split") else 1]):
            out = ai_path(b["n"], i)
            if os.path.exists(out):
                continue
            size = "1536x1024" if b.get("split") else "1024x1536"
            body = json.dumps({"model": "gpt-image-1", "prompt": STYLE + prompt, "size": size,
                               "quality": "high", "n": 1}).encode()
            req = urllib.request.Request("https://api.openai.com/v1/images/generations", body,
                                         {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            print("generating", os.path.basename(out), flush=True)
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.load(r)
            with open(out + ".part", "wb") as fh:
                fh.write(base64.b64decode(data["data"][0]["b64_json"]))
            os.replace(out + ".part", out)


def check_config():
    t = 0.0
    for b in BEATS:
        assert abs(b["t"] - t) < 1e-6, f"beat {b['n']} starts {b['t']}, expected {t}"
        t += b["d"]
        size, _, lines, _ = fit_caption(b["text"])
        print(f"  beat {b['n']:2d}: {len(lines)} lines @ {size}px" + ("  (shrunk)" if size < CAP_SIZE else ""))
    assert abs(END_CARD["t"] - t) < 1e-6
    assert 52 <= TOTAL <= 56


def main():
    global SUBTITLE_HIGHLIGHT
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", nargs="*", type=int)
    ap.add_argument("--gen-images", action="store_true")
    a = ap.parse_args()
    SUBTITLE_HIGHLIGHT, ref = sample_highlight()
    print("highlight", SUBTITLE_HIGHLIGHT, f"(sampled from {ref})" if ref else "(default)")
    check_config()
    if a.gen_images:
        return gen_images()
    if a.test is not None:
        return test_frames(a.test or [1, 4, 9])
    music = full_render()
    placeholders = [b["n"] for b in BEATS if beat_plan(b)[2]]
    print("wrote", OUT_FILE, "| music:", "yes" if music else "MISSING (silent AAC track)",
          "| placeholder beats:", placeholders or "none")


if __name__ == "__main__":
    main()
