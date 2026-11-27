"""Verify the text-only reel: specs, duration, silent audio, card placement vs. reference + safe zone."""
import json, subprocess, numpy as np, cv2
ROOT = "/home/user/claude1"; F = f"{ROOT}/output/reel_final.mp4"
pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", F], capture_output=True).stdout)
v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]; a = [s for s in pr["streams"] if s["codec_type"] == "audio"][0]
print(f"video {v['codec_name']} {v['profile']} {v['width']}x{v['height']} {v['r_frame_rate']} frames={v['nb_frames']}; "
      f"audio {a['codec_name']} {a['channels']}ch; duration {float(pr['format']['duration']):.2f}s (<60: {float(pr['format']['duration']) < 60})")
vd = subprocess.run(["ffmpeg", "-nostats", "-i", F, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
print("audio level:", [l.split("] ")[1] for l in vd.splitlines() if "max_volume" in l][0], "(silent = no voice/music/SFX)")
tl = json.load(open(f"{ROOT}/work/textreel_timeline.json")); cap = cv2.VideoCapture(F); ok_n = 0
for c in tl["cards"][:-1]:
    x0, y0, x1, y1 = c["rect"]; cap.set(1, int((c["s"] + c["e"]) / 2 * 30 + 4)); _, f = cap.read()
    px = [f[y0 + 3, x0 + 3], f[y1 - 4, x0 + 3], f[y0 + 3, x1 - 4], f[y1 - 4, x1 - 4]]
    ok_n += all(p.max() <= 16 for p in px)
R = [c["rect"] for c in tl["cards"][:-1]]
print(f"card boxes: left {min(r[0] for r in R)}, top {min(r[1] for r in R)} (reference ~130-160 / ~1017), "
      f"right max {max(r[2] for r in R)}, bottom max {max(r[3] for r in R)}; drawn where expected in {ok_n}/{len(R)} cards")
print("inside safe zone (x 60-930, y 250-1700):", all(r[0] >= 60 and r[2] <= 930 and r[1] >= 250 and r[3] <= 1700 for r in R))
print("SRT cues:", open(f"{ROOT}/output/subtitles.srt").read().count(" --> "))
