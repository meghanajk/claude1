"""STEP 2: build output/reel_final.mp4 (1080x1920, 30 fps, H.264 + AAC) from ./clean only.

Pipeline: narration (edge-tts sections + word timings) -> tighten sentence pauses ->
global word timeline -> subtitles (2-4 words, reference style) + SRT -> shot list cut on words ->
frames (Ken Burns photos, video clips, logo, text pops, subtitles) -> mux with ducked music.
"""
import json, math, os, re, subprocess, wave
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = "/home/user/claude1"
C, OUT = f"{ROOT}/clean", f"{ROOT}/output"
os.makedirs(OUT, exist_ok=True); os.makedirs(f"{OUT}/previews", exist_ok=True)
W, H, FPS, SR = 1080, 1920, 30, 48000
SECTIONS = ["HOOK", "SCENE1", "REHOOK", "SCENE2", "SCENE3", "END"]
LEAD, SEC_GAP, MAX_PAUSE, END_HOLD = 0.15, 0.28, 0.32, 1.9

# ---------------- style (measured from assets/subtitle_reference.jpg, x1.5 to 1080 wide) ----------------
FONT = f"{ROOT}/assets/fonts/Poppins-Bold.ttf"
BOX = (10, 10, 11)            # near-black subtitle box
TXT = (244, 244, 240)         # off-white text
GREEN = (86, 183, 88)         # highlight box
GTXT = (10, 12, 10)           # text on highlight
SUB_SIZE, SUB_PITCH = 62, 72  # font px, line pitch
SUB_X, SUB_TOP, SUB_MAXW = 82, 1360, 790   # box left/top, max text width (stays clear of IG side buttons)
PADX, PADY = 22, 18

# ---------------- narration ----------------
def load_mp3(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

script = {k: t for k, t in (l.split("|", 1) for l in open(f"{ROOT}/work/script.txt").read().strip().split("\n"))}
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())

voice_parts, words, sec_spans, t = [], [], {}, LEAD
for key in SECTIONS:
    a = load_mp3(f"{ROOT}/work/vo/{key}.mp3")
    bnd = json.load(open(f"{ROOT}/work/vo/{key}.json"))
    # split the section at long pauses and shorten each pause to MAX_PAUSE
    pieces, cur0 = [], max(0, bnd[0]["s"] - 0.04)
    for i in range(len(bnd) - 1):
        gap = bnd[i + 1]["s"] - bnd[i]["e"]
        if gap > MAX_PAUSE:
            cut = bnd[i]["e"] + MAX_PAUSE / 2
            pieces.append((cur0, cut, i)); cur0 = bnd[i + 1]["s"] - MAX_PAUSE / 2
    pieces.append((cur0, min(len(a) / SR, bnd[-1]["e"] + 0.12), len(bnd) - 1))
    sec_start = t; first = 0
    for (s0, s1, last) in pieces:
        seg = a[int(s0 * SR):int(s1 * SR)].copy()
        f = int(0.006 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)  # click-free joins
        voice_parts.append((t, seg))
        for b in bnd[first:last + 1]:
            words.append({"sec": key, "text": b["w"], "s": t + b["s"] - s0, "e": t + b["e"] - s0})
        first = last + 1; t += len(seg) / SR
    sec_spans[key] = (sec_start, t)
    t += SEC_GAP
speech_end = t - SEC_GAP
TOTAL = math.ceil((speech_end + END_HOLD) * FPS) / FPS
NF = int(round(TOTAL * FPS))
voice = np.zeros(int(TOTAL * SR) + SR, np.float32)
for st, seg in voice_parts:
    i = int(st * SR); voice[i:i + len(seg)] += seg
voice = voice[:int(TOTAL * SR)]
voice *= 0.89 / np.abs(voice).max()

# map boundary tokens back onto the exact script words (keeps punctuation; splits merged tokens)
swords = []
for key in SECTIONS:
    sw = script[key].split(); bw = [w for w in words if w["sec"] == key]; j = 0
    for b in bw:
        grp, acc = [], ""
        while norm(acc) != norm(b["text"]) and j < len(sw):
            grp.append(sw[j]); acc += sw[j]; j += 1
        assert norm(acc) == norm(b["text"]), (key, b["text"], acc)
        L = sum(len(g) for g in grp); s = b["s"]
        for g in grp:
            d = (b["e"] - b["s"]) * len(g) / L
            swords.append({"sec": key, "w": g, "s": s, "e": s + d}); s += d
    assert j == len(sw), key

# keywords (green highlight), per section
KEYS = {"HOOK": ["Pongal", "January 9", "censor board", "postponed"],
        "SCENE1": ["farewell", "December 27, 2025", "retirement", "33-year career"],
        "REHOOK": ["superstar", "festival"],
        "SCENE2": ["TVK", "2024", "2026 election", "Chief Minister"],
        "SCENE3": ["July", "Jana Nayagan", "danced and sang", "emotional", "farewell"],
        "END": ["Pongal", "biggest film festival", "real stories"]}
for key in SECTIONS:
    idx = [i for i, w in enumerate(swords) if w["sec"] == key]
    for ph in KEYS[key]:
        p = [norm(x) for x in ph.split()]
        for k in range(len(idx) - len(p) + 1):
            if [norm(swords[idx[k + m]]["w"]) for m in range(len(p))] == p:
                for m in range(len(p)): swords[idx[k + m]]["hl"] = True; swords[idx[k + m]]["ph"] = f"{key}:{ph}"
                break
        else:
            raise SystemExit(f"keyword not found: {ph}")

# ---------------- subtitle chunks: 2-4 words, broken at sentence ends ----------------
FUNC = {"the", "a", "of", "with", "for", "to", "on", "in", "and", "his", "it", "had", "was"}
def split_seg(seg):
    """Cheapest split of one sentence/clause into chunks of 1-4 words: never split a keyword phrase
    or a capitalised name pair, avoid ending a chunk on a function word, prefer 3-4 words on one line."""
    n = len(seg); f = ImageFont.truetype(FONT, SUB_SIZE)
    def cost(a, b):          # chunk = seg[a:b]
        m = b - a
        if m > 4: return 1e9
        c = {1: 6, 2: 1.5, 3: 0, 4: 0.3}[m] if n > 1 else 0
        if f.getlength(" ".join(w["w"] for w in seg[a:b])) > SUB_MAXW: c += 8
        if b < n:
            l, r = seg[b - 1], seg[b]
            if l.get("hl") and l.get("ph") == r.get("ph"): c += 50
            if l["w"][:1].isupper() and r["w"][:1].isupper() and not re.search(r"[.,?!]$", l["w"]): c += 30
            if norm(l["w"]) in FUNC: c += 4
        return c
    best = [0] + [1e18] * n; arg = [0] * (n + 1)
    for b in range(1, n + 1):
        for a in range(max(0, b - 4), b):
            v = best[a] + cost(a, b)
            if v < best[b]: best[b], arg[b] = v, a
    out, b = [], n
    while b > 0: out.append(seg[arg[b]:b]); b = arg[b]
    return out[::-1]

chunks = []
for key in SECTIONS:
    sw = [w for w in swords if w["sec"] == key]; seg = []
    segs = []
    for i, w in enumerate(sw):
        seg.append(w)
        nxt = sw[i + 1]["w"] if i + 1 < len(sw) else ""
        if re.search(r"[.?!]$", w["w"]) or (w["w"].endswith(",") and len(seg) >= 2 and not nxt[:1].isdigit()):
            segs.append(seg); seg = []
    if seg: segs.append(seg)
    for seg in segs:
        chunks += split_seg(seg)
for i, ch in enumerate(chunks):
    nxt = chunks[i + 1][0]["s"] if i + 1 < len(chunks) else TOTAL
    ch_end = min(nxt, ch[-1]["e"] + 0.45) if i + 1 < len(chunks) else TOTAL
    chunks[i] = {"words": ch, "s": ch[0]["s"], "e": ch_end, "sec": ch[0]["sec"]}

def srt_t(x):
    ms = int(round(x * 1000)); return f"{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}"
with open(f"{OUT}/subtitles.srt", "w") as f:
    for i, ch in enumerate(chunks, 1):
        f.write(f"{i}\n{srt_t(ch['s'])} --> {srt_t(ch['e'])}\n{' '.join(w['w'] for w in ch['words'])}\n\n")

# ---------------- text rendering ----------------
_fonts = {}
def font(sz):
    if sz not in _fonts: _fonts[sz] = ImageFont.truetype(FONT, sz)
    return _fonts[sz]

def layout(ws, sz, maxw):
    """Greedy wrap -> lines of (word, x, width); a keyword phrase is never split across lines."""
    f = font(sz); sp = f.getlength(" ")
    units = []
    for w in ws:
        if units and w.get("ph") and units[-1][-1].get("ph") == w.get("ph"): units[-1].append(w)
        else: units.append([w])
    lines, cur, x = [], [], 0
    for u in units:
        ul = f.getlength(" ".join(w["w"] for w in u))
        if cur and x + sp + ul > maxw:
            lines.append(cur); cur, x = [], 0
        for w in u:
            if cur: x += sp
            wl = f.getlength(w["w"]); cur.append((w, x, wl)); x += wl
    if cur: lines.append(cur)
    return lines

def caption_img(ws, lit, sz=SUB_SIZE, pitch=SUB_PITCH, maxw=SUB_MAXW):
    """Reference style: solid near-black box, left-aligned white text, highlighted words on a
    green box with dark text (adjacent highlighted words share one box). `lit` = number of words
    already spoken: a keyword's green box appears exactly when it is spoken."""
    f = font(sz); lines = layout(ws, sz, maxw)
    tw = max(l[-1][1] + l[-1][2] for l in lines)
    bw, bh = int(tw + 2 * PADX), int(len(lines) * pitch + 2 * PADY - (pitch - sz * 1.12))
    im = Image.new("RGBA", (bw, bh), BOX + (255,)); d = ImageDraw.Draw(im)
    asc = f.getmetrics()[0]; order = {id(w): i for i, w in enumerate(ws)}
    for li, line in enumerate(lines):
        y = PADY + li * pitch
        core = lambda w: f.getlength(re.sub(r"[.,?!]+$", "", w["w"]))
        on = [(w, x, core(w)) for (w, x, wl) in line if w.get("hl") and order[id(w)] < lit]
        # merge adjacent lit keywords into one green run
        runs = []
        for w, x, wl in on:
            if runs and order[id(w)] == runs[-1][2] + 1 and ws[runs[-1][2]].get("ph") == w.get("ph") and not re.search(r"[.,?!]$", ws[runs[-1][2]]["w"]):
                runs[-1] = (runs[-1][0], x + wl, order[id(w)])
            else: runs.append((x, x + wl, order[id(w)]))
        for x0, x1, _ in runs:
            d.rounded_rectangle([PADX + x0 - 6, y - 2, PADX + x1 + 6, y + int(sz * 1.12)], radius=5, fill=GREEN)
        for w, x, wl in line:
            hl = w.get("hl") and order[id(w)] < lit
            if hl:
                cw = re.sub(r"[.,?!]+$", "", w["w"]); punct = w["w"][len(cw):]
                d.text((PADX + x, y + sz * 0.98), cw, font=f, fill=GTXT, anchor="ls")
                if punct: d.text((PADX + x + f.getlength(cw) + 7, y + sz * 0.98), punct, font=f, fill=TXT, anchor="ls")
            else:
                d.text((PADX + x, y + sz * 0.98), w["w"], font=f, fill=TXT, anchor="ls")
    return im

def tag_img(a, b, sz):
    """'A: B' label: white A on black, B on a green box (the reference's 'Story: Name' tag)."""
    f = font(sz); pad = int(sz * 0.32); ga = f.getlength(a); gb = f.getlength(b)
    w = int(pad + ga + pad * 0.8 + gb + pad * 1.6 + pad); h = int(sz * 1.55)
    im = Image.new("RGBA", (w, h), BOX + (255,)); d = ImageDraw.Draw(im)
    bx0 = pad + ga + pad * 0.8
    d.rounded_rectangle([bx0, pad * 0.45, bx0 + gb + pad * 1.6, h - pad * 0.45], radius=4, fill=GREEN)
    d.text((pad, h * 0.5), a, font=f, fill=TXT, anchor="lm")
    d.text((bx0 + pad * 0.8, h * 0.5), b, font=f, fill=GTXT, anchor="lm")
    return im

def paste(frame, im, x, y, alpha=1.0):
    """Alpha-blend RGBA PIL image onto a BGR uint8 frame at (x, y), clipped."""
    a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    a = a[y0 - y:y1 - y, x0 - x:x1 - x]; al = a[..., 3:4] / 255 * alpha
    reg = frame[y0:y1, x0:x1].astype(np.float32)
    frame[y0:y1, x0:x1] = (reg * (1 - al) + a[..., 2::-1] * al).astype(np.uint8)

# ---------------- shot list: (section, first word index of the cut, source) ----------------
SHOTS = [
    ("HOOK", 0, ("photo", "photo_confetti", "zoom_in")),
    ("HOOK", 1, ("vid", "vid3_rally", 5.6)),
    ("HOOK", 5, ("vid", "vid3_rally", 49.7)),
    ("HOOK", 7, ("vid", "vid1_film", 0.3)),
    ("HOOK", 11, ("vid", "vid1_film", 3.35)),
    ("HOOK", 13, ("photo", "photo_master", "zoom_in")),
    ("HOOK", 18, ("vid", "vid3_rally", 8.0)),
    ("HOOK", 25, ("photo", "photo_jacket", "zoom_out")),
    ("SCENE1", 0, ("vid", "vid1_film", 1.6)),
    ("SCENE1", 5, ("vid", "vid1_film", 7.2)),
    ("SCENE1", 9, ("photo", "photo_greyshirt", "zoom_in")),
    ("SCENE1", 15, ("photo", "photo_sunglasses", "pan_up")),
    ("SCENE1", 19, ("vid", "vid3_rally", 44.0)),
    ("REHOOK", 0, ("vid", "vid3_rally", 9.4)),
    ("REHOOK", 6, ("vid", "vid3_rally", 51.8)),
    ("REHOOK", 10, ("vid", "vid1_film", 4.3)),
    ("SCENE2", 0, ("vid", "vid3_rally", 11.4)),
    ("SCENE2", 3, ("vid", "vid3_rally", 29.0)),
    ("SCENE2", 10, ("vid", "vid3_rally", 20.45)),
    ("SCENE2", 15, ("vid", "vid2_assembly", 0.0)),
    ("SCENE3", 0, ("vid", "vid3_rally", 33.5)),
    ("SCENE3", 8, ("vid", "vid3_rally", 5.5)),
    ("SCENE3", 12, ("vid", "vid3_rally", 52.0)),
    ("SCENE3", 15, ("vid", "vid3_rally", 14.0)),
    ("SCENE3", 22, ("vid", "vid1_film", 7.2)),
    ("END", 0, ("photo", "photo_confetti", "zoom_out")),
    ("END", 4, ("vid", "vid3_rally", 54.0)),
    ("END", 12, ("endcard", None, None)),
]
# where each source's own shots end (never run a clip across a cut in the source)
SRC_CUTS = {"vid3_rally": [3.73, 5.47, 7.9, 11.2, 17.07, 20.4, 22.43, 28.83, 43.97, 46.47, 49.53, 53.6, 57.8],
            "vid1_film": [3.27, 5.47, 7.17, 9.1], "vid2_assembly": [7.7]}
QUICK = {"HOOK", "REHOOK"}

def sec_word(key, i): return [w for w in words if w["sec"] == key][i]
starts = []
for k, (sec, wi, src) in enumerate(SHOTS):
    s = 0.0 if k == 0 else sec_word(sec, wi)["s"] - 0.05   # cut just before the word lands
    if wi == 0 and k > 0: s = sec_spans[sec][0] - SEC_GAP / 2
    starts.append(s)
shots = [{"sec": s[0], "src": s[2], "t0": starts[i], "t1": starts[i + 1] if i + 1 < len(starts) else TOTAL}
         for i, s in enumerate(SHOTS)]

# ---------------- sources ----------------
_photos = {}
def photo_frame(name, move, u, quick):
    if name not in _photos: _photos[name] = cv2.imread(f"{C}/{name}.png")
    im = _photos[name]; ih, iw = im.shape[:2]
    e = u * u * (3 - 2 * u)                       # ease in-out
    amt = 0.16 if quick else 0.11
    if move == "zoom_in":  z, py = 1 + amt * e, 0.4
    elif move == "zoom_out": z, py = 1 + amt * (1 - e), 0.4
    elif move == "pan_up": z, py = 1.12, 0.7 - 0.4 * e
    else: z, py = 1.12, 0.3 + 0.4 * e
    cw, chh = iw / z, ih / z
    x0 = (iw - cw) / 2; y0 = (ih - chh) * py
    M = np.array([[W / cw, 0, -x0 * W / cw], [0, H / chh, -y0 * H / chh]], np.float32)
    return cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_LANCZOS4)  # sub-pixel smooth motion

class Clip:
    def __init__(self, name, t_src, dur):
        self.cap = cv2.VideoCapture(f"{C}/{name}.mp4")
        end = min([c for c in SRC_CUTS[name] if c > t_src + 0.1] + [99])
        avail = end - t_src - 0.04
        self.speed = 1.0 if avail >= dur else max(0.6, avail / dur)   # gentle slow-mo if the shot is short
        self.t_src, self.end, self.last, self.idx, self.frame = t_src, end, None, -1, None
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t_src * FPS)))
    def get(self, dt):
        want = int(round((self.t_src + dt * self.speed) * FPS))
        want = min(want, int(self.end * FPS) - 2)
        while self.idx < want:
            ok, f = self.cap.read()
            if not ok: break
            self.frame = f
            self.idx = int(self.cap.get(cv2.CAP_PROP_POS_FRAMES)) - 1
        return self.frame

def punch(frame, z):
    if z <= 1.0005: return frame
    M = cv2.getRotationMatrix2D((W / 2, H * 0.42), 0, z)
    return cv2.warpAffine(frame, M, (W, H), flags=cv2.INTER_LINEAR)

# ---------------- overlays ----------------
logo = Image.open(f"{C}/logo_badge.png").convert("RGBA")
logo_small = logo.resize((138, 138), Image.LANCZOS)
# soft ring so the cream badge separates from bright footage
ring = Image.new("RGBA", (146, 146), (0, 0, 0, 0)); ImageDraw.Draw(ring).ellipse([0, 0, 145, 145], fill=(0, 0, 0, 110))
ring.alpha_composite(logo_small, (4, 4)); logo_small = ring
logo_big = logo.resize((560, 560), Image.LANCZOS)
story_tag = tag_img("Story:", "Vijay", 36)

POPS = [("HOOK", 0, "Pongal", "2026"), ("HOOK", 17, "Jan 9:", "Postponed"),
        ("SCENE1", 10, "Dec 2025:", "Retirement"), ("SCENE2", 16, "2026:", "Chief Minister"),
        ("SCENE3", 2, "July:", "Release")]
pops = []
for sec, wi, a, b in POPS:
    s = sec_word(sec, wi)["s"]; pops.append({"s": s, "e": s + 2.6, "im": tag_img(a, b, 64)})
for i in range(len(pops) - 1): pops[i]["e"] = min(pops[i]["e"], pops[i + 1]["s"] - 0.1)
POP_Y = 330

def pop_scale(dt):
    if dt < 0.12: return 0.6 + 0.5 * dt / 0.12           # 0.6 -> 1.1
    if dt < 0.22: return 1.1 - 0.1 * (dt - 0.12) / 0.10  # settle to 1.0
    return 1.0

end_start = shots[-1]["t0"]
title_card = tag_img("Pongal", "Without His Film", 48)
_cap_cache = {}

def overlays(frame, t):
    in_end = t >= end_start
    if not in_end:
        paste(frame, logo_small, 56, 128)                      # small logo, top-left, whole reel
        paste(frame, story_tag, W - story_tag.width - 24, 124)  # reference 'Story:' tag, top-right
    for p in pops:
        if p["s"] <= t < p["e"]:
            dt = t - p["s"]; sc = pop_scale(dt); al = min(1, (p["e"] - t) / 0.18)
            im = p["im"].resize((max(1, int(p["im"].width * sc)), max(1, int(p["im"].height * sc))), Image.BICUBIC)
            paste(frame, im, (W - im.width) // 2, POP_Y + (p["im"].height - im.height) // 2, al)
    if in_end:
        dt = t - end_start; e = min(1, dt / 0.35); e = e * e * (3 - 2 * e)
        sz = int(560 * (0.85 + 0.15 * e)); lb = logo_big.resize((sz, sz), Image.LANCZOS)
        paste(frame, lb, (W - sz) // 2, 470 + (560 - sz) // 2, e)
        paste(frame, title_card, (W - title_card.width) // 2, 1100, e)
    for ch in chunks:
        if ch["s"] <= t < ch["e"] and not (ch["s"] < end_start - 0.01 and t >= end_start):
            lit = sum(1 for w in ch["words"] if w["s"] <= t + 0.02)
            key = (id(ch), lit)
            if key not in _cap_cache: _cap_cache[key] = caption_img(ch["words"], lit)
            im = _cap_cache[key]
            y = 1290 if in_end else SUB_TOP
            x = (W - im.width) // 2 if in_end else SUB_X
            paste(frame, im, x, y)
            ch.setdefault("rects", {})[(x, y, x + im.width, y + im.height)] = t   # last time shown at this spot

# ---------------- music: original placeholder (synthesised here, royalty-free) + ducking ----------------
def music(n):
    tt = np.arange(n) / SR; out = np.zeros(n, np.float32); bpm = 100; beat = 60 / bpm
    nb = int(n / SR / beat) + 1
    prog = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]]  # D Bm G A
    for b in range(nb):
        a = int(b * beat * SR)
        if a >= n: break
        L = min(n - a, int(beat * SR)); lt = np.arange(L) / SR
        # soft kick on every beat, light clap on 2 and 4
        out[a:a + L] += 0.9 * np.sin(2 * np.pi * (52 + 70 * np.exp(-lt * 30)) * lt) * np.exp(-lt * 9)
        if b % 2 == 1:
            out[a:a + L] += 0.25 * np.random.default_rng(b).standard_normal(L) * np.exp(-lt * 28)
        # plucked arpeggio, 2 notes per beat
        ch = prog[(b // 8) % 4]
        for h in range(2):
            m = ch[(b * 2 + h) % 4] + 12; a2 = a + int(h * beat / 2 * SR)
            L2 = min(n - a2, int(beat * SR)); l2 = np.arange(max(0, L2)) / SR
            f = 440 * 2 ** ((m - 69) / 12)
            out[a2:a2 + L2] += 0.22 * np.exp(-l2 * 7) * (np.sin(2 * np.pi * f * l2) + 0.3 * np.sin(4 * np.pi * f * l2))
    # warm pad under it
    for k in range(int(n / SR / (8 * beat)) + 1):
        a = int(k * 8 * beat * SR); L = min(n - a, int(8 * beat * SR))
        if L <= 0: break
        lt = np.arange(L) / SR; env = np.minimum(1, lt / 0.8) * np.minimum(1, (L / SR - lt) / 0.8)
        for m in prog[k % 4][:3]:
            f = 440 * 2 ** ((m - 69) / 12)
            out[a:a + L] += 0.10 * env * (np.sin(2 * np.pi * f * lt) + np.sin(2 * np.pi * f * 1.003 * lt))
    fade = np.minimum(1, tt / 1.0) * np.clip((n / SR - tt) / 1.5, 0, 1)
    return out / np.abs(out).max() * fade

mus = music(len(voice))
env = np.abs(voice); k = int(0.25 * SR)
env = np.convolve(env, np.ones(k) / k, "same"); env = np.clip(env / (env.max() * 0.35), 0, 1)
gain = 0.30 - 0.21 * env                          # ~-10.5 dB under the voice, back up in gaps
mix = voice + mus * gain
mix = mix / max(1.0, np.abs(mix).max() / 0.97)
with wave.open(f"{ROOT}/work/reel_mix.wav", "w") as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((mix * 32767).astype(np.int16).tobytes())

# ---------------- render ----------------
silent = f"{ROOT}/work/reel_video.mp4"
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                        "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", silent],
                       stdin=subprocess.PIPE)
clips, prev = {}, None
for fi in range(NF):
    t = fi / FPS
    si = max(i for i, s in enumerate(shots) if s["t0"] <= t + 1e-6)
    sh = shots[si]; dt = t - sh["t0"]; dur = sh["t1"] - sh["t0"]; quick = sh["sec"] in QUICK
    kind = sh["src"][0]
    if kind == "photo":
        frame = photo_frame(sh["src"][1], sh["src"][2], min(1, dt / dur), quick)
    elif kind == "vid":
        if si not in clips: clips = {si: Clip(sh["src"][1], sh["src"][2], dur)}
        frame = clips[si].get(dt).copy()
        z = 1.0 + (0.05 if quick else 0.035) * dt / dur          # slow push-in keeps video alive
        if quick and dt < 0.12: z += 0.06 * (1 - dt / 0.12)       # punch on quick cuts
        frame = punch(frame, z)
    else:  # end card: last END clip frame, blurred + darkened (0.3 s blend in)
        if "card_bg" not in clips:
            clips = {"card_src": prev, "card_bg": (cv2.GaussianBlur(prev, (0, 0), 28) * 0.42).astype(np.uint8)}
        e = min(1, dt / 0.3)
        frame = cv2.addWeighted(clips["card_src"], 1 - e, clips["card_bg"], e, 0)
    prev = frame
    overlays(frame, t)
    enc.stdin.write(frame.tobytes())
enc.stdin.close(); enc.wait()

final = f"{OUT}/reel_final.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", f"{ROOT}/work/reel_mix.wav",
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                "-metadata", "title=Pongal Without His Film", "-shortest", "-movflags", "+faststart", final], check=True)

# 3-second preview of each scene
for key in SECTIONS:
    s = sec_spans[key][0]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, s - 0.05):.3f}", "-i", final, "-t", "3",
                    "-c:v", "libx264", "-crf", "18", "-c:a", "aac", f"{OUT}/previews/{key.lower()}.mp4"], check=True)

json.dump({"total": TOTAL, "sections": sec_spans, "shots": [{k: v for k, v in s.items()} for s in shots],
           "chunks": [{"s": c["s"], "e": c["e"], "rects": [[int(v) for v in r] + [round(tt, 3)] for r, tt in c["rects"].items()], "text": " ".join(w["w"] for w in c["words"])} for c in chunks],
           "words": swords}, open(f"{ROOT}/work/reel_timeline.json", "w"), indent=1, default=str)
print("TOTAL", round(TOTAL, 2), "frames", NF, "sections", {k: (round(a, 2), round(b, 2)) for k, (a, b) in sec_spans.items()})
