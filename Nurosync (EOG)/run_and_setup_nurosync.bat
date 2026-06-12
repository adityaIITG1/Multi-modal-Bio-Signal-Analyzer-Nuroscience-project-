@echo off
setlocal enabledelayedexpansion
set ROOT_DIR=%~dp0
set VENV=%ROOT_DIR%.venv\Scripts\python.exe

echo Starting NuroSync launcher...

if exist "%VENV%" (
    echo Found virtual environment. Launching app...
    "%VENV%" "%ROOT_DIR%main.py" %*
    goto :EOF
)

:: Ask to create venv and install requirements
:askCreate
set /p CREATEVENV=Virtual environment not found. Create .venv and install requirements? (Y/N): 
if /I "%CREATEVENV%"=="Y" goto :createVenv
if /I "%CREATEVENV%"=="N" (
    echo Aborting. You can create venv manually with:
    echo    python -m venv .venv
    echo    .venv\Scripts\Activate.ps1
    echo    pip install -r requirements.txt
    pause
    goto :EOF
)
echo Please answer Y or N.
goto :askCreate

:createVenv
echo Creating virtual environment...
python -m venv .venv
if errorlevel 1 (
    echo Failed to create virtual environment. Ensure Python is in PATH.
    pause
    goto :EOF
)
echo Upgrading pip...
.venv\Scripts\python.exe -m pip install --upgrade pip
echo Installing requirements...
.venv\Scripts\python.exe -m pip install -r "%ROOT_DIR%requirements.txt"
if errorlevel 1 (
    echo pip install failed. Check the output above.
    pause
    goto :EOF
)
echo Launching app...
.venv\Scripts\python.exe "%ROOT_DIR%main.py" %*
pause
