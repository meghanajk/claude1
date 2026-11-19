"""Build subbarow_reel.mp4 (1080x1920, 30fps).

Timeline is driven by the real duration of each voiceover clip (audio/trim/lineNN.wav).
Scene images come from scenes.json, so AI images can be dropped in later without code changes.
Usage: python3 scripts/build.py [output.mp4]
"""
import json, math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ROOT = "/home/user/claude1"
W, H, FPS, SR = 1080, 1920, 30, 48000
LEAD, GAP, PAUSE_BEFORE_LAST, TAIL = 0.40, 0.30, 1.00, 1.50
MUSIC_GAIN = 0.10          # music at ~10% of voice level
DARK_FROM = 5              # darker, muted grade from line 5 onwards
OUT = sys.argv[1] if len(sys.argv) > 1 else f"{ROOT}/subbarow_reel.mp4"

LINES = open(f"{ROOT}/work/lines.txt").read().strip().split("\n")
KEYWORDS = ["Telugu man", "Yellapragada Subbarow", "energy", "cancer", "pain", "disease",
            "no money", "Harvard", "no permanent job", "53", "Don't"]
SCENES = json.load(open(f"{ROOT}/scenes.json"))

# ---------- audio: voice track ----------
def read_wav(p):
    with wave.open(p) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, w.getnchannels())
    return a.astype(np.float32) / 32768

clips = [read_wav(f"{ROOT}/audio/trim/line{i:02d}.wav") for i in range(1, 13)]
starts, t = [], LEAD
for i, c in enumerate(clips):
    if i == 11:
        t += PAUSE_BEFORE_LAST - GAP
    starts.append(t)
    t += len(c) / SR + GAP
ends = [s + len(c) / SR for s, c in zip(starts, clips)]
TOTAL = ends[-1] + TAIL
N = int(round(TOTAL * FPS))
TOTAL = N / FPS
voice = np.zeros((int(TOTAL * SR) + SR, 2), np.float32)
for s, c in zip(starts, clips):
    i = int(s * SR); voice[i:i + len(c)] += c
voice = voice[:int(TOTAL * SR)]

# ---------- audio: original soft sad pad (synthesized here, so no licence issues) ----------
def music(n):
    tt = np.arange(n) / SR
    out = np.zeros(n, np.float32)
    # A minor - F - C - E minor, 6 s per chord
    chords = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [52, 55, 59]]
    seg = 6.0
    for k in range(int(math.ceil(n / SR / seg)) + 1):
        notes = chords[k % 4]
        a, b = int(k * seg * SR), int(min(n, (k * seg + seg + 2.0) * SR))
        if a >= n: break
        lt = tt[a:b] - k * seg
        env = np.minimum(1, lt / 2.0) * np.clip((seg + 2.0 - lt) / 2.0, 0, 1)
        for m in notes:
            f = 440 * 2 ** ((m - 69) / 12)
            for det in (-0.6, 0.6):
                out[a:b] += env * (np.sin(2 * np.pi * (f + det) * lt) + 0.25 * np.sin(4 * np.pi * (f + det) * lt))
        # one soft high melody note per chord
        f = 440 * 2 ** ((notes[-1] + 12 - 69) / 12)
        pe = np.exp(-lt * 1.2) * np.minimum(1, lt / 0.02)
        out[a:b] += 0.6 * pe * np.sin(2 * np.pi * f * lt)
    fade = np.minimum(1, tt / 2.0) * np.clip((n / SR - tt) / 3.0, 0, 1)
    out *= fade
    return out / np.abs(out).max()

voice_peak = np.abs(voice).max()
mus = music(len(voice)) * voice_peak * MUSIC_GAIN
mix = voice + np.stack([mus, mus], -1)
mix = mix / max(1.0, np.abs(mix).max() / 0.95)
with wave.open(f"{ROOT}/work/mix.wav", "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())

# ---------- subtitles ----------
F_REG = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", 66)
F_KEY = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Black.otf", 66)

def tokens(line):
    marks = [False] * len(line)
    for k in KEYWORDS:
        j = line.find(k)
        while j >= 0:
            for x in range(j, j + len(k)): marks[x] = True
            j = line.find(k, j + 1)
    out, pos = [], 0
    for word in line.split(" "):
        j = line.index(word, pos); pos = j + len(word)
        # split a word into bold/regular runs (e.g. "Don't." -> "Don't" bold + "." regular)
        runs, cur, cb = [], "", None
        for ch, m in zip(word, marks[j:pos]):
            if cb is None or m == cb: cur += ch
            else: runs.append((cur, cb)); cur = ch
            cb = m
        runs.append((cur, cb))
        out.append(runs)
    return out

def render_sub(line):
    words = tokens(line)
    sp = F_REG.getlength(" ")
    wlen = lambda runs: sum((F_KEY if b else F_REG).getlength(t) for t, b in runs)
    rows, cur, cw = [], [], 0
    for wd in words:
        l = wlen(wd)
        if cur and cw + sp + l > 920:
            rows.append((cur, cw)); cur, cw = [], 0
        cw += (sp if cur else 0) + l; cur.append(wd)
    rows.append((cur, cw))
    lh = 84
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    y0 = 1330 - (len(rows) * lh) // 2 + lh // 2
    for r, (row, rw) in enumerate(rows):
        x = (W - rw) / 2; y = y0 + r * lh
        for wi, wd in enumerate(row):
            if wi: x += sp
            for t, b in wd:
                f = F_KEY if b else F_REG
                d.text((x, y), t, font=f, fill=(255, 255, 255, 255), anchor="ls",
                       stroke_width=3, stroke_fill=(15, 15, 15, 230))
                x += f.getlength(t)
    a = np.asarray(txt)[..., 3]
    shadow = Image.fromarray((a * 0.75).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    img.paste((0, 0, 0, 255), (0, 6), shadow)
    img.alpha_composite(txt)
    return img

SUBS = [render_sub(l) for l in LINES]

# ---------- images ----------
def load_scene(sc, idx):
    p = sc["image"]
    if p.startswith("PLACEHOLDER:"):
        im = Image.new("RGB", (1440, 2560), (28, 26, 24))
        d = ImageDraw.Draw(im)
        f = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Bold.otf", 64)
        d.multiline_text((720, 900), "AI SCENE PENDING\n\n" + p[12:].replace(", ", "\n"),
                         font=f, fill=(150, 140, 125), anchor="mm", align="center")
    else:
        im = Image.open(f"{ROOT}/{p}").convert("RGB")
        r = im.width / im.height
        if abs(r - 9 / 16) > 0.01:  # centre-crop anything not 9:16
            if r > 9 / 16:
                nw = int(im.height * 9 / 16); x = (im.width - nw) // 2; im = im.crop((x, 0, x + nw, im.height))
            else:
                nh = int(im.width * 16 / 9); y = (im.height - nh) // 2; im = im.crop((0, y, im.width, y + nh))
        im = im.resize((1440, 2560), Image.LANCZOS)
    if idx + 1 >= DARK_FROM:  # darker, muted tones
        im = ImageEnhance.Color(im).enhance(0.55)
        im = ImageEnhance.Brightness(im).enhance(0.72)
        im = ImageEnhance.Contrast(im).enhance(1.05)
    return im

# scene i covers [seg_start_i, seg_start_{i+1})
seg_starts = [0.0] + starts[1:]
seg_ends = seg_starts[1:] + [TOTAL]
imgs = [load_scene(SCENES[i], i) for i in range(12)]

def frame(fi):
    t = fi / FPS
    i = max(k for k in range(12) if seg_starts[k] <= t)
    sc, im = SCENES[i], imgs[i]
    p = (t - seg_starts[i]) / (seg_ends[i] - seg_starts[i])
    p = p * p * (3 - 2 * p) * 0.6 + p * 0.4           # gentle ease
    move = sc.get("move", "zoom_in")
    z0, z1 = (1.0, 1.10) if move == "zoom_in" else (1.10, 1.0) if move == "zoom_out" else (1.06, 1.06)
    z = z0 + (z1 - z0) * p
    cw, ch = 1440 / z, 2560 / z
    cx, cy = 720, sc.get("focus_y", 1280)
    if move == "pan_left": cx = 720 + (1440 - cw) / 2 * (0.8 - 1.6 * p)
    if move == "pan_right": cx = 720 - (1440 - cw) / 2 * (0.8 - 1.6 * p)
    if move == "pan_up": cy = 1280 + (2560 - ch) / 2 * (0.8 - 1.6 * p)
    cx = min(max(cx, cw / 2), 1440 - cw / 2); cy = min(max(cy, ch / 2), 2560 - ch / 2)
    sx, sy = cw / W, ch / H
    fr = im.transform((W, H), Image.AFFINE, (sx, 0, cx - cw / 2, 0, sy, cy - ch / 2), Image.BICUBIC)
    # short crossfade (0.3 s) from previous scene
    if i > 0 and t - seg_starts[i] < 0.3:
        prev = frame_cache.get(i - 1)
        if prev is not None:
            fr = Image.blend(prev, fr, (t - seg_starts[i]) / 0.3)
    if t >= seg_ends[i] - 1 / FPS - 1e-6:
        frame_cache[i] = fr
    fr = fr.convert("RGBA")
    # subtitle: shown while line i is spoken (and the short gap after), simple fade-in
    if t >= starts[i]:
        a = min(1.0, (t - starts[i]) / 0.25)
        sub = SUBS[i]
        if a < 1:
            sub = sub.copy(); sub.putalpha(sub.getchannel("A").point(lambda v: int(v * a)))
        fr.alpha_composite(sub)
    # final fade to black over last 0.8 s
    if t > TOTAL - 0.8:
        fr = Image.blend(fr, Image.new("RGBA", (W, H), (0, 0, 0, 255)), (t - (TOTAL - 0.8)) / 0.8)
    return fr.convert("RGB")

frame_cache = {}
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                       "-r", str(FPS), "-i", "-", "-i", f"{ROOT}/work/mix.wav",
                       "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-b:a", "192k", "-t", f"{TOTAL:.3f}", "-movflags", "+faststart", OUT],
                      stdin=subprocess.PIPE)
for fi in range(N):
    ff.stdin.write(frame(fi).tobytes())
ff.stdin.close(); ff.wait()

json.dump({"total": TOTAL, "frames": N,
           "lines": [{"n": i + 1, "start": round(s, 3), "end": round(e, 3), "text": l}
                     for i, (s, e, l) in enumerate(zip(starts, ends, LINES))]},
          open(f"{ROOT}/work/timeline.json", "w"), indent=1)
print(f"done {OUT}  {TOTAL:.2f}s  {N} frames")
