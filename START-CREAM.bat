@echo off
setlocal enabledelayedexpansion

title CREAM — AI creator marketplace

cd /d "%~dp0"

rem ─────────────────────────────────────────────────────────────────────────────
rem  CREAM launcher for Windows.
rem
rem    START-CREAM.bat            install if needed, build, serve, open browser
rem    START-CREAM.bat dev        development server with hot reload
rem    START-CREAM.bat build      production build only, do not serve
rem    START-CREAM.bat check      typecheck + lint + production build, then exit
rem    START-CREAM.bat clean      remove .next and reinstall dependencies
rem ─────────────────────────────────────────────────────────────────────────────

set "MODE=%~1"
if "%MODE%"=="" set "MODE=serve"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   x  Node.js was not found on this machine.
  echo.
  echo     Install Node 18 or newer from https://nodejs.org and reopen this file.
  echo.
  pause
  exit /b 1
)

if /i "%MODE%"=="clean" goto :clean
if /i "%MODE%"=="check" goto :check
if /i "%MODE%"=="build" goto :buildonly
if /i "%MODE%"=="dev" goto :dev

:serve
call :banner
call :ensure_env
call :ensure_deps
call npm run launch -- --no-build
if errorlevel 1 goto :failed
goto :done

:dev
call :banner
call :ensure_env
call :ensure_deps
echo.
echo   Starting the development server with hot reload...
echo   Press Ctrl+C to stop.
echo.
call npm run dev
goto :done

:buildonly
call :banner
call :ensure_env
call :ensure_deps
call npm run build
if errorlevel 1 goto :failed
goto :done

:check
call :banner
call :ensure_env
call :ensure_deps
call npm run verify
if errorlevel 1 goto :failed
goto :done

:clean
call :banner
echo.
echo   Removing build output...
if exist ".next" rmdir /s /q ".next"
if exist "node_modules" rmdir /s /q "node_modules"
echo   Reinstalling dependencies...
call npm install
goto :done

:ensure_deps
if exist "node_modules" goto :eof
echo.
echo   Installing dependencies for the first time. This takes a minute...
call npm install
if errorlevel 1 (
  echo.
  echo   x  npm install failed. Check your network connection.
  goto :failed
)
goto :eof

:ensure_env
if exist ".env.local" goto :eof
echo.
echo   Creating .env.local from .env.example...
copy /y ".env.example" ".env.local" >nul
echo   Done. Add API keys there at any time - every subsystem works without them.
goto :eof

:banner
echo.
echo   ============================================================
echo     CREAM   .   AI creator marketplace
echo     verification . briefs . held escrow . signed provenance
echo   ============================================================
echo.
goto :eof

:failed
echo.
echo   x  CREAM could not start. Scroll up for the reason.
echo.
pause
exit /b 1

:done
echo.
echo   CREAM stopped.
echo.
pause
endlocal