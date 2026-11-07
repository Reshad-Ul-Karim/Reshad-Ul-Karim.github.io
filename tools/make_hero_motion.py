"""Render the hero's background motion loop (original, procedural; no stock footage).

Run from the repo root:  python3 tools/make_hero_motion.py
Needs numpy, Pillow and ffmpeg (libvpx-vp9 + libx264). Writes assets/motion/:
    hero-contours-{1280,640}.webm / .mp4   seamless 12 s loops, 24 fps
    hero-contours-poster.webp              frame 0, identical to the video's first frame

The frames are greyscale (light lines on black) with a soft edge falloff baked
in, so the page tints them with the active accent (mix-blend-mode) and they
never show a rectangular edge. Everything is periodic in the loop phase, so the
last frame flows into the first:
  - a terrain of depth contours below a horizon, flown over at constant speed
    (terrain wavenumbers along the flight axis are whole multiples of 2*pi/L);
  - faint depth rings above the horizon that expand by one ring spacing per loop;
  - a waypoint path across the terrain with markers travelling along it;
  - a scanning light band that crosses once per loop, off-screen at both ends.
"""
import os
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'motion')
FPS, SECONDS = 24, 12
FRAMES = FPS * SECONDS
W, H = 1280, 720
L = 2 * np.pi * 3.0  # terrain distance flown per loop

TAU = 2 * np.pi
KZ = [TAU / L * n for n in (1, 2, 3, 5)]  # periodic along the flight axis


def terrain(X, Z):
    return (0.55 * np.sin(0.9 * X + KZ[1] * Z + 0.3)
            + 0.35 * np.sin(-1.7 * X + KZ[2] * Z + 1.9)
            + 0.22 * np.sin(2.9 * X + KZ[0] * Z + 4.1)
            + 0.12 * np.sin(-4.3 * X + KZ[3] * Z + 2.6))


def iso_lines(field, levels, width_px):
    """Constant-width contour lines of a field (distance to nearest level / |grad|)."""
    f = field * levels
    gy, gx = np.gradient(f)
    g = np.sqrt(gx * gx + gy * gy) + 1e-6
    d = np.abs((f + 0.5) % 1.0 - 0.5) / g
    spacing = np.clip((1.0 / g - 5.0) / 9.0, 0, 1)  # lines closer than ~5 px fade out instead of aliasing
    return np.exp(-(d / width_px) ** 2) * spacing


def frame(i):
    t = i / FRAMES  # loop phase 0..1
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (xs - W * 0.5) / (H * 0.5)  # aspect-correct, 0 at centre
    v = (ys - H * 0.5) / (H * 0.5)
    img = np.zeros((H, W), np.float32)

    # Terrain below the horizon: perspective plane, contours of its height.
    horizon = -0.08
    below = v > horizon + 0.004
    z = np.where(below, 0.9 / np.maximum(v - horizon, 1e-3), 0)
    X = u * z
    Z = z + t * L
    h = terrain(X, Z)
    lines = iso_lines(np.where(below, h, 0), 5.0, 1.1)
    depth_fade = np.clip((v - horizon) * 2.2, 0, 1) ** 0.8 * np.clip(1.25 - z * 0.075, 0, 1)  # thin out before lines alias
    img += np.where(below, lines * depth_fade * 0.95, 0)

    # Depth rings above the horizon around a focal point behind the portrait.
    fx, fy = 0.38, -0.12
    r = np.sqrt(((u - fx) * 0.8) ** 2 + (v - fy) ** 2)
    spacing = 0.16
    ring = np.abs(((r - t * spacing) / spacing + 0.5) % 1.0 - 0.5) * spacing
    ring = np.exp(-(ring / 0.0035) ** 2) * np.clip(1.25 - r, 0, 1) ** 1.5 * (r > 0.12)
    img += np.where(v <= horizon, ring * 0.38, ring * 0.12)

    # Waypoint path across the terrain (world x as a periodic function of Z).
    pz = np.linspace(1.2, 16, 900)
    pZ = pz + t * L
    px = 1.6 * np.sin(KZ[1] * pZ + 0.8) + 0.6 * np.sin(KZ[2] * pZ + 2.0) + 1.4
    sx = (px / pz) * (H * 0.5) + W * 0.5
    sy = (0.9 / pz + horizon) * (H * 0.5) + H * 0.5
    path = np.zeros((H, W), np.float32)
    ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
    alpha = np.clip(1.3 - pz * 0.09, 0, 1)
    np.maximum.at(path, (sy[ok].astype(int), sx[ok].astype(int)), alpha[ok])
    # markers: every 2*pi/KZ[1]/3 units of Z, moving with the terrain
    step = (TAU / KZ[1]) / 3
    for k in range(0, 12):
        mZ = (k * step - (t * L) % step)
        mz = mZ + 1.2
        if mz < 1.2 or mz > 14:
            continue
        mx = 1.6 * np.sin(KZ[1] * (mz + t * L) + 0.8) + 0.6 * np.sin(KZ[2] * (mz + t * L) + 2.0) + 1.4
        cx = (mx / mz) * (H * 0.5) + W * 0.5
        cy = (0.9 / mz + horizon) * (H * 0.5) + H * 0.5
        rad = min(21.0 / mz, 4.5)
        d2 = (xs - cx) ** 2 + (ys - cy) ** 2
        img += np.exp(-d2 / (2 * rad * rad)) * 0.9 * np.clip(1.3 - mz * 0.07, 0, 1)
    # soften the path into a thin glowing line
    path_img = Image.fromarray((np.clip(path, 0, 1) * 255).astype(np.uint8))
    from PIL import ImageFilter
    path_soft = np.asarray(path_img.filter(ImageFilter.GaussianBlur(1.1)), np.float32) / 255.0
    img += path_soft * 2.2

    # Scanning light band: crosses once per loop, off-screen at both ends.
    pos = -2.6 + 5.2 * t
    band = np.exp(-((u - pos - (v * 0.35)) / 0.42) ** 2)
    img *= 0.55 + 0.75 * band
    img += band * 0.05 * np.clip(1 - np.abs(v), 0, 1)

    # Edge falloff: black at every edge, so screen blending leaves no seam.
    ex = np.clip(np.minimum(xs, W - 1 - xs) / (W * 0.16), 0, 1)
    ey = np.clip(np.minimum(ys, H - 1 - ys) / (H * 0.18), 0, 1)
    img *= (ex * ey) ** 1.4
    return np.clip(img, 0, 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='hero-motion-')
    try:
        for i in range(FRAMES):
            a = frame(i)
            Image.fromarray((a ** 0.85 * 255).astype(np.uint8), 'L').save(os.path.join(tmp, f'f{i:04d}.png'))
            if i == 0:
                Image.fromarray((a ** 0.85 * 255).astype(np.uint8), 'L').convert('RGB').resize((960, 540), Image.LANCZOS) \
                    .save(os.path.join(OUT, 'hero-contours-poster.webp'), quality=70, method=6)
        src = os.path.join(tmp, 'f%04d.png')
        for w in (1280, 640):
            # a slight blur keeps the thin lines from dominating the bitrate; at the
            # layer's low opacity it is not visible
            scale = f'gblur=sigma=0.7,scale={w}:-2:flags=lanczos,format=yuv420p'
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', src, '-vf', scale,
                            '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '50' if w == 1280 else '46', '-row-mt', '1',
                            '-deadline', 'good', '-cpu-used', '2', '-an',
                            os.path.join(OUT, f'hero-contours-{w}.webm')], check=True)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', src, '-vf', scale,
                            '-c:v', 'libx264', '-profile:v', 'main', '-crf', '33' if w == 1280 else '31', '-preset', 'slow',
                            '-tune', 'animation', '-movflags', '+faststart', '-an',
                            os.path.join(OUT, f'hero-contours-{w}.mp4')], check=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')


if __name__ == '__main__':
    main()
