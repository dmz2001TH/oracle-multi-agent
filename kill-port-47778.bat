@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :47778 ^| findstr LISTENING') do (
    taskkill /F /PID %%a
)
echo Done
