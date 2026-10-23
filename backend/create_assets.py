"""
Generate Rich Space Mission Assets for Aditya-L1
Creates all 10 local artwork assets required by the platform:
- assets/hero_sun.jpg
- assets/hero_spacecraft.jpg
- assets/sidebar_spacecraft.jpg
- assets/icon_velc.png
- assets/icon_suit.png
- assets/icon_solexs.png
- assets/icon_hel1os.png
- assets/icon_aspex.png
- assets/icon_papa.png
- assets/icon_mag.png
"""

import math
import pathlib
import shutil
from PIL import Image, ImageDraw, ImageFilter

assets_dir = pathlib.Path("assets")
assets_dir.mkdir(exist_ok=True)

# -----------------------------------------------------------------------------
# 1. assets/hero_sun.jpg (600 x 400)
# -----------------------------------------------------------------------------
def make_hero_sun():
    w, h = 600, 400
    img = Image.new("RGB", (w, h), (7, 13, 27))
    draw = ImageDraw.Draw(img)

    # Radiant background corona
    cx, cy = 90, 200
    for r in range(260, 40, -4):
        alpha = int(255 * (1 - (r - 40) / 220)**2 * 0.45)
        color = (
            min(255, int(255 * (1 - r/300) + 249 * (r/300))),
            min(255, int(120 * (1 - r/300) + 115 * (r/300))),
            min(255, int(30 * (1 - r/300) + 22 * (r/300)))
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    # Core solar sphere
    for r in range(90, 0, -2):
        frac = r / 90.0
        c = (
            255,
            int(150 + (1 - frac) * 95),
            int(30 + (1 - frac) * 120)
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

    # Solar prominence loops
    for angle in [0.2, -0.3, 0.7, -0.8]:
        px = cx + math.cos(angle) * 95
        py = cy + math.sin(angle) * 95
        draw.arc([px - 25, py - 25, px + 25, py + 25], 0, 180, fill=(255, 180, 50), width=3)

    img = img.filter(ImageFilter.GaussianBlur(radius=2))
    img.save(assets_dir / "hero_sun.jpg", quality=92)
    print("Created assets/hero_sun.jpg")

# -----------------------------------------------------------------------------
# 2. assets/hero_spacecraft.jpg (600 x 400)
# -----------------------------------------------------------------------------
def make_hero_spacecraft():
    w, h = 600, 400
    img = Image.new("RGB", (w, h), (7, 13, 27))
    draw = ImageDraw.Draw(img)

    # Background starfield
    import random
    random.seed(42)
    for _ in range(120):
        sx = random.randint(0, w)
        sy = random.randint(0, h)
        brightness = random.randint(120, 255)
        draw.point((sx, sy), fill=(brightness, brightness, brightness))

    # Sun glow on the left horizon
    for r in range(180, 0, -5):
        alpha = int(40 * (1 - r/180))
        draw.ellipse([-50 - r, 200 - r, -50 + r, 200 + r], fill=(alpha + 7, alpha//2 + 13, alpha//3 + 27))

    # Spacecraft at L1 (Center-Right: 320, 200)
    cx, cy = 320, 200

    # Solar Arrays (Left and Right wings)
    # Left Wing
    draw.polygon([
        (cx - 160, cy - 25), (cx - 50, cy - 15),
        (cx - 50, cy + 15), (cx - 160, cy + 25)
    ], fill=(20, 60, 120), outline=(56, 189, 248), width=2)
    # Solar panel grid lines
    for gx in range(cx - 145, cx - 55, 20):
        draw.line([(gx, cy - 20), (gx, cy + 20)], fill=(56, 189, 248), width=1)

    # Right Wing
    draw.polygon([
        (cx + 50, cy - 15), (cx + 160, cy - 25),
        (cx + 160, cy + 25), (cx + 50, cy + 15)
    ], fill=(20, 60, 120), outline=(56, 189, 248), width=2)
    for gx in range(cx + 65, cx + 155, 20):
        draw.line([(gx, cy - 20), (gx, cy + 20)], fill=(56, 189, 248), width=1)

    # Main Cube Body (Gold MLI Thermal Blanket)
    draw.polygon([
        (cx - 45, cy - 40), (cx + 45, cy - 40),
        (cx + 45, cy + 40), (cx - 45, cy + 40)
    ], fill=(217, 140, 30), outline=(250, 204, 21), width=2)

    # Payload Apertures & Optical Baffles (Top)
    # VELC Occulter Baffle
    draw.rectangle([cx - 30, cy - 65, cx - 5, cy - 40], fill=(40, 45, 55), outline=(244, 63, 94), width=2)
    # SUIT Telescope Barrel
    draw.rectangle([cx + 5, cy - 60, cx + 30, cy - 40], fill=(30, 40, 50), outline=(16, 185, 129), width=2)

    # Magnetometer Boom extending upward-right
    draw.line([(cx + 40, cy - 20), (cx + 90, cy - 80)], fill=(200, 200, 210), width=3)
    draw.ellipse([cx + 86, cy - 84, cx + 94, cy - 76], fill=(14, 165, 233))

    # Sun Sensor dish
    draw.arc([cx - 15, cy + 40, cx + 15, cy + 70], 0, 180, fill=(200, 200, 220), width=3)

    img.save(assets_dir / "hero_spacecraft.jpg", quality=92)
    print("Created assets/hero_spacecraft.jpg")

# -----------------------------------------------------------------------------
# 3. assets/sidebar_spacecraft.jpg (480 x 280)
# -----------------------------------------------------------------------------
def make_sidebar_spacecraft():
    w, h = 480, 280
    img = Image.new("RGB", (w, h), (11, 19, 38))
    draw = ImageDraw.Draw(img)

    # Distant Earth & Sun
    # Sun flare on top left
    for r in range(90, 0, -4):
        c = (int(250 * (1 - r/90)), int(150 * (1 - r/90)), int(50 * (1 - r/90)))
        draw.ellipse([-30 - r, -30 - r, -30 + r, -30 + r], fill=c)

    # Earth crescent on bottom right
    draw.ellipse([w - 60, h - 60, w - 10, h - 10], fill=(2, 132, 199))
    draw.ellipse([w - 55, h - 55, w - 15, h - 15], fill=(11, 19, 38))

    # Satellite Model
    cx, cy = 240, 140

    # Solar Panels
    draw.rectangle([cx - 130, cy - 20, cx - 40, cy + 20], fill=(15, 45, 90), outline=(56, 189, 248), width=2)
    draw.rectangle([cx + 40, cy - 20, cx + 130, cy + 20], fill=(15, 45, 90), outline=(56, 189, 248), width=2)

    # Gold Body
    draw.rectangle([cx - 35, cy - 35, cx + 35, cy + 35], fill=(210, 130, 20), outline=(245, 158, 11), width=2)

    # Payloads
    draw.rectangle([cx - 25, cy - 50, cx - 5, cy - 35], fill=(30, 30, 40), outline=(244, 63, 94), width=1)
    draw.rectangle([cx + 5, cy - 48, cx + 25, cy - 35], fill=(30, 30, 40), outline=(16, 185, 129), width=1)

    # MAG Boom
    draw.line([(cx + 30, cy - 10), (cx + 75, cy - 55)], fill=(180, 190, 205), width=2)
    draw.ellipse([cx + 72, cy - 58, cx + 78, cy - 52], fill=(14, 165, 233))

    img.save(assets_dir / "sidebar_spacecraft.jpg", quality=92)
    print("Created assets/sidebar_spacecraft.jpg")

# -----------------------------------------------------------------------------
# 4-10. Payload Icons (160 x 120 Transparent PNGs)
# -----------------------------------------------------------------------------
def make_icon(filename, bg_color, border_color, draw_fn):
    w, h = 160, 120
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded pill container
    draw.rounded_rectangle([10, 10, w - 10, h - 10], radius=16, fill=bg_color, outline=border_color, width=2)
    draw_fn(draw, w // 2, h // 2)
    img.save(assets_dir / filename)
    print(f"Created assets/{filename}")

# VELC Icon
def draw_velc(draw, cx, cy):
    # Occulting disk with coronal rays
    draw.arc([cx - 32, cy - 32, cx + 32, cy + 32], 0, 360, fill=(244, 63, 94, 180), width=3)
    draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(244, 63, 94, 255))
    # Streamers
    for a in range(0, 360, 45):
        rad = math.radians(a)
        draw.line([
            (cx + math.cos(rad) * 18, cy + math.sin(rad) * 18),
            (cx + math.cos(rad) * 36, cy + math.sin(rad) * 36)
        ], fill=(255, 180, 190, 220), width=2)

# SUIT Icon
def draw_suit(draw, cx, cy):
    # Telescope aperture with UV filter ring
    draw.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(6, 78, 59, 200), outline=(16, 185, 129, 255), width=2)
    draw.ellipse([cx - 15, cy - 15, cx + 15, cy + 15], fill=(16, 185, 129, 120), outline=(52, 211, 153, 255), width=2)
    draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 255, 255, 240))

# SoLEXS Icon
def draw_solexs(draw, cx, cy):
    # Silicon Drift Detector grid
    draw.rectangle([cx - 25, cy - 25, cx + 25, cy + 25], fill=(124, 45, 18, 180), outline=(249, 115, 22, 255), width=2)
    for i in [-12, 0, 12]:
        draw.line([(cx + i, cy - 22), (cx + i, cy + 22)], fill=(251, 146, 60, 200), width=1)
        draw.line([(cx - 22, cy + i), (cx + 22, cy + i)], fill=(251, 146, 60, 200), width=1)

# HEL1OS Icon
def draw_hel1os(draw, cx, cy):
    # CZT hard X-ray pixel crystal array
    for ox in [-18, 0, 18]:
        for oy in [-18, 0, 18]:
            draw.rectangle([cx + ox - 6, cy + oy - 6, cx + ox + 6, cy + oy + 6], fill=(15, 118, 110, 220), outline=(20, 184, 166, 255), width=1)

# ASPEX Icon
def draw_aspex(draw, cx, cy):
    # Toroidal electrostatic analyzer curves
    draw.arc([cx - 28, cy - 28, cx + 28, cy + 28], 30, 150, fill=(56, 189, 248, 255), width=3)
    draw.arc([cx - 20, cy - 20, cx + 20, cy + 20], 30, 150, fill=(125, 211, 252, 255), width=2)
    # Particle stream arrow
    draw.line([(cx - 20, cy - 10), (cx + 20, cy + 15)], fill=(255, 255, 255, 255), width=2)

# PAPA Icon
def draw_papa(draw, cx, cy):
    # Suprathermal electron analyzer concentric rings
    draw.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], outline=(245, 158, 11, 255), width=2)
    draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], outline=(251, 191, 36, 255), width=2)
    draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(245, 158, 11, 255))

# MAG Icon
def draw_mag(draw, cx, cy):
    # Magnetometer boom with triaxial vectors
    draw.line([(cx - 22, cy + 20), (cx + 15, cy - 15)], fill=(14, 165, 233, 255), width=3)
    draw.ellipse([cx + 11, cy - 19, cx + 19, cy - 11], fill=(56, 189, 248, 255))
    # Magnetic field loops
    draw.arc([cx - 10, cy - 25, cx + 30, cy + 15], 0, 360, fill=(125, 211, 252, 140), width=1)

make_hero_sun()
make_hero_spacecraft()
make_sidebar_spacecraft()

make_icon("icon_velc.png", (244, 63, 94, 30), (244, 63, 94, 140), draw_velc)
make_icon("icon_suit.png", (16, 185, 129, 30), (16, 185, 129, 140), draw_suit)
make_icon("icon_solexs.png", (249, 115, 22, 30), (249, 115, 22, 140), draw_solexs)
make_icon("icon_hel1os.png", (20, 184, 166, 30), (20, 184, 166, 140), draw_hel1os)
make_icon("icon_aspex.png", (56, 189, 248, 30), (56, 189, 248, 140), draw_aspex)
make_icon("icon_papa.png", (245, 158, 11, 30), (245, 158, 11, 140), draw_papa)
make_icon("icon_mag.png", (14, 165, 233, 30), (14, 165, 233, 140), draw_mag)

# Copy to frontend/public/assets so Vite dev server also has them
public_assets = pathlib.Path("frontend/public/assets")
public_assets.mkdir(parents=True, exist_ok=True)
for f in assets_dir.glob("*.*"):
    shutil.copy(f, public_assets / f.name)
print("Copied all assets to frontend/public/assets/")

dist_assets = pathlib.Path("frontend/dist/assets")
if dist_assets.parent.exists():
    dist_assets.mkdir(parents=True, exist_ok=True)
    for f in assets_dir.glob("*.*"):
        shutil.copy(f, dist_assets / f.name)
    print("Copied all assets to frontend/dist/assets/")
