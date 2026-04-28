@echo off
title Dayflow Dev Server
color 0A
echo ============================================
echo   DAYFLOW - Starting Development Server
echo ============================================
echo.

echo [1/3] Stopping old servers...
for %%P in (3000 3001 3002 3003 3004 3005) do (
    for /f "tokens=5" %%Q in ('netstat -ano 2^>nul ^| findstr ":%%P "') do (
        taskkill /F /PID %%Q >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul

echo [2/3] Starting server...
start /B cmd /c "npm run dev > dev-server.log 2>&1"

echo [3/3] Waiting for server to be ready...
:WAIT
timeout /t 2 /nobreak >nul
findstr /C:"Ready in" dev-server.log >nul 2>&1
if errorlevel 1 goto WAIT

echo.
echo ============================================
echo   Server ready! Pre-loading all pages...
echo ============================================
echo.

:: Pre-warm all routes so first navigation is instant
curl -s http://localhost:3000/ >nul 2>&1
curl -s http://localhost:3000/today >nul 2>&1
curl -s http://localhost:3000/calendar >nul 2>&1
curl -s http://localhost:3000/habits >nul 2>&1
curl -s http://localhost:3000/sleep >nul 2>&1
curl -s http://localhost:3000/screen-time >nul 2>&1
curl -s http://localhost:3000/goals >nul 2>&1
curl -s http://localhost:3000/login >nul 2>&1

echo   All pages pre-loaded. Navigation will be fast.
echo.
echo   Open: http://localhost:3000
echo   Keep this window OPEN while working.
echo   Press Ctrl+C to stop.
echo ============================================
echo.

:: Keep window alive and show live logs
type dev-server.log
tail -f dev-server.log 2>nul || (
    echo Watching server...
    :ALIVE
    timeout /t 30 /nobreak >nul
    goto ALIVE
)
