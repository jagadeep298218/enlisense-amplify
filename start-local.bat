@echo off
echo Starting EnLiSense Dashboard Locally...
echo.

echo Starting Backend Server...
start cmd /k "cd backend && echo Backend Server Starting... && node server.js"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Development Server...
start cmd /k "cd frontend && echo Frontend Development Server Starting... && npm start"

echo.
echo ========================================
echo   EnLiSense Dashboard Local Setup
echo ========================================
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8080
echo Debug:    http://localhost:3000/debug-login
echo ========================================
echo.
echo Both servers are starting in separate windows.
echo Press any key to close this window...
pause >nul 