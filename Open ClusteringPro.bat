@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "server.ps1" -Port 8900
