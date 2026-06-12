@echo off
cd /d "%~dp0"
echo Starting ECG Clinical Monitor...
"C:\Users\ASUS\anaconda3\Anaconda 2025\python.exe" ECG_Plotter.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo Error detected during execution.
    pause
)
