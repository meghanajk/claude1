"""Cut the channel logo out of the profile screenshot, remove the pencil 'edit' badge
(inpaint), super-resolve x4, and save a circular badge with transparent background."""
import cv2, numpy as np
ROOT = "/home/user/claude1"
im = cv2.imread(f"{ROOT}/assets/logo_screenshot.jpg")
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
# find the cream disc precisely: bright pixels around the centre
cx, cy, r = 360, 800, 236
sub = im[cy - r - 4:cy + r + 4, cx - r - 4:cx + r + 4].copy()
S = sub.shape[0]; c = S // 2
cream = np.median(sub[c - 200:c - 170, c - 20:c + 20].reshape(-1, 3), 0)
# pencil badge: white circle + icon around (537,977) in screenshot coords
bx, by = 537 - (cx - r - 4), 977 - (cy - r - 4)
m = np.zeros(sub.shape[:2], np.uint8); cv2.circle(m, (bx, by), 46, 255, -1)
disc = np.zeros_like(m); cv2.circle(disc, (c, c), r - 3, 255, -1)
fill = cv2.bitwise_and(m, disc)
sub[fill > 0] = cream                       # badge sits on plain cream: fill, then blend edges
sub = cv2.inpaint(sub, cv2.dilate(fill, np.ones((5, 5))) - cv2.erode(fill, np.ones((5, 5))), 5, cv2.INPAINT_TELEA)
sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(f"{ROOT}/models/EDSR_x4.pb"); sr.setModel("edsr", 4)
up = sr.upsample(sub)
U = up.shape[0]; alpha = np.zeros((U, U), np.uint8)
cv2.circle(alpha, (U // 2, U // 2), (r - 3) * 4, 255, -1, cv2.LINE_AA)
# flatten any faint vignette in the cream background to one clean tone
lum = cv2.cvtColor(up, cv2.COLOR_BGR2GRAY).astype(np.float32)
bgmask = (np.abs(up.astype(np.float32) - cream).sum(2) < 30)
up[bgmask] = cream.astype(np.uint8)
rgba = np.dstack([up, alpha])
cv2.imwrite(f"{ROOT}/clean/logo_badge.png", rgba)
print("logo", rgba.shape, "cream", cream)
