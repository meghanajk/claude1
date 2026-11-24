import cv2, numpy as np, subprocess, sys, os, re
from PIL import Image, ImageDraw, ImageFont

U = '/root/.claude/uploads/1f641398-f9de-5a22-ab83-3c1cab6a1a2d/'
S = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
KEY = U + '6f332704-VID_20261124_194743_668.mp4'
VOL = U + '30ee8f0c-VID_20261124_194740_240.mp4'
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf'

# --- style sampled from reference image ---
TXT = (240, 239, 234)      # off-white text
CARD = (10, 10, 10)        # black card
HL = (87, 182, 88)         # green highlight box
HLTXT = (8, 12, 8)         # dark text on green
LOGO_D = 130               # 12% of width
LOGO_XY = (W - 56 - LOGO_D, 168)
LOGO_ALPHA = 0.85
CARD_X = 64                # left aligned, like reference
CARD_BOTTOM = 1590         # well clear of bottom 250px
MAX_TEXT_W = W - 2 * CARD_X - 2 * 26

# (src image, crop x0,y0,w,h in src coords, zoom focus (fx,fy) in crop coords)
STILLS = {
    'nv':      ('src/nv.png',      (322 - 202, 0, 405, 720)),
    'k_brick': ('src/k_brick.png', (177 - 108, 0, 217, 386)),
    'k_lab':   ('src/k_lab.png',   (340 - 114, 0, 228, 405)),
    'g_wsj':   ('src/g_wsj.png',   (158 - 98, 0, 196, 348)),
    'g_blue':  ('src/g_blue.png',  (159 - 68, 0, 137, 243)),
    'k_seat':  ('src/k_seat.png',  (171 - 76, 0, 152, 270)),
    'itoday':  ('src/itoday.png',  (452 - 114, 0, 228, 405)),
    'wiki':    ('src/wiki.png',    (9, 0, 484, 860)),
    'scmp':    ('src/scmp.png',    (315, 0, 405, 720)),
}

SCENES = [  # (dur, kind, source, text)
    (4, 'vid', ('key', 2.0, None), "HOOK: The chip behind **ChatGPT** was made for **video games**."),
    (3, 'img', 'nv', "It started with one man: **Jensen Huang**."),
    (4, 'img', 'k_brick', "**1993:** Three friends found **Nvidia** in a Denny's."),
    (4, 'img', 'k_lab', "Their goal? Faster, more realistic **game graphics**."),
    (4, 'img', 'g_wsj', "**1999:** The **GeForce 256** is marketed as the world's **first GPU**."),
    (4, 'vid', ('key', 6.6, None), "RE-HOOK: But the **gamers** weren't the ones who'd change the world..."),
    (4, 'img', 'g_blue', "**2006:** **CUDA** lets developers program GPUs directly."),
    (4, 'img', 'k_seat', "Scientists began using GPUs for more than **graphics**."),
    (4, 'img', 'itoday', "**2012:** GPU-powered **AlexNet** ushers in superhuman image recognition."),
    (3, 'vid', ('key', 23.0, 0.8), "Deep learning finally had its **engine**."),
    (4, 'img', 'wiki', "**2016:** Huang hand-delivers the first **AI server** to Elon Musk and Sam Altman."),
    (4, 'vid', ('key', 36.0, None), "Then came **ChatGPT**, reportedly trained on about **10,000** Nvidia GPUs."),
    (4, 'vid', ('vol', 1.5, None), "An estimated **70-80%** of AI chips are now Nvidia's."),
    (4, 'img', 'scmp', "In 2025, it became the first company worth **$5 trillion**."),
    (4, 'vid', ('key', 31.5, 0.8), "END: A **game chip** changed the world. Follow for more."),
]

# ---------------- grading / enhancement ----------------
def grade(img):
    """One consistent look for every scene: gentle S-curve contrast, slight warmth, mild saturation trim."""
    f = img.astype(np.float32) / 255.0
    f = f + 0.18 * (f - 0.5) * (1 - np.abs(2 * f - 1))          # soft S-curve
    hsv_gray = f.mean(axis=2, keepdims=True)
    f = hsv_gray + 0.95 * (f - hsv_gray)                         # saturation 0.95
    f[..., 2] *= 1.025; f[..., 0] *= 0.975                       # warm (BGR)
    return np.clip(f * 255 + 0.5, 0, 255).astype(np.uint8)

def autolevel(img, lo=0.4, hi=99.6):
    out = img.astype(np.float32)
    l = np.percentile(out, lo); h = np.percentile(out, hi)
    out = (out - l) * (255.0 / max(h - l, 1))
    return np.clip(out, 0, 255).astype(np.uint8)

def unsharp(img, sigma, amount):
    b = cv2.GaussianBlur(img, (0, 0), sigma)
    return cv2.addWeighted(img, 1 + amount, b, -amount, 0)

_still_cache = {}
ZOOM_MARGIN = 1.0
def prep_still(name):
    if name in _still_cache: return _still_cache[name]
    path, (x0, y0, w, h) = STILLS[name]
    src = cv2.imread(os.path.join(S, path))
    c = src[y0:y0 + h, x0:x0 + w]
    hs = 3 if w >= 300 else 2
    c = cv2.fastNlMeansDenoisingColored(c, None, hs, hs, 5, 15)     # gentle denoise (JPEG noise)
    c = autolevel(c)
    # staged Lanczos upscale with light sharpening between stages
    cur = c
    while cur.shape[1] * 2 < W:
        cur = cv2.resize(cur, (cur.shape[1] * 2, cur.shape[0] * 2), interpolation=cv2.INTER_LANCZOS4)
        cur = unsharp(cur, 1.0, 0.35)
    cur = cv2.resize(cur, (W, H), interpolation=cv2.INTER_LANCZOS4)
    cur = unsharp(cur, 1.6, 0.6)
    cur = grade(cur)
    _still_cache[name] = cur
    return cur

def still_frame(name, t, dur):
    base = prep_still(name)
    z = 1.0 + 0.05 * (t / dur)                                     # 5% slow zoom-in
    cx, cy = W / 2, H * 0.4                                         # zoom toward upper-centre (face area)
    M = np.float32([[z, 0, cx - z * cx], [0, z, cy - z * cy]])
    f = cv2.warpAffine(base, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    # fine film grain hides upscale smoothness; same strength on every still
    g = np.random.default_rng(int(t * 1000)).normal(0, 3.2, (H // 2, W // 2, 1)).astype(np.float32)
    g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    return np.clip(f.astype(np.float32) + g, 0, 255).astype(np.uint8)

# ---------------- video ----------------
def vid_filter(src, crop):
    if src == 'vol':
        # picture band of the Volaren clip is y=391..982; caption above and watermark below are cropped away
        return "crop=331:588:90:393,scale=1080:1920:flags=lanczos,hqdn3d=1.5:1.5:4:4,unsharp=5:5:0.7:5:5:0,eq=contrast=1.04"
    if crop:
        cw, ch = int(720 * crop) // 2 * 2, int(1280 * crop) // 2 * 2
        return f"crop={cw}:{ch}:{(720 - cw) // 2}:{int((1280 - ch) * 0.35)},scale=1080:1920:flags=lanczos,hqdn3d=1:1:3:3,unsharp=5:5:0.6:5:5:0"
    return "scale=1080:1920:flags=lanczos,hqdn3d=1:1:3:3,unsharp=5:5:0.5:5:5:0"

def vid_frames(spec, dur):
    src, ss, crop = spec
    path = KEY if src == 'key' else VOL
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path, '-t', str(dur), '-an',
                          '-vf', vid_filter(src, crop) + ',fps=30', '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'],
                         stdout=subprocess.PIPE)
    n = 0; last = None
    while n < int(round(dur * FPS)):
        buf = p.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            if last is None: raise RuntimeError('no frames')
            fr = last
        else:
            fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        last = fr
        yield grade(fr)
        n += 1
    p.stdout.close(); p.wait()

def vid_single(spec, t):
    src, ss, crop = spec
    path = KEY if src == 'key' else VOL
    out = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(ss + t), '-i', path, '-frames:v', '1', '-an',
                          '-vf', vid_filter(src, crop), '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'],
                         capture_output=True).stdout
    return grade(np.frombuffer(out, np.uint8).reshape(H, W, 3))

# ---------------- subtitles ----------------
def parse(text):
    """-> list of words; each word = list of (str, highlighted)."""
    segs = []
    for i, part in enumerate(re.split(r'\*\*', text)):
        if part: segs.append((part, i % 2 == 1))
    words, cur = [], []
    for s, hl in segs:
        pieces = re.split(r'( )', s)
        for p in pieces:
            if p == ' ':
                if cur: words.append(cur); cur = []
            elif p:
                cur.append((p, hl))
    if cur: words.append(cur)
    return words

def word_w(font, word):
    return sum(font.getlength(s) for s, _ in word)

def layout(words, font):
    sp = font.getlength(' ')
    ws = [word_w(font, w) for w in words]
    total = sum(ws) + sp * (len(ws) - 1)
    if total <= MAX_TEXT_W: return [words]
    best = None
    for k in range(1, len(words)):
        a = sum(ws[:k]) + sp * (k - 1); b = sum(ws[k:]) + sp * (len(ws) - k - 1)
        if a <= MAX_TEXT_W and b <= MAX_TEXT_W:
            score = max(a, b) + (0 if a >= b else 0.15 * (b - a))   # prefer balanced, top line slightly longer
            if best is None or score < best[0]: best = (score, k)
    if best is None: return None
    return [words[:best[1]], words[best[1]:]]

def subtitle_rgba(text):
    text = re.sub(r'^(HOOK|RE-HOOK|END): ', '', text)   # section labels are not on-screen text
    words = parse(text)
    for size in range(68, 30, -1):
        font = ImageFont.truetype(FONT, size)
        lines = layout(words, font)
        if lines: break
    sp = font.getlength(' ')
    asc, desc = font.getmetrics()
    lh = int(size * 1.22)                  # tight line pitch: highlight boxes touch like the reference
    padx, pady = int(size * 0.36), int(size * 0.26)
    hpad = int(size * 0.09)
    widths = [sum(word_w(font, w) for w in ln) + sp * (len(ln) - 1) for ln in lines]
    cw = int(max(widths) + 2 * padx + 2 * hpad); ch = int(lh * len(lines) + 2 * pady)
    img = Image.new('RGBA', (cw, ch), CARD + (255,))
    d = ImageDraw.Draw(img)
    text_top_off = (lh - (asc + desc)) / 2 + size * 0.04
    for li, ln in enumerate(lines):
        y = pady + li * lh
        # flatten line into (str, hl) runs incl. spaces; a space between two highlighted words is highlighted
        runs = []
        for wi, w in enumerate(ln):
            if wi:
                prev_hl = ln[wi - 1][-1][1]; nxt_hl = w[0][1]
                runs.append((' ', prev_hl and nxt_hl))
            runs.extend(w)
        x = padx + hpad
        # pass 1: highlight boxes (merged runs)
        xs = x; cur_start = None
        for s, hl in runs + [('', False)]:
            if hl and cur_start is None: cur_start = xs
            if not hl and cur_start is not None:
                d.rectangle([cur_start - hpad, y, xs + hpad, y + lh - 1], fill=HL + (255,))
                cur_start = None
            xs += font.getlength(s)
        # pass 2: text
        xs = x
        for s, hl in runs:
            d.text((xs, y + text_top_off), s, font=font, fill=(HLTXT if hl else TXT) + (255,))
            xs += font.getlength(s)
    return np.array(img), size, len(lines)

# ---------------- logo ----------------
def make_logo():
    im = cv2.imread(U + 'a482488f-image.jpg')
    cx, cy, r = 360, 800, 236
    cream = np.median(im[790:810, 140:170].reshape(-1, 3), axis=0)
    yy, xx = np.mgrid[0:im.shape[0], 0:im.shape[1]]
    pencil = (xx - 537) ** 2 + (yy - 977) ** 2 < 52 ** 2       # edit-pencil button overlapping the circle
    im = im.copy(); im[pencil] = cream
    crop = im[cy - r:cy + r, cx - r:cx + r]
    # anti-aliased circular alpha
    ss = 4
    yy, xx = np.mgrid[0:2 * r * ss, 0:2 * r * ss]
    a = (((xx + 0.5) / ss - r) ** 2 + ((yy + 0.5) / ss - r) ** 2 < (r - 1.5) ** 2).astype(np.float32)
    a = cv2.resize(a, (2 * r, 2 * r), interpolation=cv2.INTER_AREA)
    rgba = np.dstack([crop, (a * 255).astype(np.uint8)])
    small = cv2.resize(rgba, (LOGO_D, LOGO_D), interpolation=cv2.INTER_AREA)
    small = cv2.cvtColor(small, cv2.COLOR_BGRA2RGBA)
    cv2.imwrite(os.path.join(S, 'logo_badge.png'), cv2.cvtColor(small, cv2.COLOR_RGBA2BGRA))
    return small

def over(frame, rgba, x, y, alpha=1.0):
    h, w = rgba.shape[:2]
    roi = frame[y:y + h, x:x + w].astype(np.float32)
    a = rgba[..., 3:4].astype(np.float32) / 255.0 * alpha
    fg = rgba[..., 2::-1].astype(np.float32)   # RGBA -> BGR
    frame[y:y + h, x:x + w] = (fg * a + roi * (1 - a) + 0.5).astype(np.uint8)

# soft shadow under logo badge for separation
def logo_shadow(logo):
    a = logo[..., 3].astype(np.float32)
    pad = 20
    sh = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad), np.float32)
    sh[pad:-pad, pad:-pad] = a
    sh = cv2.GaussianBlur(sh, (0, 0), 6) * 0.45
    rgba = np.zeros(sh.shape + (4,), np.uint8); rgba[..., 3] = sh.astype(np.uint8)
    return rgba, pad

LOGO = None; SHADOW = None
def compose(base, sub, t, dur, idx):
    global LOGO, SHADOW
    if LOGO is None:
        LOGO = make_logo(); SHADOW = logo_shadow(LOGO)
    f = base.copy()
    sh, pad = SHADOW
    over(f, sh, LOGO_XY[0] - pad, LOGO_XY[1] - pad + 3, LOGO_ALPHA)
    over(f, LOGO, LOGO_XY[0], LOGO_XY[1], LOGO_ALPHA)
    sa = np.clip((t - 0.4) / 0.25, 0, 1)                         # subtitle fades in from 0.4s
    if sa > 0:
        over(f, sub, CARD_X, CARD_BOTTOM - sub.shape[0], sa)
    # scene-file fades: 0.3s fade-in on first scene, 0.3s fade-out on the last
    fade = 1.0
    if idx == 0: fade = min(fade, t / 0.3)
    if idx == len(SCENES) - 1: fade = min(fade, (dur - t - 1 / FPS) / 0.3)
    fade = float(np.clip(fade, 0, 1))
    if fade < 1: f = (f.astype(np.float32) * fade).astype(np.uint8)
    return f

def render_scene(idx):
    dur, kind, srcspec, text = SCENES[idx]
    sub, _, _ = subtitle_rgba(text)
    out = os.path.join(S, 'scenes', f'scene_{idx + 1:02d}.mp4')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}',
                            '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
                            '-pix_fmt', 'yuv420p', '-r', str(FPS), '-g', '60', '-movflags', '+faststart', out],
                           stdin=subprocess.PIPE)
    n = int(round(dur * FPS))
    gen = vid_frames(srcspec, dur) if kind == 'vid' else None
    for i in range(n):
        t = i / FPS
        base = next(gen) if gen else still_frame(srcspec, t, dur)
        enc.stdin.write(compose(base, sub, t, dur, idx).tobytes())
    enc.stdin.close(); enc.wait()
    return out

def test_frame(idx, t):
    dur, kind, srcspec, text = SCENES[idx]
    sub, size, nl = subtitle_rgba(text)
    base = vid_single(srcspec, t) if kind == 'vid' else still_frame(srcspec, t, dur)
    f = compose(base, sub, t, dur, idx)
    p = os.path.join(S, 'tests', f'test_scene{idx + 1:02d}.png'); os.makedirs(os.path.dirname(p), exist_ok=True)
    cv2.imwrite(p, f); print(p, 'font', size, 'lines', nl)

if __name__ == '__main__':
    if sys.argv[1] == 'test':
        for a in sys.argv[2:]:
            i, t = a.split('@'); test_frame(int(i) - 1, float(t))
    elif sys.argv[1] == 'scene':
        for a in sys.argv[2:]: print(render_scene(int(a) - 1))
    elif sys.argv[1] == 'sizes':
        for i, sc in enumerate(SCENES):
            _, s, n = subtitle_rgba(sc[3]); print(i + 1, s, n)
