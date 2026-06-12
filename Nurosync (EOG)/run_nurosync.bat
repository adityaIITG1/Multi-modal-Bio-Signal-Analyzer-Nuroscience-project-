@echo off
setlocal
set ROOT_DIR=%~dp0
set VENV=%ROOT_DIR%.venv\Scripts\python.exe

if exist "%VENV%" (
    pushd "%ROOT_DIR%"
    "%VENV%" "%ROOT_DIR%main.py"
    popd
) else (
    echo Virtual environment not found.
    echo Please run the following commands in the project folder first:
    echo    python -m venv .venv
    echo    .venv\Scripts\activate
    echo    pip install -r requirements.txt
    pause
)
