"""STEP 1: clean every file in assets/media -> clean/.
Videos: remove letterbox bars, face-tracked 9:16 crop (smoothed, no jitter),
Lanczos upscale to 1080x1920, then ffmpeg denoise + light sharpen + grade.
Photos (tiles cut from the search screenshots): cut out the image only (no UI text),
denoise, EDSR x4 super-resolution, 9:16 face-centred crop, light grade.
No face/identity edits anywhere: only global filters."""
import cv2, numpy as np, subprocess, json, os
ROOT = "/home/user/claude1"; os.makedirs(f"{ROOT}/clean", exist_ok=True)
W, H = 1080, 1920
haar = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
report = []

def faces(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return haar.detectMultiScale(g, 1.1, 6, minSize=(60, 60))

def track_x(frames, cw, default, max_jump=90):
    """Centre x of the main face per frame -> held, smoothed, clamped crop left edge."""
    xs, last = [], default
    for f in frames:
        fs = faces(f)
        # only follow faces near the subject's last position (never jump to a bystander)
        near = [r for r in fs if abs(r[0] + r[2] / 2 - last) < max_jump]
        if near:
            best = min(near, key=lambda r: abs(r[0] + r[2] / 2 - last))
            last = 0.7 * last + 0.3 * (best[0] + best[2] / 2)
        xs.append(last)
    xs = np.array(xs, float)
    k = 31; pad = np.pad(xs, k // 2, mode="edge")
    sm = np.convolve(pad, np.ones(k) / k, mode="valid")          # smooth -> no jitter
    fw = frames[0].shape[1]
    return np.clip(sm - cw / 2, 0, fw - cw).round().astype(int)

def video(name, src, crop_rows=None, grade="eq=contrast=1.05:saturation=1.08", cuts=(), keys=None, only=None):
    if only and name not in only: return
    cap = cv2.VideoCapture(src); frames = []
    while True:
        ok, f = cap.read()
        if not ok: break
        if crop_rows: f = f[crop_rows[0]:crop_rows[1]]
        frames.append(f)
    h, w = frames[0].shape[:2]
    cw = int(round(h * 9 / 16))
    steps = []
    if crop_rows: steps.append(f"removed black letterbox bars (kept rows {crop_rows[0]}-{crop_rows[1]-1})")
    if cw < w:
        # track per shot so the crop never slides across a cut
        bounds = [0, *cuts, len(frames)]; lefts = []
        for a, b in zip(bounds, bounds[1:]):
            if keys:   # subject centre set by eye at keyframes (Haar misses these faces)
                k = [(f, x) for f, x in keys if a <= f < b]
                cx = np.interp(np.arange(a, b), [f for f, _ in k], [x for _, x in k])
                n = 21; cx = np.convolve(np.pad(cx, n // 2, mode="edge"), np.ones(n) / n, "valid")
                lefts += list(np.clip(cx - cw / 2, 0, w - cw).round().astype(int))
            else:
                lefts += list(track_x(frames[a:b], cw, w / 2))
        steps.append(f"9:16 crop ({cw}x{h} window) following the subject, keyframed per shot and smoothed (no jitter, never slides across a cut)")
    else:
        lefts = [0] * len(frames)
    out = f"{ROOT}/clean/{name}.mp4"
    vf = f"hqdn3d=2:2:5:5,unsharp=5:5:0.55:5:5:0,{grade}"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
        "-s", f"{W}x{H}", "-r", "30", "-i", "-", "-vf", vf, "-c:v", "libx264", "-crf", "14",
        "-preset", "slow", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    for f, l in zip(frames, lefts):
        p.stdin.write(cv2.resize(f[:, l:l + cw], (W, H), interpolation=cv2.INTER_LANCZOS4).tobytes())
    p.stdin.close(); p.wait()
    steps += [f"upscaled {cw}x{h} -> {W}x{H} (Lanczos, x{H/h:.2f})", "denoise (hqdn3d), light unsharp",
              f"grade: {grade}", "original audio dropped (narration replaces it)"]
    report.append({"file": os.path.basename(src), "output": f"clean/{name}.mp4", "steps": steps})

sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(f"{ROOT}/models/EDSR_x4.pb"); sr.setModel("edsr", 4)

def photo(name, src, box, fy=0.38, note=""):
    x0, y0, x1, y1 = box
    im = cv2.imread(src)[y0:y1, x0:x1]                         # tile only: no captions/UI
    im = cv2.fastNlMeansDenoisingColored(im, None, 3, 3, 5, 15)  # JPEG noise
    up = sr.upsample(im)                                         # EDSR x4
    h, w = up.shape[:2]
    fs = faces(up)
    cx = (max(fs, key=lambda r: r[2] * r[3])[0] + max(fs, key=lambda r: r[2] * r[3])[2] / 2) if len(fs) else w / 2
    if w / h > 9 / 16:
        cw = int(h * 9 / 16); l = int(np.clip(cx - cw / 2, 0, w - cw)); up = up[:, l:l + cw]
    else:
        ch = int(w * 16 / 9); t = 0; up = up[t:t + ch]
    up = cv2.resize(up, (1440, 2560), interpolation=cv2.INTER_LANCZOS4)  # headroom for Ken Burns
    lab = cv2.cvtColor(up, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.3, (8, 8)).apply(lab[..., 0])        # gentle local contrast
    up = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    bl = cv2.GaussianBlur(up, (0, 0), 2.0); up = cv2.addWeighted(up, 1.35, bl, -0.35, 0)  # light sharpen
    cv2.imwrite(f"{ROOT}/clean/{name}.png", up)
    report.append({"file": os.path.basename(src) + f" tile {box}", "output": f"clean/{name}.png",
        "steps": ["cut the photo tile out of the screenshot (inset past rounded corners; Google captions, "
                  "source names, search bar and status bar all excluded)", "light NL-means denoise",
                  f"EDSR x4 super-resolution ({x1-x0}x{y1-y0} -> {(x1-x0)*4}x{(y1-y0)*4})",
                  "face-centred 9:16 crop, resized to 1440x2560 (Ken Burns headroom)",
                  "CLAHE local contrast (mild), light unsharp"] + ([note] if note else [])})

import sys
ONLY = sys.argv[1:] or None
M = f"{ROOT}/assets/media"
video("vid1_film", f"{M}/vid1_square.mp4", cuts=(98, 164, 215), keys=[(0,490),(30,480),(60,380),(97,360),(98,330),(135,450),(164,320),(215,420),(255,300),(274,300)], only=ONLY, grade="eq=contrast=1.06:saturation=1.05:brightness=0.01")
video("vid2_assembly", f"{M}/vid2_short.mp4", crop_rows=(280, 1000), keys=[(0,360),(45,540),(90,520),(135,560),(231,560)], only=ONLY, grade="eq=contrast=1.08:saturation=1.08:gamma=0.95")
video("vid3_rally", f"{M}/vid3_long.mp4", only=ONLY, grade="eq=contrast=1.04:saturation=1.06",
      cuts=tuple(int(t * 30) for t in (3.73, 5.47, 7.9, 11.2, 17.07, 20.4, 22.43, 28.83, 43.97, 46.47, 49.53, 53.6)))
if ONLY: print("re-ran", ONLY); sys.exit(0)
S1, S2 = f"{M}/screenshot_search1.jpg", f"{M}/screenshot_search2.jpg"
I = 14  # inset past the rounded corners of each result tile
photo("photo_confetti", S1, (364 + I, 279 + 2, 713 - I, 693 - I))
photo("photo_greyshirt", S2, (364 + I, 206 + I, 713 - I, 738 - I))
photo("photo_master", S2, (8 + I, 646 + I, 357 - I, 1178 - I))
photo("photo_sunglasses", S2, (364 + I, 825 + I, 713 - I, 1300 - I))
photo("photo_jacket", S2, (8 + I, 206 + I, 357 - I, 560 - I), note="source tile is small and square: 9:16 crop is tight; lowest quality of the set")
json.dump(report, open(f"{ROOT}/clean/report.json", "w"), indent=1)
print("done", len(report))
