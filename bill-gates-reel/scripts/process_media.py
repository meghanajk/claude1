"""Smart-crop every media/cardNN.* to 9:16, upscale to 1080x1920 (Lanczos),
denoise lightly, sharpen lightly, apply one shared cool/clean grade, and write
to media_processed/. Videos are trimmed to their card's duration and muted.
Originals in media/ are never modified."""
import json, subprocess, sys
from pathlib import Path
import cv2
sys.path.insert(0, str(Path(__file__).parent))
from timing import cards, card_seconds

ROOT = Path(__file__).resolve().parent.parent
MEDIA, OUT = ROOT / "media", ROOT / "media_processed"
OUT.mkdir(exist_ok=True)
CFG = json.loads((ROOT / "scripts/media_config.json").read_text())
W, H = 1080, 1920
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")
VID_EXT = (".mp4", ".mov", ".m4v", ".webm")

# One grade for every file so the set matches: cool, clean, slightly more contrast.
GRADE = ("eq=contrast=1.08:brightness=-0.01:saturation=0.92,"
         "colorbalance=rs=-0.03:bs=0.04:rm=-0.02:bm=0.03:rh=-0.01:bh=0.02")
PRE = "hqdn3d=1.5:1.5:3:3"  # gentle noise / JPEG-artifact reduction before upscaling
POST = (f"scale={W}:{H}:flags=lanczos+accurate_rnd+full_chroma_int,"
        f"unsharp=5:5:0.45:5:5:0,{GRADE}")
SR_THRESHOLD = 2.5  # above this upscale factor, run a 4x super-resolution model first
TRANSITION_PAD = 0.6  # extra seconds so a clip also covers the blur transition into the next card
MODELS = ROOT / "models"

def make_sr(kind):
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(str(MODELS / f"{kind.upper()}_x4.pb"))
    sr.setModel(kind, 4)
    return sr

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)

face_det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
def find_focus(frame):
    g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    fh, fw = g.shape
    faces = face_det.detectMultiScale(g, 1.08, 5, minSize=(max(20, fw // 12),) * 2)
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    return ((x + w / 2) / fw, (y + h / 2) / fh)

def crop_916(rw, rh, focus):
    """Largest 9:16 box inside rw x rh, centred on the subject."""
    fx, fy = focus
    if rw / rh > 9 / 16:
        ch, cw = rh, round(rh * 9 / 16)
    else:
        cw, ch = rw, round(rw * 16 / 9)
    cw -= cw % 2; ch -= ch % 2
    x = min(max(round(fx * rw - cw / 2), 0), rw - cw)
    y = min(max(round(fy * rh - ch * 0.40), 0), rh - ch)  # face ~40% from top
    return x, y, cw, ch

only = set(sys.argv[1:])  # e.g. `python3 scripts/process_media.py card07 card11`
report, missing = [], []
for i, text in enumerate(cards()):
    name = f"card{i + 1:02d}"
    if only and name not in only:
        continue
    src = next((p for p in sorted(MEDIA.glob(name + ".*")) if p.suffix.lower() in IMG_EXT + VID_EXT), None)
    if src is None:
        missing.append(name); continue
    cfg = CFG.get(name, {})
    is_video = src.suffix.lower() in VID_EXT
    if is_video:
        cap = cv2.VideoCapture(str(src))
        cap.set(cv2.CAP_PROP_POS_MSEC, (cfg.get("start", 0) + 0.5) * 1000)
        ok, frame = cap.read()
    else:
        frame = cv2.imread(str(src))
    fh, fw = frame.shape[:2]
    rx, ry, rw, rh = cfg.get("region", [0, 0, fw, fh])
    region = frame[ry:ry + rh, rx:rx + rw]
    focus = cfg.get("focus") or find_focus(region) or (0.5, 0.4)
    focus = tuple(float(v) for v in focus)
    x, y, cw, ch = crop_916(rw, rh, focus)
    crop = f"crop={cw}:{ch}:{rx + x}:{ry + y}"
    use_sr = W / cw > SR_THRESHOLD
    if is_video:
        dst = OUT / f"{name}.mp4"
        dur = f"{card_seconds(text, i) + TRANSITION_PAD:.3f}"
        dec = ["ffmpeg", "-v", "error", "-ss", str(cfg.get("start", 0)), "-i", str(src), "-t", dur,
               "-vf", f"{crop},{PRE},fps=30", "-an", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
        sw, sh = (cw * 4, ch * 4) if use_sr else (cw, ch)
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
               "-s", f"{sw}x{sh}", "-r", "30", "-i", "-", "-vf", POST + ",format=yuv420p", "-an",
               "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", str(dst)],
               stdin=subprocess.PIPE)
        raw = run(dec, capture_output=True).stdout
        sr = make_sr("fsrcnn") if use_sr else None
        n = cw * ch * 3
        import numpy as np
        for k in range(len(raw) // n):
            f = np.frombuffer(raw[k * n:(k + 1) * n], np.uint8).reshape(ch, cw, 3)
            enc.stdin.write((sr.upsample(f) if sr else f).tobytes())
        enc.stdin.close(); enc.wait()
    else:
        dst = OUT / f"{name}.png"
        tmp = OUT / f".{name}_pre.png"
        run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", f"{crop},{PRE}", "-frames:v", "1", str(tmp)])
        if use_sr:
            cv2.imwrite(str(tmp), make_sr("edsr").upsample(cv2.imread(str(tmp))))
        run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-vf", POST, "-frames:v", "1", str(dst)])
        tmp.unlink()
    scale = W / cw
    report.append({"card": name, "source": src.name, "crop": f"{cw}x{ch}", "upscale": round(scale, 1), "super_res": use_sr})
    print(f"{name}: {src.name} crop {cw}x{ch} at ({rx + x},{ry + y}) upscale x{scale:.1f} focus={tuple(round(v, 2) for v in focus)}")

if not only:
    (OUT / "report.json").write_text(json.dumps({"processed": report, "missing": missing}, indent=1))
if missing:
    print("MISSING (dark background used):", ", ".join(missing))
