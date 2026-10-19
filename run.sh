#!/usr/bin/env bash
# Run RentScout locally: FastAPI backend (SQLite) on :8091 + React frontend on :5173.
# Usage: ./run.sh            (persistent DB at backend/rentscout.db)
#        ./run.sh --mock     (frontend only, in-browser mock data, no backend)
#        ./run.sh --reset    (delete the SQLite DB first, reseed demo data)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"  # default uv install locations
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"  # Homebrew (Apple Silicon / Intel)
if ! command -v uv >/dev/null; then
  echo "uv not found — installing it…"
  if command -v brew >/dev/null; then brew install uv
  else curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; fi
  command -v uv >/dev/null || { echo "uv install failed; install it manually: https://docs.astral.sh/uv/"; exit 1; }
fi
NODE_VERSION=v20.18.1
NODE_LOCAL="$ROOT/.tools/node"
export PATH="$NODE_LOCAL/bin:$PATH"
if ! command -v npm >/dev/null; then
  if command -v brew >/dev/null; then echo "Node.js not found — installing it with Homebrew…"; brew install node
  else
    # No admin rights or Homebrew needed: unpack the official Node.js build into ./.tools/node
    case "$(uname -s)-$(uname -m)" in
      Darwin-arm64) PLATFORM=darwin-arm64 ;; Darwin-x86_64) PLATFORM=darwin-x64 ;;
      Linux-x86_64) PLATFORM=linux-x64 ;; Linux-aarch64|Linux-arm64) PLATFORM=linux-arm64 ;;
      *) echo "Please install Node.js 20+ from https://nodejs.org"; exit 1 ;;
    esac
    echo "Node.js not found — downloading $NODE_VERSION ($PLATFORM) into .tools/node…"
    mkdir -p "$NODE_LOCAL"
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$PLATFORM.tar.gz" | tar -xz -C "$NODE_LOCAL" --strip-components=1
  fi
  command -v npm >/dev/null || { echo "Node.js install failed; install it from https://nodejs.org"; exit 1; }
fi

MODE=http
for a in "$@"; do
  case "$a" in
    --mock) MODE=mock ;;
    --reset) rm -f "$ROOT/backend/rentscout.db"; echo "Deleted backend/rentscout.db" ;;
    *) echo "Unknown option $a"; exit 1 ;;
  esac
done

echo "Installing dependencies…"
(cd "$ROOT/frontend" && npm install --silent)
if [ "$MODE" = http ]; then (cd "$ROOT/backend" && uv sync --quiet); fi

pids=()
cleanup() { echo; echo "Stopping…"; for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; wait 2>/dev/null || true; }
trap cleanup EXIT INT TERM

if [ "$MODE" = http ]; then
  (cd "$ROOT/backend" && DATABASE_URL="sqlite:///$ROOT/backend/rentscout.db" \
     uv run uvicorn app.main:create_app --factory --port 8091) &
  pids+=($!)
  for _ in $(seq 1 60); do curl -sf http://localhost:8091/api/health >/dev/null && break; sleep 0.5; done
  curl -sf http://localhost:8091/api/health >/dev/null || { echo "Backend failed to start"; exit 1; }
  echo "Backend:  http://localhost:8091  (API docs: http://localhost:8091/docs)"
fi

(cd "$ROOT/frontend" && VITE_API_MODE=$MODE VITE_API_URL=http://localhost:8091 npx vite --port 5173 --strictPort) &
pids+=($!)
echo "Frontend: http://localhost:5173  (mode: $MODE) — press Ctrl+C to stop"
wait
