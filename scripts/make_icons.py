#!/usr/bin/env python3
"""Generate the PWA / home screen icons into public/icons. Needs Pillow.

Draws a blocky dump truck with a load, using the same camera as the game (src/iso.js).
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
INK = (42, 31, 61)
S = 1024
YAW, PITCH = 0.36, 0.95
CY, SY, CP, SP = math.cos(YAW), math.sin(YAW), math.cos(PITCH), math.sin(PITCH)
LIGHT = (-0.45, 1.0, 0.35)
_l = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _l for c in LIGHT)


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, amt):
    if amt >= 0:
        return tuple(round(v + (255 - v) * amt) for v in c)
    return tuple(round(v * (1 + amt)) for v in c)


class Scene:
    def __init__(self, ox, oy, scale):
        self.ox, self.oy, self.s = ox, oy, scale
        self.boxes = []

    def proj(self, x, y, z):
        xr, zr = x * CY - z * SY, x * SY + z * CY
        return (self.ox + xr * self.s, self.oy + (zr * SP - y * CP) * self.s, zr * CP + y * SP)

    def box(self, cx, y0, cz, w, h, d, color, tilt=None):
        pts = []
        for iz in (0, 1):
            for iy in (0, 1):
                for ix in (0, 1):
                    p = [cx + (ix - 0.5) * w, y0 + iy * h, cz + (iz - 0.5) * d]
                    if tilt:  # rotate around z through pivot (px, py)
                        px, py, a = tilt
                        dx, dy = p[0] - px, p[1] - py
                        p[0], p[1] = px + dx * math.cos(a) - dy * math.sin(a), py + dx * math.sin(a) + dy * math.cos(a)
                    pts.append(p)
        self.boxes.append((pts, hexrgb(color)))

    def draw(self, d, lw):
        faces = [[2, 3, 7, 6], [0, 4, 5, 1], [1, 5, 7, 3], [0, 2, 6, 4], [4, 6, 7, 5], [0, 1, 3, 2]]
        tocam = (SY * CP, SP, CY * CP)
        items = []
        for pts, col in self.boxes:
            c = [sum(p[i] for p in pts) / 8 for i in range(3)]
            items.append((c[0] * SY * CP + c[2] * CY * CP + c[1] * SP, pts, col, c))
        items.sort(key=lambda t: t[0])
        for _, pts, col, c in items:
            pp = [self.proj(*p) for p in pts]
            for f in faces:
                n = [sum(pts[i][k] for i in f) / 4 - c[k] for k in range(3)]
                if sum(n[k] * tocam[k] for k in range(3)) <= 1e-6:
                    continue
                ln = math.sqrt(sum(v * v for v in n)) or 1
                lam = max(0.0, sum(n[k] * LIGHT[k] for k in range(3)) / ln)
                poly = [(pp[i][0], pp[i][1]) for i in f]
                d.polygon(poly, fill=shade(col, (lam - 0.85) * 0.55))
                d.line(poly + [poly[0]], fill=INK, width=lw, joint="curve")


def truck(sc):
    for x in (-0.6, 0.75):
        for z in (-0.47, 0.47):
            sc.box(x, 0, z, 0.42, 0.4, 0.2, "#2c2c36")
    sc.box(0.1, 0.22, 0, 2.3, 0.2, 0.74, "#4a4a58")
    cx = 0.82
    sc.box(cx, 0.42, 0, 0.62, 0.62, 0.92, "#f7c531")
    sc.box(cx + 0.32, 0.72, 0, 0.02, 0.26, 0.72, "#9fe0ff")
    sc.box(cx + 0.05, 0.72, 0.47, 0.36, 0.24, 0.02, "#9fe0ff")
    sc.box(cx, 1.04, 0, 0.18, 0.08, 0.18, "#ff9a3d")
    sc.box(cx + 0.33, 0.24, 0, 0.08, 0.16, 0.98, "#8a8a98")
    t = (-1.05, 0.5, 0.18)
    sc.box(-0.31, 0.42, 0, 1.47, 0.08, 0.96, "#f5962a", t)
    sc.box(0.39, 0.5, 0, 0.06, 0.44, 0.96, "#e88a20", t)
    sc.box(-1.02, 0.5, 0, 0.06, 0.28, 0.96, "#e88a20", t)
    sc.box(-0.31, 0.5, 0.45, 1.47, 0.3, 0.06, "#f5962a", t)
    sc.box(-0.31, 0.5, -0.45, 1.47, 0.3, 0.06, "#f5962a", t)
    # load: rocks, beams and bricks
    sc.box(-0.75, 0.5, -0.2, 0.42, 0.3, 0.38, "#9aa3ad", t)
    sc.box(-0.75, 0.5, 0.2, 0.42, 0.3, 0.38, "#d9533b", t)
    sc.box(-0.3, 0.5, -0.2, 0.42, 0.3, 0.38, "#f08a24", t)
    sc.box(-0.3, 0.5, 0.2, 0.42, 0.3, 0.38, "#f2cf63", t)
    sc.box(0.12, 0.5, -0.2, 0.42, 0.3, 0.38, "#3b8fe8", t)
    sc.box(0.12, 0.5, 0.2, 0.42, 0.3, 0.38, "#a0663a", t)


def make(maskable=False):
    big = S * 2
    img = Image.new("RGB", (big, big), (95, 191, 255))
    d = ImageDraw.Draw(img)
    for i in range(big):
        t = i / big
        d.line([(0, i), (big, i)], fill=(int(95 + 100 * t), int(191 + 50 * t), 255))
    k = 0.78 if maskable else 1.0
    gy = big * (0.66 if maskable else 0.7)
    d.ellipse([-big * 0.3, gy - 140, big * 1.3, big * 1.6], fill=(143, 214, 95), outline=INK, width=16)
    sc = Scene(big / 2 + 40 * k, big * 0.62, 620 * k)
    truck(sc)
    sc.draw(d, max(6, int(12 * k)))
    return img.resize((S, S), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
base, mask = make(False), make(True)
base.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
base.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
base.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
mask.resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png")
print("icons written to", OUT)
