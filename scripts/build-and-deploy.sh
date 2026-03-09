#!/bin/bash
# Build Chat Desk with custom update server and deploy to goranked.gg
# Run from chatapp directory
# On Linux: uses Docker (electronuserland/builder:wine) for Windows build

set -e
cd "$(dirname "$0")/.."

UPDATE_URL="https://goranked.gg/chat-desk/releases"

echo "🔧 Building with UPDATE_URL=$UPDATE_URL"

# Load .env for REVERB_APP_KEY etc
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi
export UPDATE_URL
export CSC_IDENTITY_AUTO_DISCOVERY=false

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  # Windows
  npm run build:icons
  npm run clean:release
  npm run build
  npx electron-builder --win --x64 --publish never
else
  # Linux/macOS - use Docker for Windows build
  if command -v docker &>/dev/null; then
    echo "Using Docker (electronuserland/builder:wine)..."
    docker run --rm \
      -v "$(pwd)":/project \
      -e UPDATE_URL \
      -e REVERB_APP_KEY \
      -e API_URL \
      -e CSC_IDENTITY_AUTO_DISCOVERY \
      electronuserland/builder:wine \
      /bin/bash -c "cd /project && npm run build:icons && npm run build && npx electron-builder --win --x64 --publish never"
  else
    echo "Docker not found. Install Docker or run build on Windows."
    exit 1
  fi
fi

echo ""
echo "📤 Deploying to goranked.gg..."
node scripts/deploy-release.js

echo ""
echo "✅ Done. Employees will get the update automatically."
