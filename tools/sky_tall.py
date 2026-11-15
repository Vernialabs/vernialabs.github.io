import numpy as np, sys
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2]); out = sys.argv[3]; seed = int(sys.argv[4]) if len(sys.argv) > 4 else 7
rng = np.random.default_rng(seed)
S = W / 1600.0

def octave(cells_x):
    cy = max(2, int(cells_x * H / W))
    a = rng.random((cy + 3, cells_x + 3)).astype(np.float32)
    im = Image.fromarray(a, mode='F').resize((W + int(W / cells_x * 3), H + int(H / cy * 3)), Image.BICUBIC)
    arr = np.asarray(im)
    ox, oy = int(rng.integers(0, int(W / cells_x * 2))), int(rng.integers(0, int(H / cy * 2)))
    return arr[oy:oy + H, ox:ox + W]

def fbm(base, octs=6, gain=.52):
    v = np.zeros((H, W), np.float32); a = 1.; tot = 0.
    for i in range(octs):
        v += a * octave(int(base * 2 ** i)); tot += a; a *= gain
    return v / tot

def sample(img, x, y):
    x = np.clip(x, 0, W - 1.001); y = np.clip(y, 0, H - 1.001)
    x0 = x.astype(np.int32); y0 = y.astype(np.int32); fx = x - x0; fy = y - y0
    if img.ndim == 3: fx = fx[..., None]; fy = fy[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u = xx / W; v = yy / H   # v=0 top

# cloud density: lobes combined by max, each lobe shaded like a sphere lit from the upper left
P = np.zeros((H, W), np.float32); SH = np.full((H, W), .5, np.float32); AN = np.zeros((H, W), np.float32)
lx, ly = -.62, -.78
def cluster(spine, n, rmin, rmax, spread, flat=1.0):
    spine = np.array(spine, np.float32)
    seg = rng.integers(0, len(spine) - 1, n); t = rng.random(n)
    pts = spine[seg] * (1 - t[:, None]) + spine[seg + 1] * t[:, None]
    rs = np.sort(rng.uniform(rmin, rmax, n))[::-1]
    for (cx, cy), r in zip(pts, rs):
        cx = cx * W + rng.normal(0, spread * W); cy = cy * H + rng.normal(0, spread * H)
        r *= S * 1.05
        x0, x1 = int(max(0, cx - 2 * r)), int(min(W, cx + 2 * r)); y0, y1 = int(max(0, cy - 2 * r)), int(min(H, cy + 2 * r))
        if x1 <= x0 or y1 <= y0: continue
        gx = xx[y0:y1, x0:x1] - cx; gy = (yy[y0:y1, x0:x1] - cy) * flat
        q = (gx * gx + gy * gy) / (r * r)
        g = np.exp(-q * 1.4)
        nz = np.sqrt(np.clip(1 - q, 0, 1))
        sh = np.clip(.5 + .55 * (-(gx * lx + gy * ly) / r) * (.4 + .6 * nz) + .25 * nz - .12, 0, 1)
        win = g > P[y0:y1, x0:x1]
        P[y0:y1, x0:x1] = np.where(win, g, P[y0:y1, x0:x1])
        SH[y0:y1, x0:x1] = np.where(win, sh, SH[y0:y1, x0:x1])
        AN[y0:y1, x0:x1] = np.where(win, np.arctan2(gy, gx) + np.pi / 2, AN[y0:y1, x0:x1])
cluster([(-.04, .07), (.06, .045), (.17, .065)], 70, 12, 40, .008, 1.3)
cluster([(.8, .04), (.9, .06), (1.03, .045)], 70, 12, 40, .008, 1.3)
cluster([(-.06, .26), (.03, .19), (.11, .17), (.0, .3)], 260, 28, 110, .02, 1.1)
cluster([(1.06, .15), (.97, .2), (.91, .26), (1.02, .3)], 260, 28, 110, .02, 1.1)
cluster([(-.06, .5), (.06, .45), (.2, .43), (.33, .45), (.41, .49)], 420, 30, 120, .024, 1.1)
cluster([(.59, .49), (.68, .45), (.82, .43), (.95, .45), (1.06, .5)], 420, 30, 120, .024, 1.1)
cluster([(-.08, .6), (.02, .68), (-.04, .79)], 220, 30, 110, .02, 1.1)
cluster([(1.08, .58), (.98, .67), (1.05, .78)], 220, 30, 110, .02, 1.1)
cluster([(-.06, 1.02), (.12, .95), (.32, .97), (.52, .93), (.72, .96), (.92, .93), (1.06, .99)], 800, 34, 150, .025, 1.1)
ero = fbm(12, 5)
D = np.clip((P + (ero - .5) * .35 - .3) / .2, 0, 1)
D = D * D * (3 - 2 * D)
def blur(a, k):
    small = Image.fromarray(a.astype(np.float32)).resize((max(2, W // k), max(2, H // k)), Image.BILINEAR)
    return np.asarray(small.resize((W, H), Image.BICUBIC))
Pb = blur(P, 24)
big = np.clip(.5 + (Pb - sample(Pb, xx + 70 * S * lx, yy + 70 * S * ly)) * 4.0, 0, 1)
depth = np.clip(blur(P, 10) * 1.3, 0, 1)
light = np.clip(.18 + .82 * (.35 * blur(SH, 3) + .65 * big) - (depth - .5) * .18 + (fbm(16, 3) - .5) * .22, 0, 1)
def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
skyTop, skyLow = hexc('#bccbea'), hexc('#eef0f7')
shadow, mid, high, warm = hexc('#93a0d2'), hexc('#d7d9ec'), hexc('#fbf7ee'), hexc('#f3d68c')
sky = skyTop[None, None] * (1 - v[..., None] ** .7) + skyLow[None, None] * v[..., None] ** .7
sky = sky + (fbm(2, 3)[..., None] - .5) * .05
L = light[..., None]
cloud = np.where(L < .5, shadow * (1 - L * 2) + mid * (L * 2), mid * (1 - (L - .5) * 2) + high * ((L - .5) * 2))
warmth = np.clip((light - .58) / .3, 0, 1)[..., None] * np.clip(fbm(3, 3) * 1.8 - .45, 0, 1)[..., None]
cloud = cloud * (1 - warmth * .7) + warm * warmth * .7
cool = np.clip((.42 - light) / .3, 0, 1)[..., None] * np.clip(fbm(4, 3) * 1.6 - .4, 0, 1)[..., None]
cloud = cloud * (1 - cool * .25) + hexc('#86a9c9') * cool * .25
col = sky * (1 - D[..., None]) + cloud * D[..., None]

# brush direction: mostly along the mass contours, a little around each lobe
Pm = blur(P, 8)
cgx = sample(Pm, xx + 4, yy) - sample(Pm, xx - 4, yy); cgy = sample(Pm, xx, yy + 4) - sample(Pm, xx, yy - 4)
cm = np.hypot(cgx, cgy) + 1e-6
vx = -cgy / cm * .92 + np.cos(AN) * .08; vy = cgx / cm * .92 + np.sin(AN) * .08
skyAng = (fbm(2, 3) - .5) * .8 + .12
ang = np.where(D > .05, np.arctan2(vy, vx) + (fbm(8, 2) - .5) * .5, skyAng)
dx, dy = np.cos(ang), np.sin(ang)

def lic(img, length, steps):
    acc = img.copy(); n = 1
    for k in range(1, steps + 1):
        t = length * k / steps
        acc = acc + sample(img, xx + dx * t, yy + dy * t) + sample(img, xx - dx * t, yy - dy * t); n += 2
    return acc / n

col = lic(col, 14 * S, 8)
seedn = np.asarray(Image.fromarray(rng.random((H // 2, W // 2)).astype(np.float32)).resize((W, H), Image.BILINEAR))
streak = lic(seedn, 26 * S, 13)
streak = (streak - streak.mean()) / (streak.std() + 1e-6)
emb = streak - sample(streak, xx - 1.5, yy - 1.5)
col = col * (1 + streak[..., None] * .022 * (.1 + D[..., None])) + emb[..., None] * .008 * (.03 + D[..., None])
col = np.clip(col, 0, 1)
Image.fromarray((col * 255).astype(np.uint8)).save(out, quality=90)
print('saved', out)
