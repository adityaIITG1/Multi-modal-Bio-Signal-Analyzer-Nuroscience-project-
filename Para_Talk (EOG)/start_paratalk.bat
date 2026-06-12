@echo off
title ParaTalk Server
echo =========================================
echo Starting ParaTalk EOG System...
echo Cleaning up old background servers...
taskkill /F /IM node.exe > NUL 2>&1
echo Please leave this window open while using the app!
echo =========================================
cd /d "c:\Users\ASUS\OneDrive\Desktop\Para_Talk"

:: Schedule the browser to open automatically after 5 seconds in the background
start /B cmd /c "ping localhost -n 6 > nul && start http://localhost:3000"

:: Start the WhatsApp server in the background
start /B node whatsapp-server.js

:: Start the server in this exact same window so we don't open two command prompts
npm run dev
