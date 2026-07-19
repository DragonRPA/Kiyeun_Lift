@echo off

REM -------------------------------------------------
REM Batch file to launch local test version of 기연리프트 ERP
REM -------------------------------------------------

REM Ensure Node modules are installed
IF NOT EXIST "node_modules" (
    echo Installing dependencies...
    npm install
) ELSE (
    echo Dependencies already installed.
)

REM Determine environment. If NODE_ENV is set to "production", skip starting server.
IF "%NODE_ENV%"=="production" (
    echo Detected production environment. Skipping local dev server startup.
    EXIT /B 0
) ELSE (
    REM Start development server in a new window
    echo Starting development server...
    start "" npm run dev
    timeout /t 3 > nul
    start "" "http://localhost:5174"
)
