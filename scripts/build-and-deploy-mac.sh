#!/bin/bash
# Build Chat Desk for macOS and deploy to goranked.gg
# Run from chatapp directory — ONLY on macOS (Mac builds require Mac)

set -e
cd "$(dirname "$0")/.."

UPDATE_URL="https://goranked.gg/chat-desk/releases"
export UPDATE_URL

if [ "$(uname)" != "Darwin" ]; then
  echo "❌ This script must be run on macOS."
  echo "   Mac builds cannot be done on Linux/Windows (electron-builder requirement)."
  exit 1
fi

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "🔧 Building Mac app with UPDATE_URL=$UPDATE_URL"
npm run build:icons
npm run build
npx electron-builder --mac --x64 --arm64 --publish never

echo ""
echo "📤 Deploying to goranked.gg..."
node scripts/deploy-release.js

VERSION=$(node -p "require('./package.json').version")
echo ""
echo "✅ Done. Mac download links:"
echo "   Apple Silicon (M1/M2/M3): https://goranked.gg/chat-desk/releases/Goranked-Chat-Desk-${VERSION}-arm64.dmg"
echo "   Intel:                   https://goranked.gg/chat-desk/releases/Goranked-Chat-Desk-${VERSION}-x64.dmg"
