@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to preview this static site.
  pause
  exit /b 1
)
node project-local-preview.cjs
if errorlevel 1 pause
