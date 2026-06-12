@echo off
cd /d "C:\Users\ASUS\OneDrive\Desktop\4-Channel EMG"
echo Launching NeuroPulseAI 4-Channel Fast Plotter...
"C:\Users\ASUS\anaconda3\Anaconda 2025\python.exe" neuropulseai_4ch_fast_plotter.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo App crashed with exit code %ERRORLEVEL%.
    pause
)
