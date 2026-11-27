"""Find static overlays (watermarks/logos/tickers) and black bars in each video.
A burned-in overlay stays put while the footage behind it changes, so pixels with
low temporal variance AND strong edges in every sampled frame are flagged."""
import cv2, numpy as np, sys, json
out = {}
for p in sys.argv[1:]:
    cap = cv2.VideoCapture(p); n = int(cap.get(7))
    fr = []
    for i in np.linspace(0, n - 1, 40).astype(int):
        cap.set(1, i); ok, f = cap.read()
        if ok: fr.append(f)
    a = np.stack(fr).astype(np.float32)
    g = a.mean(-1)
    std = g.std(0)
    edges = np.stack([cv2.Canny(f, 80, 160) > 0 for f in fr]).mean(0)
    static = ((std < 6) & (edges > 0.6)).astype(np.uint8)
    static = cv2.morphologyEx(static, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    num, lab, st, _ = cv2.connectedComponentsWithStats(static)
    blobs = [list(map(int, s)) for s in st[1:] if s[4] > 80]
    rowmean = g.mean((0, 2)); dark = np.where(rowmean > 8)[0]
    colmean = g.mean((0, 1)); darkc = np.where(colmean > 8)[0]
    out[p] = {"size": [g.shape[2], g.shape[1]], "content_rows": [int(dark[0]), int(dark[-1])],
              "content_cols": [int(darkc[0]), int(darkc[-1])], "static_blobs_xywh_area": blobs}
print(json.dumps(out, indent=1))
