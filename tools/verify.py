"""Verify output/reel_final.mp4: specs, A/V offset, voice-vs-subtitle sync, subtitle/overlay safe zone."""
import json, subprocess, numpy as np, re, sys
sys.argv = ["x"]; ROOT = "/home/user/claude1"; F = f"{ROOT}/output/reel_final.mp4"
pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", F], capture_output=True).stdout)
v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]; a = [s for s in pr["streams"] if s["codec_type"] == "audio"][0]
dur = float(pr["format"]["duration"])
print(f"video {v['codec_name']} {v['profile']} {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} frames={v.get('nb_frames')} dur={float(v['duration']):.3f}")
print(f"audio {a['codec_name']} {a['sample_rate']}Hz ch={a['channels']} dur={float(a['duration']):.3f} start={a['start_time']} (video start {v['start_time']})")
print(f"container duration {dur:.3f}s  -> under 60s: {dur < 60}")
SR = 16000
def pcm(path, extra=()):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *extra, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)
fin = pcm(F); ref = pcm(f"{ROOT}/work/reel_mix.wav")
n = min(len(fin), len(ref)); e1 = np.abs(fin[:n]); e2 = np.abs(ref[:n])
k = 160; e1 = e1[:n // k * k].reshape(-1, k).mean(1); e2 = e2[:n // k * k].reshape(-1, k).mean(1)   # 10 ms envelopes
lags = range(-30, 31); cc = [np.corrcoef(np.roll(e1, l), e2)[0, 1] for l in lags]
best = list(lags)[int(np.argmax(cc))]
print(f"A/V: final audio vs. rendered timeline offset = {best*10} ms (corr {max(cc):.3f})")
# voice onsets vs subtitle chunk starts (voice-only track: re-derive from timeline words)
tl = json.load(open(f"{ROOT}/work/reel_timeline.json"))
env = e2 / e2.max()
errs = []
for c in tl["chunks"]:
    i = int(c["s"] * 100)
    win = env[i - 20:i + 30]
    if len(win) < 50: continue
    # first 10 ms frame after (s-200ms) where level jumps above 3x the local floor
    floor = np.percentile(env[max(0, i - 40):i - 5], 30) + 1e-4
    on = next((j for j in range(len(win)) if win[j] > max(0.08, 3 * floor)), None)
    if on is not None: errs.append((on - 20) * 10)
errs = np.array(errs)
print(f"subtitle-in vs. speech onset (ms): median {np.median(errs):.0f}, 90% within {np.percentile(np.abs(errs),90):.0f}, n={len(errs)}")
srt = open(f"{ROOT}/output/subtitles.srt").read()
times = re.findall(r"(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})", srt)
last = times[-1]; srt_end = int(last[4]) * 3600 + int(last[5]) * 60 + int(last[6]) + int(last[7]) / 1000
print(f"SRT cues {len(times)}, last ends {srt_end:.2f}s")
# subtitle box position: placement rects recorded by the renderer, confirmed in the frames
import cv2
cap = cv2.VideoCapture(F); R = [r[:4] for c in tl["chunks"] for r in c["rects"]]; seen = 0
for c in tl["chunks"]:
    for x0, y0, x1, y1, tt in c["rects"]:
        cap.set(1, int(round(tt * 30))); ok, f = cap.read()
        corners = [f[y0 + 3, x0 + 3], f[y0 + 3, x1 - 4], f[y1 - 4, x0 + 3], f[y1 - 4, x1 - 4]]
        seen += all(np.abs(px.astype(int) - [11, 10, 10]).max() <= 14 for px in corners)
X0 = min(r[0] for r in R); X1 = max(r[2] for r in R); Y0 = min(r[1] for r in R); Y1 = max(r[3] for r in R)
ok = X0 >= 60 and X1 <= 900 and Y0 >= 250 and Y1 <= 1700
print(f"subtitle boxes: x {X0}-{X1}, y {Y0}-{Y1}; safe zone x 60-900 / y 250-1700 -> {'PASS' if ok else 'FAIL'}; "
      f"box confirmed in rendered frame for {seen}/{len(R)} cues")
