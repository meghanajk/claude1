"""Original sound design for FACTMAN, synthesized from scratch with numpy/scipy.

Nothing here is sampled from third-party recordings, so every sound effect and every bar of
music is original and free to use. All functions return float32 stereo arrays shaped (n, 2)
at SR samples per second.
"""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(7)


# ----------------------------------------------------------------------------- helpers
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def st(mono, pan=0.0):
    """mono -> stereo with constant-power pan (-1 left .. 1 right)."""
    a = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1).astype(np.float32)


def noise(n, seed=None):
    r = np.random.default_rng(seed) if seed is not None else RNG
    return r.standard_normal(n).astype(np.float32)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def lp(x, f, order=2):
    sos = signal.butter(order, f, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def hp(x, f, order=2):
    sos = signal.butter(order, f, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def sweep_filter(x, f0, f1, q=2.0, block=512, kind="band"):
    """Time-varying (exponential sweep) filter applied block-wise."""
    out = np.zeros_like(x)
    n = len(x)
    zi = None
    for i in range(0, n, block):
        frac = i / max(1, n - 1)
        fc = f0 * (f1 / f0) ** frac
        if kind == "band":
            lo, hi = fc / (1 + 1 / q), min(fc * (1 + 1 / q), SR / 2 - 100)
            sos = signal.butter(2, [lo, hi], btype="band", fs=SR, output="sos")
        else:
            sos = signal.butter(2, min(fc, SR / 2 - 100), btype="low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], axis=0, zi=zi)
    return out


def env_ad(n, a, d, curve=4.0):
    """attack (s) then exponential decay over d seconds."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) / max(d, 1e-4) * curve / 4 * 4))
    return e.astype(np.float32)


def fade(x, fin=0.005, fout=0.02):
    x = x.copy()
    i, o = int(fin * SR), int(fout * SR)
    if i:
        x[:i] *= np.linspace(0, 1, i)[:, None] if x.ndim == 2 else np.linspace(0, 1, i)
    if o:
        x[-o:] *= np.linspace(1, 0, o)[:, None] if x.ndim == 2 else np.linspace(1, 0, o)
    return x


_IR_CACHE = {}


def reverb(x, decay=1.6, wet=0.3, seed=3, predelay=0.012):
    """Convolution reverb with a synthetic stereo exponential-decay impulse response."""
    key = (round(decay, 2), seed)
    if key not in _IR_CACHE:
        n = int(decay * SR)
        t = np.arange(n) / SR
        ir = np.stack([noise(n, seed), noise(n, seed + 1)], 1) * np.exp(-6.9 * t / decay)[:, None]
        ir = lp(ir, 6000)
        pd = np.zeros((int(predelay * SR), 2), np.float32)
        ir = np.concatenate([pd, ir]) / np.sqrt(np.sum(ir ** 2) / 2)
        _IR_CACHE[key] = ir.astype(np.float32)
    ir = _IR_CACHE[key]
    if x.ndim == 1:
        x = st(x)
    n = len(x) + len(ir) - 1
    nfft = 1 << (n - 1).bit_length()
    w = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:n]
                  for c in range(2)], 1)
    out = (1 - wet) * x + wet * w[:len(x)] * 0.35
    return out.astype(np.float32)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return (x / m * peak).astype(np.float32)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ----------------------------------------------------------------------------- sound effects
def sfx_boom(dur=2.5):
    t = t_axis(dur)
    f = 30 + 55 * np.exp(-t * 5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-t * 2.2)
    body = lp(noise(len(t)), 180) * np.exp(-t * 9) * 2.5
    return norm(reverb(st(sub + body), 2.2, 0.25), 0.95)


def sfx_impact(dur=3.5):
    t = t_axis(dur)
    boom = sfx_boom(dur)[:, 0]
    crack = hp(noise(len(t)), 900) * np.exp(-t * 28) * 0.9
    ring = sum(np.sin(2 * np.pi * f * t + i) * np.exp(-t * (3 + i)) * a
               for i, (f, a) in enumerate([(97, .5), (151, .35), (233, .25), (377, .15), (611, .08)]))
    x = boom + crack + ring * 0.6
    return norm(reverb(st(x), 3.0, 0.45), 0.98)


def sfx_impact_small(dur=1.6):
    t = t_axis(dur)
    f = 60 + 90 * np.exp(-t * 14)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) + hp(noise(len(t)), 1500) * np.exp(-t * 40) * 0.6
    return norm(reverb(st(x), 1.6, 0.35), 0.9)


def sfx_riser(dur=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    nz = sweep_filter(noise(n), 300, 7000, q=1.5)
    f = 180 * (8 ** k)
    tone = sum(np.sin(2 * np.pi * np.cumsum(f * m) / SR) / (j + 1) for j, m in enumerate([1, 1.5, 2.01]))
    x = (nz * 1.2 + tone * 0.35) * (k ** 2.2)
    out = np.stack([x * (0.8 + 0.2 * np.sin(t * 9)), x * (0.8 + 0.2 * np.cos(t * 9))], 1)
    return norm(fade(out, 0.01, 0.01), 0.8)


def sfx_whoosh(dur=0.9, reverse=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.sin(np.pi * t / dur) ** 2
    nz = sweep_filter(noise(n), 400, 3500, q=1.2)
    nz2 = sweep_filter(noise(n, 11)[::-1].copy(), 3500, 600, q=1.2)
    x = (nz * (t < dur / 2) + nz2 * (t >= dur / 2)) * e
    pan = np.linspace(-0.8, 0.8, n)
    a = (pan + 1) * np.pi / 4
    out = np.stack([x * np.cos(a), x * np.sin(a)], 1)
    if reverse:
        out = out[::-1].copy()
    return norm(reverb(out, 0.8, 0.2), 0.8)


def sfx_glitch(dur=0.45, seed=None):
    r = np.random.default_rng(seed if seed is not None else int(RNG.integers(1e6)))
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    i = 0
    while i < n:
        L = int(r.uniform(0.012, 0.06) * SR)
        kind = r.integers(4)
        tt = np.arange(L) / SR
        if kind == 0:
            seg = np.sign(np.sin(2 * np.pi * r.uniform(80, 1800) * tt))
        elif kind == 1:
            seg = np.round(noise(L) * 3) / 3
        elif kind == 2:
            seg = np.repeat(noise(L // 40 + 1), 40)[:L]
        else:
            seg = np.sin(2 * np.pi * r.uniform(2000, 6000) * tt) * (r.random() < 0.7)
        seg = seg * r.uniform(0.3, 1.0)
        p = r.uniform(-0.8, 0.8)
        out[i:i + L] += st(seg[: n - i], p)[: n - i]
        i += L + int(r.uniform(0, 0.02) * SR)
    return norm(fade(out, 0.002, 0.02), 0.7)


def sfx_heartbeat(count=4, bpm=72):
    gap = 60 / bpm
    n = int((count * gap + 1.0) * SR)
    out = np.zeros(n, np.float32)

    def thump(f, dur, amp):
        t = t_axis(dur)
        ff = f * (1 + 0.6 * np.exp(-t * 30))
        return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 14) * amp

    for k in range(count):
        i = int(k * gap * SR)
        a = thump(52, 0.35, 1.0)
        b = thump(46, 0.35, 0.75)
        out[i:i + len(a)] += a
        j = i + int(0.26 * SR)
        out[j:j + len(b)] += b
    out = lp(out, 220)
    return norm(st(out), 0.95)


def sfx_pop():
    t = t_axis(0.18)
    f = 300 + 700 * np.exp(-t * 60)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)
    x += hp(noise(len(t)), 3000) * np.exp(-t * 200) * 0.3
    return norm(reverb(st(x), 0.5, 0.15), 0.7)


def sfx_tick():
    t = t_axis(0.12)
    x = np.sin(2 * np.pi * 1850 * t) * np.exp(-t * 70) + bp(noise(len(t)), 2000, 6000) * np.exp(-t * 300) * 0.5
    return norm(st(x), 0.6)


def sfx_ding():
    t = t_axis(1.6)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) * a
            for f, a, d in [(1318.5, 1, 2.5), (1977, .4, 3.5), (2637, .25, 5), (3520, .1, 7)])
    return norm(reverb(st(x), 1.4, 0.3), 0.45)


def karplus(f, dur, decay=0.996, bright=0.5, seed=1):
    n = int(dur * SR)
    L = max(2, int(SR / f))
    buf = noise(L, seed)
    out = np.zeros(n, np.float32)
    for i in range(n):
        out[i] = buf[i % L]
        buf[i % L] = decay * (bright * buf[i % L] + (1 - bright) * buf[(i + 1) % L])
    return out


def sfx_twang():
    t = t_axis(1.4)
    x = karplus(98, 1.4, 0.9985, 0.6) * 0.7 + karplus(147, 1.4, 0.998, 0.6, 2) * 0.4
    bend = np.sin(2 * np.pi * (110 - 25 * t) * t) * np.exp(-t * 3) * 0.3
    return norm(reverb(st(x + bend), 1.6, 0.3), 0.8)


def sfx_snap():
    n = int(1.6 * SR)
    out = np.zeros(n, np.float32)
    for k, f in enumerate([880, 1240, 990, 1480]):
        i = int(k * 0.07 * SR)
        L = int(0.4 * SR)
        tt = np.arange(L) / SR
        s = karplus(f, 0.4, 0.99, 0.3, k + 5) * 0.6 + hp(noise(L), 2500) * np.exp(-tt * 90)
        out[i:i + L] += s * np.exp(-tt * 9)
    return norm(reverb(st(out), 1.5, 0.35), 0.9)


def sfx_crack():
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n, np.float32)
    for k in range(9):
        i = int(RNG.uniform(0, 0.25) * SR)
        L = int(0.05 * SR)
        x[i:i + L] += hp(noise(L), 2500) * np.exp(-np.arange(L) / SR * 80) * RNG.uniform(0.4, 1)
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * 4) for f in [2793, 3951, 5274]) * 0.12
    return norm(reverb(st(x + ring), 1.8, 0.4), 0.85)


def sfx_shimmer(dur=2.2):
    t = t_axis(dur)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    x = sum(np.sin(2 * np.pi * f * t + i) * (0.6 + 0.4 * np.sin(2 * np.pi * (5 + i) * t))
            for i, f in enumerate([1760, 2217, 2637, 3322]))
    return norm(reverb(st(x * e * 0.4), 2.0, 0.5), 0.5)


def sfx_swell(dur=2.4):
    t = t_axis(dur)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    x = sum(np.sin(2 * np.pi * mtof(m) * t) + 0.3 * np.sin(4 * np.pi * mtof(m) * t) for m in [50, 57, 62, 65])
    return norm(reverb(st(lp(x * e, 2000)), 2.0, 0.4), 0.55)


def sfx_power_down():
    t = t_axis(1.2)
    f = 40 + 900 * np.exp(-t * 4)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 2.5) * 0.3
    x = lp(x, 2500) + lp(noise(len(t)), 800) * np.exp(-t * 6) * 0.3
    return norm(reverb(st(x), 0.9, 0.25), 0.7)


def sfx_tv_on():
    t = t_axis(0.6)
    x = hp(noise(len(t)), 1200) * np.exp(-t * 7) * 0.6
    x[: int(0.004 * SR)] += 1.0
    x += np.sin(2 * np.pi * 7800 * t) * np.exp(-t * 5) * 0.08
    return norm(st(x), 0.6)


def sfx_lock():
    t = t_axis(0.7)
    x = np.zeros(len(t), np.float32)
    for k, f in enumerate([1200, 1600]):
        a, b = int(k * 0.12 * SR), int((k * 0.12 + 0.08) * SR)
        x[a:b] += np.sin(2 * np.pi * f * t[: b - a])
    x += np.sin(2 * np.pi * (400 + 2400 * t) * t) * np.exp(-((t - 0.45) / 0.08) ** 2) * 0.6
    return norm(reverb(st(x), 0.6, 0.2), 0.55)


def sfx_door():
    t = t_axis(1.4)
    creak_f = 180 + 60 * np.sin(2 * np.pi * 1.3 * t) + 20 * noise(len(t), 4).cumsum() / SR
    creak = signal.sawtooth(2 * np.pi * np.cumsum(creak_f) / SR) * np.clip(1 - t / 0.9, 0, 1) * 0.15
    creak = bp(creak, 300, 2500)
    thud = np.sin(2 * np.pi * 70 * t) * np.exp(-(t - 0.95).clip(0) * 18) * (t > 0.95) * 0.9
    return norm(reverb(st(creak + thud), 1.0, 0.3), 0.6)


def sfx_crowd(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2), np.float32)
    for k in range(14):
        v = bp(noise(n, 100 + k), RNG.uniform(250, 500), RNG.uniform(900, 1800))
        rate = RNG.uniform(3.5, 6.5)
        am = (0.5 + 0.5 * np.sin(2 * np.pi * rate * t + RNG.uniform(0, 6))) ** 2
        out += st(v * am, RNG.uniform(-0.9, 0.9))
    e = np.clip(t / 0.5, 0, 1) * np.clip((dur - t) / 0.8, 0, 1)
    return norm(reverb(out * e[:, None], 1.2, 0.3), 0.5)


def sfx_chalk():
    t = t_axis(0.7)
    jit = (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 23 * t))) * np.clip(1 - t / 0.7, 0, 1)
    x = bp(noise(len(t)), 1800, 6000) * jit
    return norm(reverb(st(x), 0.5, 0.15), 0.5)


def sfx_eraser():
    t = t_axis(0.8)
    x = bp(noise(len(t)), 700, 3000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * t))) * np.sin(np.pi * t / 0.8)
    return norm(st(x), 0.55)


def sfx_scribble():
    t = t_axis(0.9)
    strokes = (np.sin(2 * np.pi * 11 * t) > 0.2).astype(np.float32)
    x = bp(noise(len(t)), 2500, 8000) * lp(strokes, 60) * np.sin(np.pi * t / 0.9)
    return norm(st(x), 0.5)


def sfx_click():
    t = t_axis(0.15)
    x = bp(noise(len(t)), 1500, 7000) * np.exp(-t * 250) + np.sin(2 * np.pi * 900 * t) * np.exp(-t * 90) * 0.4
    return norm(st(x), 0.6)


def sfx_step():
    t = t_axis(0.25)
    x = lp(noise(len(t)), 400) * np.exp(-t * 35) * 2 + np.sin(2 * np.pi * 85 * t) * np.exp(-t * 30)
    return norm(st(x), 0.5)


def sfx_logo_sting():
    t = t_axis(5.0)
    hit = sfx_impact(5.0)
    chord = sum(np.sin(2 * np.pi * mtof(m) * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * t + m))
                for m in [62, 66, 69, 74, 78, 81])
    e = np.clip(t / 0.4, 0, 1) * np.exp(-t * 0.6)
    pad = reverb(st(lp(chord * e, 4000) * 0.12), 3.0, 0.5)[: len(t)]
    return norm(hit + pad, 0.95)


SFX = {
    "boom": sfx_boom, "impact": sfx_impact, "impact_small": sfx_impact_small, "riser": sfx_riser,
    "whoosh": sfx_whoosh, "whoosh_rev": lambda: sfx_whoosh(reverse=True), "glitch": sfx_glitch,
    "heartbeat": sfx_heartbeat, "pop": sfx_pop, "tick": sfx_tick, "ding": sfx_ding, "twang": sfx_twang,
    "snap": sfx_snap, "crack": sfx_crack, "shimmer": sfx_shimmer, "swell": sfx_swell,
    "power_down": sfx_power_down, "tv_on": sfx_tv_on, "lock": sfx_lock, "door": sfx_door,
    "crowd": sfx_crowd, "chalk": sfx_chalk, "eraser": sfx_eraser, "scribble": sfx_scribble,
    "click": sfx_click, "step": sfx_step, "logo_sting": sfx_logo_sting,
}


def make_sfx(name, **kw):
    if name == "ticks":
        count, spacing = kw.get("count", 4), kw.get("spacing", 0.3)
        tk = sfx_tick()
        out = np.zeros((int((count * spacing + 0.3) * SR), 2), np.float32)
        for k in range(count):
            i = int(k * spacing * SR)
            out[i:i + len(tk)] += tk * (0.8 + 0.2 * (k % 2))
        return out
    f = SFX[name]
    args = {}
    if "dur" in kw and name in ("riser", "crowd", "shimmer", "swell"):
        args["dur"] = kw["dur"]
    if "count" in kw and name == "heartbeat":
        args["count"] = kw["count"]
    return f(**args)


# ----------------------------------------------------------------------------- music
def pad_note(m, dur, amp=1.0, attack=1.2, release=1.5, bright=4, detune=0.12):
    t = t_axis(dur + release)
    f = mtof(m)
    x = np.zeros(len(t), np.float32)
    for d in (-detune, detune):
        for h in range(1, bright + 1):
            x += np.sin(2 * np.pi * f * h * (1 + d / 100) * t + h * d) / h
    e = np.clip(t / attack, 0, 1) * np.clip((dur + release - t) / release, 0, 1)
    return x * e * amp


def pluck_note(m, dur=1.6, amp=1.0, decay=3.0):
    t = t_axis(dur)
    f = mtof(m)
    x = sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * decay * h) / h ** 1.3 for h in range(1, 7))
    x *= np.clip(t / 0.004, 0, 1)
    return x * amp


def kick(amp=1.0):
    t = t_axis(0.5)
    f = 45 + 110 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * amp


def tom(m=45, amp=1.0):
    t = t_axis(0.7)
    f = mtof(m) * (1 + 0.5 * np.exp(-t * 20))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) + lp(noise(len(t)), 900) * np.exp(-t * 25) * 0.3) * amp


def add(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    if buf.ndim == 2 and x.ndim == 1:
        x = st(x)
    buf[i:i + len(x)] += x


def music_dark(dur, seed=1):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    t = np.arange(n) / SR
    drone = (np.sin(2 * np.pi * 36.7 * t) + 0.6 * np.sin(2 * np.pi * 73.4 * t + 0.3 * np.sin(0.2 * t))
             + 0.25 * np.sin(2 * np.pi * 110.3 * t))
    out += st(drone * 0.35)
    wind = sweep_filter(noise(n, seed), 200, 900, q=3) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t))
    out += st(wind * 0.25, 0.3)
    eerie = (np.sin(2 * np.pi * mtof(74) * t) + np.sin(2 * np.pi * mtof(75) * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t)) * 0.04
    out += st(eerie, -0.4)
    tt = 0.8
    while tt < dur - 1:
        m = r.choice([38, 41, 45, 50, 53, 49])
        add(out, st(pluck_note(m, 3.0, 0.35, 1.2), r.uniform(-0.5, 0.5)), tt)
        tt += r.choice([1.6, 2.4, 3.2])
    tt = 0.0
    while tt < dur:
        add(out, st(kick(0.35)), tt)
        tt += 4.0
    return reverb(out, 3.0, 0.4)[:n]


CHORDS_MIN = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]   # Dm Bb Gm A
CHORDS_MAJ = [[50, 54, 57], [45, 49, 52], [47, 50, 54], [43, 47, 50]]   # D A Bm G


def music_suspense(dur, seed=2, bpm=84, arp=True, bass_pulse=False, tremolo=False, chords=None):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    beat = 60 / bpm
    bar = beat * 4
    chords = chords or CHORDS_MIN
    k, tt = 0, 0.0
    while tt < dur:
        ch = chords[k % len(chords)]
        for j, m in enumerate(ch):
            p = pad_note(m + 12, bar * 2, 0.16, attack=1.5, release=2.0, bright=3)
            if tremolo:
                p = p * (0.6 + 0.4 * np.sin(2 * np.pi * 7.5 * np.arange(len(p)) / SR))
            add(out, st(p, (j - 1) * 0.5), tt)
        add(out, st(pad_note(ch[0] - 12, bar * 2, 0.35, attack=0.8, release=1.5, bright=2)), tt)
        if arp:
            pat = [0, 1, 2, 1, 2, 0, 1, 2]
            for s in range(8 * 2):
                m = ch[pat[s % 8]] + 24
                add(out, st(pluck_note(m, 1.2, 0.10, 4.0), r.uniform(-0.6, 0.6)), tt + s * beat / 2)
        if bass_pulse:
            for s in range(16):
                add(out, st(pluck_note(ch[0] - 12, 0.4, 0.45 if s % 2 == 0 else 0.25, 8.0)), tt + s * beat / 2)
        k += 1
        tt += bar * 2
    tt = 0
    while tt < dur:
        add(out, st(kick(0.22)), tt)
        tt += beat * 2
    return reverb(lp(out, 5000), 2.4, 0.35)[:n]


def music_tense(dur, seed=3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    base = music_suspense(dur, seed, bpm=76, arp=False, tremolo=True)
    cluster = sum(np.sin(2 * np.pi * mtof(m) * t + m) for m in [38, 39, 45]) * 0.12
    cluster *= (0.6 + 0.4 * np.sin(2 * np.pi * 0.09 * t))
    out = base + st(lp(cluster, 400))
    tt = 0.3
    while tt < dur:
        add(out, st(lp(kick(0.5), 150)), tt)
        add(out, st(lp(kick(0.35), 150)), tt + 0.28)
        tt += 1.6
    return out


def music_build(dur, seed=4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = music_suspense(dur, seed, bpm=92, arp=True, bass_pulse=True, chords=[[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]])
    beat = 60 / 92
    tt, k = 0.0, 0
    while tt < dur:
        prog = tt / dur
        add(out, st(kick(0.55 + 0.4 * prog)), tt)
        if prog > 0.3 and k % 2 == 1:
            add(out, st(tom(43, 0.35 * prog), -0.3), tt)
        if prog > 0.6:
            add(out, st(tom(48, 0.3 * prog), 0.3), tt + beat / 2)
        tt += beat
        k += 1
    gain = (0.55 + 0.6 * (t / dur) ** 1.5)
    return out * gain[:, None]


def music_inspire(dur, seed=5):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    bpm = 80
    beat = 60 / bpm
    bar = beat * 4
    k, tt = 0, 0.0
    while tt < dur:
        ch = CHORDS_MAJ[k % 4]
        for j, m in enumerate(ch):
            add(out, st(pad_note(m + 12, bar, 0.14, attack=0.8, release=1.6, bright=4), (j - 1) * 0.6), tt)
        add(out, st(pad_note(ch[0] - 12, bar, 0.35, attack=0.4, release=1.2, bright=2)), tt)
        pat = [0, 1, 2, 3, 2, 1, 2, 3]
        notes = ch + [ch[0] + 12]
        for s in range(8):
            add(out, st(pluck_note(notes[pat[s]] + 24, 1.5, 0.13, 2.5), r.uniform(-0.5, 0.5)), tt + s * beat / 2)
        for b in range(4):
            add(out, st(kick(0.3)), tt + b * beat)
        k += 1
        tt += bar
    return reverb(lp(out, 6500), 2.6, 0.4)[:n]


MUSIC = {"dark": music_dark, "suspense": music_suspense, "pulse": lambda d: music_suspense(d, 6, bpm=96, bass_pulse=True),
         "tense": music_tense, "build": music_build, "inspire": music_inspire}
