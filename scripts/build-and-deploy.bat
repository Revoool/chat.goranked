@echo off
REM Build Chat Desk with custom update server and deploy to goranked.gg
REM Run from chatapp directory (on Windows)

set UPDATE_URL=https://goranked.gg/chat-desk/releases
set CSC_IDENTITY_AUTO_DISCOVERY=false

echo Building with UPDATE_URL=%UPDATE_URL%
call npm run clean:release
call npm run build
call npx electron-builder --win --x64 --publish never

echo.
echo Deploying to goranked.gg...
node scripts\deploy-release.js

echo.
echo Done. Release deployed.
