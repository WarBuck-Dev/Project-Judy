@echo off
echo ========================================
echo Project Judy - Starting Local Server
echo ========================================
echo.
echo The simulator will open in your default browser.
echo Keep this window open while using the simulator.
echo Press Ctrl+C to stop the server when done.
echo.
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting server with Python...
    echo Server running at: http://localhost:8000
    echo.
    start http://localhost:8000
    python -m http.server 8000
) else (
    echo Python not found. Checking for Node.js...
    node --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo Starting server with Node.js...
        echo Server running at: http://localhost:8000
        echo.
        start http://localhost:8000
        npx http-server -p 8000
    ) else (
        echo.
        echo ERROR: Neither Python nor Node.js found!
        echo.
        echo Please install one of the following:
        echo   1. Python 3: https://www.python.org/downloads/
        echo   2. Node.js: https://nodejs.org/
        echo.
        echo After installation, run this file again.
        echo.
        pause
    )
)
