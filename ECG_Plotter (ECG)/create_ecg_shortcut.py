import os
import sys
from PIL import Image
try:
    from win32com.client import Dispatch
except ImportError:
    print("pywin32 not found. Please install it using 'pip install pywin32'")
    sys.exit(1)

def create_shortcut():
    # Paths
    png_path = r"C:\Users\ASUS\.gemini\antigravity\brain\78d7718f-d846-4e68-9d97-a2f40962dd7c\ecg_monitor_icon_1776892717938.png"
    project_dir = r"c:\Users\ASUS\OneDrive\Desktop\ECG_Plotter"
    ico_path = os.path.join(project_dir, "ecg_icon.ico")
    bat_path = os.path.join(project_dir, "launch_ecg.bat")
    
    # 1. Convert PNG to ICO
    print(f"Converting {png_path} to ICO...")
    img = Image.open(png_path)
    # Ensure it's square and has alpha
    width, height = img.size
    size = max(width, height)
    new_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    new_img.paste(img, ((size - width) // 2, (size - height) // 2))
    new_img.resize((256, 256), Image.LANCZOS).save(ico_path, format='ICO')
    print(f"Icon saved to {ico_path}")

    # 2. Find Desktop
    desktop = os.path.join(os.path.join(os.environ['USERPROFILE']), 'OneDrive', 'Desktop')
    if not os.path.exists(desktop):
        desktop = os.path.join(os.path.join(os.environ['USERPROFILE']), 'Desktop')
    
    shortcut_path = os.path.join(desktop, "ECG Clinical Monitor.lnk")
    
    # 3. Create Shortcut
    print(f"Creating shortcut at {shortcut_path}...")
    shell = Dispatch('WScript.Shell')
    shortcut = shell.CreateShortCut(shortcut_path)
    
    # Use pythonw.exe to suppress console window
    pythonw_path = r"C:\Users\ASUS\anaconda3\Anaconda 2025\pythonw.exe"
    shortcut.Targetpath = pythonw_path
    shortcut.Arguments = f'"{os.path.join(project_dir, "ECG_Plotter.py")}"'
    shortcut.WorkingDirectory = project_dir
    shortcut.IconLocation = ico_path
    shortcut.save()
    print("Shortcut created successfully!")

if __name__ == "__main__":
    create_shortcut()
