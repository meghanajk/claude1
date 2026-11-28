"""Build timelines, captions, SRT subtitles and the final audio mix for every FACTMAN program.

Inputs : scripts/narration.json  +  public/audio/voice/<program>/*.mp3|json (from generate_voice.py)
Outputs: src/data/<program>.json            - timeline used by the Remotion compositions
         public/audio/<program>_mix.wav     - final mix (voice + music + sfx) used for rendering
         assets/audio/<program>_*.mp3       - voiceover / music / sfx stems
         assets/audio/sfx/*.wav             - the synthesized sound-effect library
         ../output/*.srt                    - subtitle files

Usage: python3 scripts/generate_audio.py [program ...]
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audio_lib as A  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT.parent / "output"
CFG = json.loads((ROOT / "scripts" / "narration.json").read_text())
SR = A.SR
FPS = CFG["fps"]

SRT_NAMES = {"main": "FACTMAN_Mind_Control_Subtitles.srt", "short1": "FACTMAN_Short_01_Conformity.srt",
             "short2": "FACTMAN_Short_02_Illusory_Truth.srt", "short3": "FACTMAN_Short_03_Gaslighting.srt"}
CAPTION_LIMITS = {"main": (34, 7), "short": (18, 4)}   # (max chars, max words) per caption chunk

VOICE_RMS_DB = -19.0      # each narration line is levelled to this RMS
MUSIC_DB = -25.5          # music bed level (before ducking)
DUCK_DB = -7.0            # extra music attenuation while the narrator speaks
SFX_DB = -9.0             # sfx level relative to full scale
TARGET_LUFS = -15.0


def norm_word(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def load_mp3(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, np.float32).copy()


def db(x):
    return 10 ** (x / 20)


def align_words(display_text, spoken):
    """Map the TTS word boundaries (spoken words) onto the display words (with punctuation)."""
    disp = display_text.split()
    if len(disp) == len(spoken):
        return [{"text": d, "start": s["start"], "end": s["end"]} for d, s in zip(disp, spoken)]
    # Fallback (e.g. 'FACTMAN' vs 'Fact Man', '1950s' vs 'nineteen fifties'): spread proportionally.
    t0, t1 = spoken[0]["start"], spoken[-1]["end"]
    lens = np.array([len(norm_word(d)) + 1 for d in disp], float)
    edges = t0 + np.concatenate([[0], np.cumsum(lens)]) / lens.sum() * (t1 - t0)
    print(f"   align fallback: {display_text!r} ({len(disp)} vs {len(spoken)} words)")
    return [{"text": d, "start": float(edges[i]), "end": float(edges[i + 1])} for i, d in enumerate(disp)]


def color_for(word, hl):
    w = norm_word(word)
    if any(w == norm_word(x) for x in hl.get("red", [])):
        return "red"
    if any(w == norm_word(x) for x in hl.get("yellow", [])):
        return "yellow"
    return "white"


def _balanced_split(words, max_chars, max_words):
    """Split a phrase into the fewest, most even chunks that respect the limits."""
    tl = lambda ws: len(" ".join(w["text"] for w in ws))
    if tl(words) <= max_chars and len(words) <= max_words:
        return [words]
    k = max(2, -(-tl(words) // max_chars), -(-len(words) // max_words))
    while True:
        # dynamic programming: minimise the longest chunk with exactly k chunks
        n = len(words)
        best = {(0, 0): (0, None)}
        for j in range(1, k + 1):
            for e in range(1, n + 1):
                cand = None
                for s0 in range(j - 1, e):
                    if (s0, j - 1) not in best:
                        continue
                    seg = words[s0:e]
                    if len(seg) > max_words:
                        continue
                    cost = max(best[(s0, j - 1)][0], tl(seg))
                    if cand is None or cost < cand[0]:
                        cand = (cost, s0)
                if cand:
                    best[(e, j)] = cand
        if (n, k) in best and best[(n, k)][0] <= max_chars or k >= n:
            break
        k += 1
    out, e, j = [], n, k
    while j > 0:
        s0 = best[(e, j)][1]
        out.append(words[s0:e])
        e, j = s0, j - 1
    return out[::-1]


def build_captions(lines, max_chars, max_words):
    caps = []
    for ln in lines:
        # 1) phrases split at punctuation
        phrases, cur = [], []
        for w in ln["words"]:
            cur.append(w)
            if w["text"][-1] in ".?!:,;" or w["text"].endswith("..."):
                phrases.append(cur)
                cur = []
        if cur:
            phrases.append(cur)
        # 2) greedily merge short phrases, split long ones evenly
        chunks, acc = [], []
        for ph in phrases:
            joined = acc + ph
            if acc and (len(" ".join(w["text"] for w in joined)) > max_chars or len(joined) > max_words
                        or acc[-1]["text"][-1] in ".?!"):
                chunks.extend(_balanced_split(acc, max_chars, max_words))
                acc = list(ph)
            else:
                acc = joined
        if acc:
            chunks.extend(_balanced_split(acc, max_chars, max_words))
        for c in chunks:
            caps.append({"start": c[0]["start"], "end": c[-1]["end"], "words": c, "line": ln["id"]})
    # extend each caption to just before the next one (max +0.6 s) for readability
    for a, b in zip(caps, caps[1:] + [None]):
        lim = b["start"] - 0.03 if b else a["end"] + 0.8
        a["end"] = max(a["end"], min(a["end"] + 0.6, lim))
    return caps


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(caps, path):
    out = []
    for i, c in enumerate(caps, 1):
        text = " ".join(w["text"] for w in c["words"])
        if len(text) > 42:   # standard SRT: max two lines of ~42 chars
            words, best = text.split(), None
            for k in range(1, len(words)):
                a, b = " ".join(words[:k]), " ".join(words[k:])
                score = max(len(a), len(b))
                if best is None or score < best[0]:
                    best = (score, a + "\n" + b)
            text = best[1]
        out.append(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{text}\n")
    path.write_text("\n".join(out), encoding="utf-8")


def measure_lufs(x):
    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        wavfile.write(f.name, SR, x.astype(np.float32))
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f.name, "-af", "ebur128", "-f", "null", "-"],
                           capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else -99.0


def limiter(x, ceiling=0.89, release=0.08):
    peak = np.max(np.abs(x), axis=1)
    g = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    # look-ahead: min over 5 ms window, then smooth release
    w = int(0.005 * SR)
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    g = minimum_filter1d(g, size=2 * w + 1)
    g = uniform_filter1d(g, size=w)
    a = np.exp(-1 / (release * SR))
    # one-pole release (vectorised approximation via scipy lfilter on 1-g)
    from scipy.signal import lfilter
    red = lfilter([1 - a], [1, -a], 1 - g)
    red = np.maximum(red, 1 - g)
    return x * (1 - red)[:, None], float((1 - red).min())


def write_mp3(x, path, br="192k"):
    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        wavfile.write(f.name, SR, np.clip(x, -1, 1).astype(np.float32))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f.name, "-b:a", br, str(path)], check=True)


def build(pid):
    prog = CFG["programs"][pid]
    vdir = ROOT / "public" / "audio" / "voice" / pid
    hl = prog["highlights"]
    print(f"== {pid}")

    # ---------------------------------------------------------------- 1. place narration lines
    t = prog.get("leadIn", 0.5)
    lines, scenes, clips = [], [], []
    for si, sc in enumerate(prog["scenes"]):
        t += sc.get("leadIn", 0.0)
        scene_start = t - sc.get("leadIn", 0.0)
        if si == 0:
            scene_start = 0.0
        scenes.append({"id": sc["id"], "start": scene_start, "music": sc["music"]})
        for ln in sc["lines"]:
            meta = json.loads((vdir / f"{ln['id']}.json").read_text())
            audio = load_mp3(vdir / f"{ln['id']}.mp3")
            sw = meta["words"]
            # trim leading silence to the first word, trailing silence by energy
            a0 = max(0, int((sw[0]["start"] - 0.05) * SR))
            env = np.convolve(np.abs(audio), np.ones(480) / 480, mode="same")
            above = np.where(env > db(-42))[0]
            a1 = min(len(audio), (above[-1] if len(above) else len(audio)) + int(0.06 * SR))
            a1 = max(a1, int((sw[-1]["end"]) * SR))
            clip = audio[a0:a1].copy()
            clip = A.fade(clip, 0.004, 0.03)
            rms = np.sqrt(np.mean(clip[np.abs(clip) > db(-45)] ** 2) + 1e-12)
            clip *= db(VOICE_RMS_DB) / rms
            shift = t - a0 / SR
            spoken = [{"text": w["text"], "start": w["start"] + shift, "end": w["end"] + shift} for w in sw]
            words = align_words(ln["text"], spoken)
            for w in words:
                w["color"] = color_for(w["text"], hl)
            dur = len(clip) / SR
            lines.append({"id": ln["id"], "scene": sc["id"], "text": ln["text"], "start": t, "end": t + dur,
                          "speechEnd": spoken[-1]["end"], "words": words, "spoken": spoken})
            clips.append((t, clip))
            t += dur + ln.get("pause", 0.4)
    total = t + prog.get("tail", 2.0) - (prog["scenes"][-1]["lines"][-1].get("pause", 0.0))
    n_frames = int(np.ceil(total * FPS))
    total = n_frames / FPS
    for a, b in zip(scenes, scenes[1:] + [None]):
        a["end"] = b["start"] if b else total
    by_id = {l["id"]: l for l in lines}

    # ---------------------------------------------------------------- 2. resolve beats
    beats, cues = {}, []
    for name, b in prog.get("beats", {}).items():
        ln = by_id[b["line"]]
        if "word" in b:
            target = norm_word(b["word"])
            cand = [w for w in ln["spoken"] if norm_word(w["text"]) == target]
            if not cand:
                raise SystemExit(f"beat {name}: word {b['word']!r} not found in {ln['id']}")
            at = cand[0]["start"]
        else:
            at = ln["speechEnd"] if b.get("anchor") == "end" else ln["start"]
        at += b.get("offset", 0.0)
        beats[name] = round(at, 4)
        if b.get("sfx"):
            cues.append({"name": name, "sfx": b["sfx"], "at": at, "gain": b.get("gain", 0.6),
                         "kw": {k: b[k] for k in ("dur", "count", "spacing") if k in b}, "endAt": b.get("endAt", False)})

    # footsteps (synced with the Remotion walk cycle: one step every 0.4 s)
    if pid == "main":
        for a, z, g in [("walkStart", "walkStop", 0.35)]:
            s = beats[a]
            while s < beats[z]:
                cues.append({"name": "step", "sfx": "step", "at": s, "gain": g, "kw": {}, "endAt": False})
                s += 0.4
        s, e = by_id["n2"]["start"], by_id["n5"]["end"]
        while s < e:
            cues.append({"name": "step", "sfx": "step", "at": s, "gain": 0.18, "kw": {}, "endAt": False})
            s += 0.45

    # ---------------------------------------------------------------- 3. audio stems
    N = int(total * SR) + SR
    voice = np.zeros(N, np.float32)
    for at, clip in clips:
        i = int(at * SR)
        voice[i:i + len(clip)] += clip[: N - i]
    voice_st = A.st(voice)

    sfx = np.zeros((N, 2), np.float32)
    cache = {}
    for c in cues:
        key = (c["sfx"], json.dumps(c["kw"], sort_keys=True))
        if key not in cache or c["sfx"] == "glitch":
            cache[key] = A.make_sfx(c["sfx"], **c["kw"])
        s = cache[key]
        at = c["at"] - (len(s) / SR if c["endAt"] else 0.0)
        A.add(sfx, s * c["gain"] * db(SFX_DB), max(0.0, at))

    music = np.zeros((N, 2), np.float32)
    XF = 1.6
    for i, sc in enumerate(scenes):
        a = max(0.0, sc["start"] - (XF if i else 0))
        b = min(total + 1, sc["end"] + XF)
        seg = A.MUSIC[sc["music"]](b - a)
        seg = A.norm(seg, 0.9)
        rms = np.sqrt(np.mean(seg ** 2)) + 1e-9
        seg = seg * db(MUSIC_DB) / rms
        fi, fo = int((XF if i else 0.05) * SR), int(XF * SR)
        env = np.ones(len(seg), np.float32)
        if fi:
            env[:fi] = np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
        env[-fo:] = np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
        A.add(music, seg * env[:, None], a)
    # end-of-program fade
    fo = int(3.0 * SR)
    end_i = int(total * SR)
    music[end_i - fo:end_i] *= np.linspace(1, 0, fo)[:, None]
    music[end_i:] = 0

    # sidechain ducking driven by the narration envelope
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    venv = maximum_filter1d(np.abs(voice), size=int(0.05 * SR))
    active = (venv > db(-40)).astype(np.float32)
    active = maximum_filter1d(active, size=int(0.35 * SR))
    active = uniform_filter1d(active, size=int(0.25 * SR))
    music *= (1 - active * (1 - db(DUCK_DB)))[:, None]

    mix = voice_st + music + sfx
    mix = mix[: int(total * SR)]
    lufs = measure_lufs(mix)
    g = db(TARGET_LUFS - lufs)
    mix *= g
    mix, min_gain = limiter(mix)
    mix = A.fade(mix, 0.01, 0.4)
    peak = 20 * np.log10(np.max(np.abs(mix)) + 1e-9)
    final_lufs = measure_lufs(mix)
    print(f"   duration {total:.2f}s  ({n_frames} frames)  loudness {final_lufs:.1f} LUFS  peak {peak:.2f} dBFS  limiter min gain {min_gain:.2f}")

    (ROOT / "public" / "audio").mkdir(parents=True, exist_ok=True)
    wavfile.write(ROOT / "public" / "audio" / f"{pid}_mix.wav", SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
    stems = ROOT / "assets" / "audio"
    stems.mkdir(parents=True, exist_ok=True)
    write_mp3(voice_st[: len(mix)] * g, stems / f"{pid}_voiceover.mp3")
    write_mp3(music[: len(mix)] * g, stems / f"{pid}_music.mp3")
    write_mp3(sfx[: len(mix)] * g, stems / f"{pid}_sfx.mp3")

    # ---------------------------------------------------------------- 4. captions + timeline json
    kind = "main" if pid == "main" else "short"
    caps = build_captions(lines, *CAPTION_LIMITS[kind])
    srt_caps = caps if kind == "main" else build_captions(lines, 32, 6)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_srt(srt_caps, OUT_DIR / SRT_NAMES[pid])
    (ROOT / "src" / "data").mkdir(parents=True, exist_ok=True)
    tl = {
        "program": pid, "fps": FPS, "duration": total, "durationInFrames": n_frames,
        "title": prog.get("title", ""),
        "scenes": scenes,
        "lines": {l["id"]: {k: l[k] for k in ("id", "scene", "text", "start", "end", "words")} for l in lines},
        "lineOrder": [l["id"] for l in lines],
        "beats": beats,
        "captions": [{"start": c["start"], "end": c["end"], "words": c["words"]} for c in caps],
    }
    (ROOT / "src" / "data" / f"{pid}.json").write_text(json.dumps(tl, indent=1))
    return tl


def export_sfx_library():
    d = ROOT / "assets" / "audio" / "sfx"
    d.mkdir(parents=True, exist_ok=True)
    for name in list(A.SFX.keys()) + ["ticks"]:
        x = A.make_sfx(name)
        wavfile.write(d / f"{name}.wav", SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))


if __name__ == "__main__":
    progs = sys.argv[1:] or list(CFG["programs"].keys())
    for p in progs:
        build(p)
    if not sys.argv[1:]:
        export_sfx_library()
