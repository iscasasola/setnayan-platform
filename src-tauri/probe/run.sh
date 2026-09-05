#!/bin/bash
# S0 spike runner — build-sessions/encoder/S0.md. macOS only (pmset / ps -o).
#
#   src-tauri/probe/run.sh <matrix|ipc|encode> [minutes] [logfile]
#
# 1. `cargo tauri build --debug --no-bundle` (debug profile ⇒ probe commands +
#    capabilities-debug/ compiled in; release has neither — see build.rs).
# 2. Launches the debug binary with SETNAYAN_PROBE=<mode>; the shell page
#    redirects to https://setnayan.com, probe.rs evals the probe there, and every
#    `probe_report` line lands on stdout → the log.
# 3. Beside it, every 10 s: `pmset -g therm`, and %CPU/RSS of the app and of the
#    WebKit WebContent/GPU processes; plus a live `pmset -g thermlog` stream.
# The run ends when the page reports `"stage":"done"` (or on a 5-minute silence).
set -u
MODE="${1:?mode: matrix|ipc|encode}"
MINUTES="${2:-60}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${3:-$HERE/probe/s0-$MODE-$(date +%Y%m%d-%H%M%S).log}"
case "$LOG" in /*) ;; *) LOG="$PWD/$LOG" ;; esac   # the script cd's into src-tauri below
mkdir -p "$(dirname "$LOG")"
BIN="$HERE/target/debug/setnayan-desktop"

log() { echo "[runner] $(date '+%Y-%m-%dT%H:%M:%S%z') $*" | tee -a "$LOG"; }

{
  echo "=== S0 probe run mode=$MODE minutes=$MINUTES started $(date) ==="
  sw_vers; uname -m; sysctl -n machdep.cpu.brand_string
  echo "WebKit framework: $(defaults read /System/Library/Frameworks/WebKit.framework/Versions/A/Resources/version.plist CFBundleVersion 2>/dev/null)"
  echo "Safari: $(defaults read /Applications/Safari.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null)"
  echo "rustc: $(rustc --version) · tauri-cli: $(cargo tauri --version 2>/dev/null)"
  echo "git: $(git -C "$HERE" rev-parse --short HEAD) $(git -C "$HERE" rev-parse --abbrev-ref HEAD)"
} >> "$LOG"

cd "$HERE" || exit 1
S=$(date +%s)
# SETNAYAN_PROBE_SHELL=local: build with probe/local-shell as frontendDist so the
# webview STAYS on tauri://localhost (no redirect to setnayan.com) — the weaker
# control origin; run.sh then also sets SETNAYAN_PROBE_ORIGIN=any for the launch.
BUILD_ARGS=(--debug --no-bundle)
if [ "${SETNAYAN_PROBE_SHELL:-}" = "local" ]; then
  BUILD_ARGS+=(--config '{"build":{"frontendDist":"./probe/local-shell"}}')
  export SETNAYAN_PROBE_ORIGIN=any
  log "CONTROL RUN on tauri://localhost (SETNAYAN_PROBE_SHELL=local) — weaker origin, not the finding's primary result"
fi
cargo tauri build "${BUILD_ARGS[@]}" >> "$LOG" 2>&1
BUILD_EXIT=$?
log "BUILD_EXIT=$BUILD_EXIT elapsed=$(( $(date +%s) - S ))s"
if [ "$BUILD_EXIT" -ne 0 ] || [ ! -x "$BIN" ]; then log "build failed or binary missing: $BIN"; exit 1; fi

log "load-at-start: $(uptime | sed 's/.*load averages: //') · SETNAYAN_PROBE_TOP=${SETNAYAN_PROBE_TOP:-0} SETNAYAN_PROBE_ORIGIN=${SETNAYAN_PROBE_ORIGIN:-}"
SETNAYAN_PROBE="$MODE" SETNAYAN_PROBE_MINUTES="$MINUTES" "$BIN" >> "$LOG" 2>&1 &
APP_PID=$!
log "app pid=$APP_PID bin=$BIN"

pmset -g thermlog 2>&1 | while IFS= read -r line; do echo "[thermlog] $(date '+%H:%M:%S') $line"; done >> "$LOG" &
THERM_PID=$!

sample() {
  {
    echo "[sample] $(date '+%Y-%m-%dT%H:%M:%S') therm: $(pmset -g therm 2>&1 | tr '\n' '|')"
    echo "[sample] procs (pid %cpu rss_kb comm):"
    ps -axo pid,%cpu,rss,comm | grep -E "setnayan-desktop|WebKit\.WebContent|WebKit\.GPU" | grep -v grep | sort -k2 -nr | head -6 | sed 's/^/[sample]   /'
  } >> "$LOG"
}

last_size=0; silent=0
while kill -0 "$APP_PID" 2>/dev/null; do
  sample
  if grep -q '"stage":"done"' "$LOG" || grep -q '"stage":"fatal"' "$LOG"; then
    log "page reported done/fatal — stopping app"
    break
  fi
  size=$(wc -c < "$LOG")
  if [ "$size" -eq "$last_size" ]; then silent=$((silent+10)); else silent=0; fi
  last_size=$size
  if [ "$silent" -ge 300 ]; then log "no output for 300 s — stopping app"; break; fi
  sleep 10
done
kill "$APP_PID" 2>/dev/null; kill "$THERM_PID" 2>/dev/null; pkill -P "$THERM_PID" 2>/dev/null
wait "$APP_PID" 2>/dev/null
log "app exited; log=$LOG"
echo "$LOG"
