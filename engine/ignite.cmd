@echo off
setlocal enabledelayedexpansion
title Scorebug engine - ignition

REM ===========================================================================
REM  SCOREBUG // IGNITION, AS ONE FILE
REM
REM  WHY THIS EXISTS
REM  The runbook chained three commands with the "and-then" operator, starting
REM  from a relative path -- which quietly assumes you are standing in Documents.
REM  Run it one folder up and the first cd fails, but the chain keeps going, so
REM  every later step runs from wherever you actually were. That is how a deploy
REM  command ended up pointed at C:\.
REM
REM  %~dp0 is the folder THIS FILE is in, so every path below is anchored to
REM  the repo rather than to your prompt. It cannot be run from the wrong place.
REM  Each step stops on failure instead of falling through to the next one.
REM
REM  Double-click it, or run:  C:\Users\wyatt\Documents\scorebug-site\engine\ignite.cmd
REM ===========================================================================

set "ENGINE=%~dp0"
if "%ENGINE:~-1%"=="\" set "ENGINE=%ENGINE:~0,-1%"
for %%I in ("%ENGINE%\..") do set "SITE=%%~fI"

echo.
echo   engine : %ENGINE%
echo   site   : %SITE%
echo.

REM --- 1. dependencies -------------------------------------------------------
echo [1/5] installing engine dependencies
cd /d "%ENGINE%\functions" || goto :nofolder
call npm install --no-audit --no-fund
if errorlevel 1 goto :failed

REM --- 2. the test suite -----------------------------------------------------
echo.
echo [2/5] running the test suite
call npm test
if errorlevel 1 (
  echo.
  echo   Tests failed. Nothing has been deployed. Send me the output above.
  goto :end
)

REM --- 3. are the credentials real? -----------------------------------------
echo.
echo [3/5] checking every credential against its live service (read-only)
cd /d "%ENGINE%"
call node scripts\check-credentials.mjs
if errorlevel 1 (
  echo.
  echo   At least one service is failing. You can carry on -- the engine
  echo   reports what is off rather than guessing -- but read it first.
  echo.
  choice /c YN /m "Continue anyway"
  if errorlevel 2 goto :end
)

REM --- 4. ignition -----------------------------------------------------------
echo.
echo [4/5] igniting: secrets to Firebase, variables to Vercel, deploy
cd /d "%ENGINE%"
call node scripts\ignite.mjs
if errorlevel 1 goto :failed

REM --- 5. the site -----------------------------------------------------------
REM  This second deploy is not optional: ignite writes DISPATCH_KEY into Vercel,
REM  and until the site redeploys with it the card press renders every card but
REM  silently drops any community grade, because it cannot verify the signature.
echo.
echo [5/5] deploying the site so it picks up the new variables
cd /d "%SITE%"
call npx vercel --prod
if errorlevel 1 goto :failed

echo.
echo   Done. Open https://getscorebug.app/ops and sign in.
goto :end

:nofolder
echo.
echo   Could not find %ENGINE%\functions.
echo   This file must stay inside the engine folder of the repo.
goto :end

:failed
echo.
echo   Stopped at the step above. Nothing further has run.

:end
echo.
pause
endlocal
