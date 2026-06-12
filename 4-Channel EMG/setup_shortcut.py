import os
from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont
from win32com.client import Dispatch

def load_font(size, bold=True):
    names = ["arialbd.ttf", "segoeuib.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()

def centered_text(draw, xy, text, font, fill):
    x, y, w, h = xy
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x + (w - tw) / 2, y + (h - th) / 2 - 2), text, font=font, fill=fill)

def create_clean_icon(ico_path):
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((10, 10, 246, 246), radius=38, fill=(12, 21, 36, 255))
    draw.rounded_rectangle((10, 10, 246, 246), radius=38, outline=(0, 229, 255, 255), width=6)
    draw.rounded_rectangle((22, 22, 234, 234), radius=28, outline=(39, 174, 96, 190), width=2)

    # Four channel markers.
    channel_colors = [(0, 229, 255), (255, 214, 0), (0, 255, 133), (255, 77, 109)]
    for i, color in enumerate(channel_colors):
        y = 42 + i * 18
        draw.rounded_rectangle((32, y, 72, y + 8), radius=4, fill=color + (255,))

    # EMG waveform, intentionally thick for small desktop sizes.
    wave = [
        (34, 134), (52, 134), (66, 112), (84, 156), (104, 92),
        (122, 174), (142, 116), (160, 136), (178, 94), (196, 148), (222, 148)
    ]
    for offset in (-2, -1, 0, 1, 2):
        shifted = [(x, y + offset) for x, y in wave]
        draw.line(shifted, fill=(0, 229, 255, 255), width=5, joint="curve")

    font_np = load_font(68)
    font_4ch = load_font(36)
    centered_text(draw, (0, 48, 256, 70), "NP", font_np, (255, 255, 255, 255))
    centered_text(draw, (0, 174, 256, 42), "4CH", font_4ch, (255, 255, 255, 255))

    font_small = load_font(16, bold=False)
    centered_text(draw, (0, 214, 256, 22), "EMG", font_small, (0, 229, 255, 255))

    img.save(
        ico_path,
        format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )

def create_4ch_shortcut():
    project_dir = r"C:\Users\ASUS\OneDrive\Desktop\4-Channel EMG"
    ico_path = os.path.join(project_dir, "logo_4ch.ico")
    create_clean_icon(ico_path)
    print(f"Icon saved to {ico_path}")

    desktop = os.path.join(os.path.join(os.environ['USERPROFILE']), 'OneDrive', 'Desktop')
    if not os.path.exists(desktop):
        desktop = os.path.join(os.path.join(os.environ['USERPROFILE']), 'Desktop')
    
    path = os.path.join(desktop, "NeuroPulseAI 4-Channel.lnk")
    target = os.path.join(project_dir, "launch_4ch_plotter.bat")
    
    shell = Dispatch('WScript.Shell')
    shortcut = shell.CreateShortCut(path)
    shortcut.Targetpath = target
    shortcut.WorkingDirectory = project_dir
    if ico_path:
        shortcut.IconLocation = ico_path
    shortcut.save()
    print(f"Desktop shortcut created at {path}")

if __name__ == "__main__":
    try:
        create_4ch_shortcut()
    except Exception as e:
        print(f"Error: {e}")
