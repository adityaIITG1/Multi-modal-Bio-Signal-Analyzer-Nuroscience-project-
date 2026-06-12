import os
import math
from PIL import Image, ImageDraw

def draw_eye_frame(width, height, blink_factor):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = width / 2, height / 2
    color_cyan = (0, 220, 255, 255)
    color_white = (255, 255, 255, 255)
    
    eye_w = width * 0.8
    eye_h = height * 0.45 * blink_factor
    
    if blink_factor < 0.1:
        # Draw closed eye curve
        points = []
        steps = 20
        for i in range(steps + 1):
            x = cx - eye_w/2 + (eye_w * i / steps)
            dx = (x - cx) / (eye_w / 2)
            y = cy + 5 * (1 - dx*dx)
            points.append((x, y))
        draw.line(points, fill=color_cyan, width=4, joint="round")
        draw.line(points, fill=color_white, width=1, joint="round")
        return img
        
    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    
    points = []
    steps = 30
    for i in range(steps + 1):
        x = cx - eye_w/2 + (eye_w * i / steps)
        dx = (x - cx) / (eye_w / 2)
        y = cy - (eye_h / 2) * (1 - dx*dx)
        points.append((x, y))
    for i in range(steps, -1, -1):
        x = cx - eye_w/2 + (eye_w * i / steps)
        dx = (x - cx) / (eye_w / 2)
        y = cy + (eye_h / 2) * (1 - dx*dx)
        points.append((x, y))
        
    mask_draw.polygon(points, fill=255)
    
    content = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(content)
    c_draw.polygon(points, fill=(10, 20, 30, 160))
    
    iris_r = min(width, height) * 0.2
    c_draw.ellipse([(cx - iris_r, cy - iris_r), (cx + iris_r, cy + iris_r)], fill=(0, 180, 255, 255))
    
    pupil_r = iris_r * 0.45
    c_draw.ellipse([(cx - pupil_r, cy - pupil_r), (cx + pupil_r, cy + pupil_r)], fill=(0, 15, 30, 255))
    
    glare_r = pupil_r * 0.5
    c_draw.ellipse([(cx - pupil_r*0.7, cy - pupil_r*0.7), (cx - pupil_r*0.7 + glare_r, cy - pupil_r*0.7 + glare_r)], fill=(255, 255, 255, 220))
    
    img.paste(content, (0, 0), mask=mask)
    
    draw.polygon(points, outline=(0, 220, 255, 60), width=5)
    draw.polygon(points, outline=color_cyan, width=3)
    draw.polygon(points, outline=color_white, width=1)
    
    return img

def draw_hand_frame(width, height, contract_factor):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = width / 2, height / 2
    color_gold = (255, 140, 0, 255)
    color_white = (255, 220, 150, 255)
    
    draw.line([(cx - 12, cy + 20), (cx - 12, cy + 45)], fill=color_gold, width=3)
    draw.line([(cx + 12, cy + 20), (cx + 12, cy + 45)], fill=color_gold, width=3)
    draw.line([(cx - 12, cy + 30), (cx + 12, cy + 30)], fill=color_gold, width=2)
    
    palm_points = [
        (cx - 20, cy + 20),
        (cx - 22, cy - 5),
        (cx + 22, cy - 5),
        (cx + 20, cy + 20)
    ]
    draw.polygon(palm_points, outline=color_gold, fill=(35, 15, 0, 140), width=3)
    
    for i in range(4):
        bx = cx - 15 + i * 10
        by = cy - 5
        
        scale = 1.0
        if i == 0: scale = 0.95
        elif i == 1: scale = 1.05
        elif i == 2: scale = 1.00
        elif i == 3: scale = 0.80
        
        L1 = 14 * scale
        L2 = 12 * scale
        L3 = 9 * scale
        
        t = contract_factor
        theta1 = -math.pi/2 + (math.pi * 0.85 * t)
        theta2 = theta1 + (math.pi * 0.7 * t)
        theta3 = theta2 + (math.pi * 0.7 * t)
        
        k1 = (bx, by)
        k2 = (k1[0] + L1 * math.cos(theta1), k1[1] + L1 * math.sin(theta1))
        k3 = (k2[0] + L2 * math.cos(theta2), k2[1] + L2 * math.sin(theta2))
        tip = (k3[0] + L3 * math.cos(theta3), k3[1] + L3 * math.sin(theta3))
        
        finger_pts = [k1, k2, k3, tip]
        draw.line(finger_pts, fill=color_gold, width=4, joint="round")
        draw.line(finger_pts, fill=color_white, width=1, joint="round")
        
    thumb_base = (cx - 20, cy + 10)
    TL1 = 12
    TL2 = 10
    
    tt = contract_factor
    theta_t1 = -math.pi * 0.8 + (math.pi * 0.75 * tt)
    theta_t2 = theta_t1 + (math.pi * 0.3 * tt)
    
    tk2 = (thumb_base[0] + TL1 * math.cos(theta_t1), thumb_base[1] + TL1 * math.sin(theta_t1))
    ttip = (tk2[0] + TL2 * math.cos(theta_t2), tk2[1] + TL2 * math.sin(theta_t2))
    
    thumb_pts = [thumb_base, tk2, ttip]
    draw.line(thumb_pts, fill=color_gold, width=4, joint="round")
    draw.line(thumb_pts, fill=color_white, width=1, joint="round")
    
    return img

def make_transparent_gif(frames, filepath, duration=100):
    p_frames = []
    for f in frames:
        p_frame = f.convert("P", palette=Image.ADAPTIVE, colors=256)
        p_frames.append(p_frame)
    
    p_frames[0].save(
        filepath,
        save_all=True,
        append_images=p_frames[1:],
        duration=duration,
        loop=0,
        transparency=0,
        disposal=2
    )

def main():
    os.makedirs("assets", exist_ok=True)
    width, height = 120, 120
    
    # 1. Generate Blinking Eye
    eye_frames = []
    # Open state
    for _ in range(20):
        eye_frames.append(draw_eye_frame(width, height, 1.0))
    # Closing
    for factor in [0.7, 0.4, 0.1]:
        eye_frames.append(draw_eye_frame(width, height, factor))
    # Closed
    for _ in range(3):
        eye_frames.append(draw_eye_frame(width, height, 0.0))
    # Opening
    for factor in [0.3, 0.6, 0.9]:
        eye_frames.append(draw_eye_frame(width, height, factor))
        
    make_transparent_gif(eye_frames, "assets/blinking_eye.gif", duration=80)
    print("Saved assets/blinking_eye.gif")
    
    # 2. Generate Flexing Hand
    hand_frames = []
    # Relaxed state (20 frames)
    for _ in range(15):
        hand_frames.append(draw_hand_frame(width, height, 0.0))
    # Contracting (10 frames)
    for step in range(10):
        factor = step / 9.0
        hand_frames.append(draw_hand_frame(width, height, factor))
    # Fully contracted state (10 frames)
    for _ in range(10):
        hand_frames.append(draw_hand_frame(width, height, 1.0))
    # Relaxing (10 frames)
    for step in range(10):
        factor = 1.0 - (step / 9.0)
        hand_frames.append(draw_hand_frame(width, height, factor))
        
    make_transparent_gif(hand_frames, "assets/flexing_hand.gif", duration=80)
    print("Saved assets/flexing_hand.gif")

if __name__ == "__main__":
    main()
