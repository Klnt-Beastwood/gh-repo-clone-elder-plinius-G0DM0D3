@echo off
REM Double-click this to launch G0DM0D3.
REM Runs the Node launcher, which checks your local model runtime, installs
REM dependencies if needed, starts the server and opens your browser.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed, or not on your PATH.
  echo   Install the LTS build from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

node setup.mjs

REM Keep the window open if something failed, so the error stays readable.
if errorlevel 1 pause
