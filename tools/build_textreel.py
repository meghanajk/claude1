"""Text-only version (no voiceover, no music, no SFX), styled after assets/reference_reel.mp4.

Reference measurements (720x1280 source, x1.5 to 1080x1920):
  card box  : pure black, left ~x140, top ~y1017, text left-aligned, one sentence per card
  font      : Poppins Bold ~52px, tight tracking (-1px), line pitch ~71px, white text
  highlight : per-line box with an orange #FF8214 -> white -> green #5CF836 gradient, black text
  tag       : 'Story: <name>' top-right (x723-1016, y51-108), name on the same gradient
  logo      : small round logo, bottom centre
  cuts      : quick blur transition on each card change; ends on the logo on black
Script text is the final script, unchanged, split only at sentence boundaries.
"""
import json, math, os, re, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = "/home/user/claude1"; C, OUT = f"{ROOT}/clean", f"{ROOT}/output"
os.makedirs(f"{OUT}/previews", exist_ok=True)
W, H, FPS = 1080, 1920, 30
FONT = f"{ROOT}/assets/fonts/Poppins-Bold.ttf"
SZ, TRACK, PITCH = 53, -2.2, 71
BOX_X, BOX_Y, PADX, PADY, MAXW = 140, 1017, 22, 16, 730
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
G_OR, G_MID, G_GR = np.array([255, 130, 20]), np.array([255, 250, 240]), np.array([92, 248, 54])

# ---------------- cards: (text, highlighted phrases, visuals, quick-cut section?) ----------------
CARDS = [
    ("Pongal. Every fan was ready to celebrate.", ["Pongal.", "ready to celebrate."],
     [("photo", "photo_confetti", "zoom_in"), ("vid", "vid3_rally", 5.6)], True),
    ("But Vijay's last film was stuck.", ["Vijay's last film", "stuck."],
     [("vid", "vid1_film", 0.3), ("vid", "vid1_film", 3.35)], True),
    ("It was due on January 9, but a dispute with the censor board postponed it.", ["January 9,", "censor board postponed it."],
     [("photo", "photo_master", "zoom_in"), ("vid", "vid3_rally", 8.0), ("photo", "photo_jacket", "zoom_out")], True),
    ("This wasn't just any film. It was his farewell.", ["his farewell."],
     [("vid", "vid1_film", 1.6), ("vid", "vid1_film", 7.2)], False),
    ("On December 27, 2025, he announced his retirement after a 33-year career.", ["December 27, 2025,", "retirement", "33-year career."],
     [("photo", "photo_greyshirt", "zoom_in"), ("photo", "photo_sunglasses", "pan_up")], False),
    ("Fans had waited years for this day.", ["waited years"], [("vid", "vid3_rally", 44.0)], False),
    ("So what does a superstar do when the festival comes and his film doesn't?", ["superstar", "his film doesn't?"],
     [("vid", "vid3_rally", 9.4), ("vid", "vid3_rally", 51.8), ("vid", "vid1_film", 4.3)], True),
    ("He didn't stop. His party, TVK, had taken shape in 2024.", ["didn't stop.", "2024."],
     [("vid", "vid3_rally", 11.4), ("vid", "vid3_rally", 29.0)], False),
    ("He fought the 2026 election and became Tamil Nadu's Chief Minister.", ["2026 election", "Tamil Nadu's Chief Minister."],
     [("vid", "vid3_rally", 20.45), ("vid", "vid2_assembly", 0.0)], False),
    ("The film stayed on hold.", ["stayed on hold."], [("vid", "vid2_assembly", 3.3)], False),
    ("Then in July, Jana Nayagan finally hit theatres.", ["July,", "Jana Nayagan finally hit theatres."],
     [("vid", "vid3_rally", 33.5)], False),
    ("Fans danced and sang outside cinema halls, happy it had finally reached the screen,", ["danced and sang", "finally reached the screen,"],
     [("vid", "vid3_rally", 5.5), ("vid", "vid3_rally", 50.0)], False),
    ("yet emotional because it was his farewell.", ["emotional", "his farewell."],
     [("vid", "vid3_rally", 14.0), ("vid", "vid1_film", 7.2)], False),
    ("The Pongal he missed became the biggest film festival of his life.", ["Pongal", "biggest film festival of his life."],
     [("photo", "photo_confetti", "zoom_out"), ("vid", "vid3_rally", 54.0)], False),
    ("Follow for more real stories.", ["real stories."], [("end",)], False),
]
# check the cards reproduce the final script exactly
script = " ".join(l.split("|", 1)[1] for l in open(f"{ROOT}/work/script.txt").read().strip().split("\n"))
assert " ".join(c[0] for c in CARDS) == script, "cards must match the final script word for word"

# reading time: ~0.27 s/word + 1.3 s to find the card, clamped; end card holds the logo reveal
durs = [min(5.6, max(2.4, 1.3 + 0.27 * len(c[0].split()))) for c in CARDS[:-1]] + [3.4]
TOTAL = round(sum(durs) * FPS) / FPS
assert TOTAL < 60, TOTAL
starts = np.concatenate([[0], np.cumsum(durs)[:-1]])
NF = int(round(TOTAL * FPS))

# ---------------- text rendering ----------------
f = ImageFont.truetype(FONT, SZ)
def tlen(s): return f.getlength(s) + TRACK * max(0, len(s) - 1)
def draw_tracked(d, x, y, s, fill):
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill, anchor="ls"); x += f.getlength(ch) + TRACK

def gradient(w, h):
    u = np.linspace(0, 1, max(2, int(w)))[None, :, None]
    a = np.where(u < 0.5, G_OR + (G_MID - G_OR) * (u / 0.5), G_MID + (G_GR - G_MID) * ((u - 0.5) / 0.5))
    return Image.fromarray(np.repeat(a, int(h), 0).astype(np.uint8))

def card_img(text, phrases):
    words = [{"w": w} for w in text.split()]
    for pi, ph in enumerate(phrases):          # mark first occurrence of each phrase
        p = ph.split()
        for k in range(len(words) - len(p) + 1):
            if [x["w"] for x in words[k:k + len(p)]] == p and not any("ph" in x for x in words[k:k + len(p)]):
                for x in words[k:k + len(p)]: x["ph"] = pi
                break
        else: raise SystemExit(f"phrase not found: {ph}")
    # wrap (never split a highlighted phrase if it fits on one line)
    sp = tlen(" ") + 2; lines, cur, x = [], [], 0
    units = []
    for w in words:
        if units and "ph" in w and units[-1][-1].get("ph") == w["ph"] and tlen(" ".join(u["w"] for u in units[-1] + [w])) <= MAXW:
            units[-1].append(w)
        else: units.append([w])
    for u in units:
        ul = tlen(" ".join(w["w"] for w in u))
        if cur and x + sp + ul > MAXW: lines.append(cur); cur, x = [], 0
        for w in u:
            if cur: x += sp
            wl = tlen(w["w"]); cur.append((w, x, wl)); x += wl
    if cur: lines.append(cur)
    tw = max(l[-1][1] + l[-1][2] for l in lines)
    bw, bh = int(tw + 2 * PADX), int(PADY * 2 + (len(lines) - 1) * PITCH + SZ * 1.18)
    im = Image.new("RGBA", (bw, bh), BLACK + (255,)); d = ImageDraw.Draw(im)
    for li, line in enumerate(lines):
        y = PADY + li * PITCH
        # one gradient box per highlighted run on this line
        runs = []
        for w, x, wl in line:
            if "ph" in w:
                if runs and runs[-1][2] == w["ph"]: runs[-1][1] = x + wl
                else: runs.append([x, x + wl, w["ph"]])
        for x0, x1, _ in runs:
            g = gradient(x1 - x0 + 10, SZ * 1.12); im.paste(g, (int(PADX + x0 - 5), int(y + 1)))
        for w, x, wl in line:
            draw_tracked(d, PADX + x, y + SZ * 0.98, w["w"], BLACK if "ph" in w else WHITE)
    return im

def tag_img(a, b, sz=29):
    """Rounded black pill (as in the reference): white 'Story:' + name on the gradient."""
    ft = ImageFont.truetype(FONT, sz); pad, h = 12, 58
    ga, gb = ft.getlength(a), ft.getlength(b); w = int(pad + ga + 8 + gb + 12 + pad)
    im = Image.new("RGBA", (w, h), BLACK + (255,)); d = ImageDraw.Draw(im)
    g = gradient(gb + 12, h - 18).convert("RGBA"); gm = Image.new("L", g.size, 0)
    ImageDraw.Draw(gm).rounded_rectangle([0, 0, g.size[0] - 1, g.size[1] - 1], radius=5, fill=255)
    im.paste(g, (int(pad + ga + 8), 9), gm)
    d.text((pad, h / 2 + 1), a, font=ft, fill=WHITE, anchor="lm"); d.text((pad + ga + 14, h / 2 + 1), b, font=ft, fill=BLACK, anchor="lm")
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=9, fill=255)
    im.putalpha(m); return im

def paste(frame, im, x, y, alpha=1.0):
    a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    a = a[y0 - y:y1 - y, x0 - x:x1 - x]; al = a[..., 3:4] / 255 * alpha
    frame[y0:y1, x0:x1] = (frame[y0:y1, x0:x1] * (1 - al) + a[..., 2::-1] * al).astype(np.uint8)

# ---------------- sources (same cleaned media as v1) ----------------
SRC_CUTS = {"vid3_rally": [3.73, 5.47, 7.9, 11.2, 17.07, 20.4, 22.43, 28.83, 43.97, 46.47, 49.53, 53.6, 57.8],
            "vid1_film": [3.27, 5.47, 7.17, 9.1], "vid2_assembly": [7.7]}
_photos = {}
def photo_frame(name, move, u, quick):
    if name not in _photos: _photos[name] = cv2.imread(f"{C}/{name}.png")
    im = _photos[name]; ih, iw = im.shape[:2]; e = u * u * (3 - 2 * u); amt = 0.15 if quick else 0.10
    if move == "zoom_in": z, py = 1 + amt * e, 0.4
    elif move == "zoom_out": z, py = 1 + amt * (1 - e), 0.4
    else: z, py = 1.12, 0.7 - 0.4 * e
    cw, chh = iw / z, ih / z; x0 = (iw - cw) / 2; y0 = (ih - chh) * py
    M = np.array([[W / cw, 0, -x0 * W / cw], [0, H / chh, -y0 * H / chh]], np.float32)
    return cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_LANCZOS4)

class Clip:
    def __init__(self, name, t_src, dur):
        self.cap = cv2.VideoCapture(f"{C}/{name}.mp4")
        self.end = min([c for c in SRC_CUTS[name] if c > t_src + 0.1] + [99])
        avail = self.end - t_src - 0.04
        self.speed = 1.0 if avail >= dur else max(0.6, avail / dur)
        self.t_src, self.idx, self.frame = t_src, -1, None
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t_src * FPS)))
    def get(self, dt):
        want = min(int(round((self.t_src + dt * self.speed) * FPS)), int(self.end * FPS) - 2)
        while self.idx < want:
            ok, fr = self.cap.read()
            if not ok: break
            self.frame = fr; self.idx = int(self.cap.get(cv2.CAP_PROP_POS_FRAMES)) - 1
        return self.frame

def zoom(fr, z):
    if z <= 1.0005: return fr
    return cv2.warpAffine(fr, cv2.getRotationMatrix2D((W / 2, H * 0.42), 0, z), (W, H), flags=cv2.INTER_LINEAR)

# shot list: each card's visuals split evenly across the card
shots = []
for ci, (txt, _, vis, quick) in enumerate(CARDS):
    n = len(vis)
    for k, v in enumerate(vis):
        shots.append({"card": ci, "src": v, "quick": quick,
                      "t0": starts[ci] + durs[ci] * k / n, "t1": starts[ci] + durs[ci] * (k + 1) / n})
shots[-1]["t1"] = TOTAL
cut_times = [s["t0"] for s in shots[1:]]
card_times = list(starts[1:])

# ---------------- overlays ----------------
cards = [card_img(c[0], c[1]) for c in CARDS]
logo = Image.open(f"{C}/logo_badge.png").convert("RGBA")
logo_small = logo.resize((112, 112), Image.LANCZOS)
logo_big = logo.resize((520, 520), Image.LANCZOS)
tag = tag_img("Story:", "Vijay")
END_T = starts[-1]

def render(t, base):
    fr = base.copy(); ci = int(np.searchsorted(starts, t, side="right") - 1)
    if ci < len(CARDS) - 1:
        paste(fr, tag, 1016 - tag.width, 52)
        paste(fr, logo_small, (W - 112) // 2, 1660, 0.92)
        paste(fr, cards[ci], BOX_X, BOX_Y)
    else:
        dt = t - END_T; e = min(1, dt / 0.7); e = e * e * (3 - 2 * e)
        sz = int(520 * (0.82 + 0.18 * e)); lb = logo_big.resize((sz, sz), Image.LANCZOS)
        paste(fr, lb, (W - sz) // 2, 560 + (520 - sz) // 2, e)
        a = min(1, max(0, (dt - 0.5) / 0.3))
        paste(fr, cards[ci], (W - cards[ci].width) // 2, 1200, a)
    return fr

def end_bg(t):
    """Dark, slightly warm vignette, like the reference's logo outro on black."""
    yy, xx = np.mgrid[0:H, 0:W]; r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - 840) / H) ** 2)
    v = np.clip(0.16 - r * 0.22, 0, 1)
    return (np.dstack([v * 120, v * 150, v * 210])).astype(np.uint8)
END_BG = end_bg(0)

def blur_amt(t, times, width, peak):
    d = min([abs(t - c) for c in times] + [9])
    return peak * max(0, 1 - d / width)

# ---------------- render ----------------
silent = f"{ROOT}/work/textreel_video.mp4"
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                        "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                        "-profile:v", "high", "-movflags", "+faststart", silent], stdin=subprocess.PIPE)
clips = {}
for fi in range(NF):
    t = fi / FPS
    si = max(i for i, s in enumerate(shots) if s["t0"] <= t + 1e-6); sh = shots[si]
    dt, dur = t - sh["t0"], sh["t1"] - sh["t0"]
    if sh["src"][0] == "photo":
        base = photo_frame(sh["src"][1], sh["src"][2], min(1, dt / dur), sh["quick"])
    elif sh["src"][0] == "vid":
        if si not in clips: clips = {si: Clip(sh["src"][1], sh["src"][2], dur)}
        base = zoom(clips[si].get(dt), 1.0 + (0.05 if sh["quick"] else 0.035) * dt / dur)
    else:
        base = END_BG
    # in-card cuts: soft background blur; card changes: whole frame (text too) blurs through the cut
    bb = blur_amt(t, [c for c in cut_times if c not in card_times], 0.10, 10)
    if bb > 0.5: base = cv2.GaussianBlur(base, (0, 0), bb)
    fr = render(t, base)
    cb = blur_amt(t, card_times, 0.12, 16)
    if cb > 0.5: fr = cv2.GaussianBlur(fr, (0, 0), cb)
    enc.stdin.write(fr.tobytes())
enc.stdin.close(); enc.wait()

final = f"{OUT}/reel_final.mp4"
# silent stereo AAC track: keeps the file standard for upload; add in-app music later if wanted
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", "-metadata", "title=Pongal Without His Film",
                "-movflags", "+faststart", final], check=True)

def srt_t(x):
    ms = int(round(x * 1000)); return f"{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}"
with open(f"{OUT}/subtitles.srt", "w") as fh:
    for i, (c, s, d) in enumerate(zip(CARDS, starts, durs), 1):
        fh.write(f"{i}\n{srt_t(s)} --> {srt_t(min(s + d, TOTAL))}\n{c[0]}\n\n")

SCENES = {"hook": 0, "scene1": 3, "rehook": 6, "scene2": 7, "scene3": 10, "end": 13}
for k, ci in SCENES.items():
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{starts[ci]:.3f}", "-i", final, "-t", "3", "-c:v", "libx264",
                    "-crf", "18", "-c:a", "aac", f"{OUT}/previews/{k}.mp4"], check=True)
json.dump({"total": TOTAL, "cards": [{"text": c[0], "s": float(s), "e": float(s + d),
           "rect": [BOX_X, BOX_Y, BOX_X + im.width, BOX_Y + im.height] if i < len(CARDS) - 1 else
                   [(W - im.width) // 2, 1200, (W + im.width) // 2, 1200 + im.height]}
           for i, (c, s, d, im) in enumerate(zip(CARDS, starts, durs, cards))]},
          open(f"{ROOT}/work/textreel_timeline.json", "w"), indent=1)
print("TOTAL", TOTAL, "cards", len(CARDS), "durations", [round(d, 2) for d in durs])
