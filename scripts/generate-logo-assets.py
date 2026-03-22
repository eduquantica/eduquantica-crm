from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

out = Path("public/images")
out.mkdir(parents=True, exist_ok=True)

W, H = 1400, 400
NAVY = (27, 42, 74, 255)
GOLD = (245, 166, 35, 255)
WHITE = (255, 255, 255, 255)


def load_font(size: int):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


font = load_font(180)
font_small = load_font(150)

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

cx, cy = 180, H // 2
r = 86
hex_points = []
for i in range(6):
    angle = math.radians((60 * i) - 30)
    hex_points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))

draw.polygon(hex_points, fill=NAVY)

mark_points = [
    (cx - 42, cy - 18),
    (cx + 2, cy - 42),
    (cx + 36, cy - 22),
    (cx + 2, cy - 4),
    (cx + 2, cy + 6),
    (cx + 34, cy + 24),
    (cx + 0, cy + 46),
    (cx - 42, cy + 22),
]
draw.polygon(mark_points, fill=GOLD)

text_x = 300
draw.text((text_x, 108), "Edu", fill=NAVY, font=font)
edu_width = draw.textbbox((0, 0), "Edu", font=font)[2]
draw.text((text_x + edu_width + 8, 108), "Quantica", fill=GOLD, font=font)
img.save(out / "logo.png")

img_white = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw_white = ImageDraw.Draw(img_white)

draw_white.polygon(hex_points, fill=WHITE)
inner_points = [
    (cx - 34, cy - 14),
    (cx + 0, cy - 34),
    (cx + 20, cy - 22),
    (cx - 2, cy - 8),
    (cx - 2, cy + 8),
    (cx + 20, cy + 22),
    (cx + 0, cy + 34),
    (cx - 34, cy + 14),
]
draw_white.polygon(inner_points, fill=NAVY)
draw_white.text((text_x, 108), "EduQuantica", fill=WHITE, font=font_small)
img_white.save(out / "logo-white.png")

print("Generated", out / "logo.png", "and", out / "logo-white.png")
