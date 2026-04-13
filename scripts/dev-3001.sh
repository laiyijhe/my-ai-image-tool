#!/usr/bin/env bash
# Creator Guard — dev server on port 3001 (avoids conflict with another app on 3000)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Optional: NVM (macOS/Linux; skip if you use fnm, volta, or system Node)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use default 2>/dev/null || true
fi

echo "🚀 Starting dev server on http://localhost:3001 (project: $ROOT)"
PORT=3001 npm run dev
