#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
export NODE_ENV=production
export HOST=127.0.0.1
if [ -d "$DIR/chromium" ]; then
  if [ -f "$DIR/chromium/chrome" ]; then
    export CHROMIUM_PATH="$DIR/chromium/chrome"
  elif [ -f "$DIR/chromium/Chromium.app/Contents/MacOS/Chromium" ]; then
    export CHROMIUM_PATH="$DIR/chromium/Chromium.app/Contents/MacOS/Chromium"
  fi
fi
echo "🚀 Démarrage de l'Évaluateur Insertech..."
open "http://127.0.0.1:3000" 2>/dev/null || xdg-open "http://127.0.0.1:3000" 2>/dev/null || true
node dist/server.js
