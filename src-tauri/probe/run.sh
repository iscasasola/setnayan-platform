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
# Launch a per-run COPY of the binary. macOS SIGKILLs a process whose executable is
# replaced underneath it (code-signing page validation), and any `cargo tauri build
# --debug` in this tree — another run, a compile check after editing the include_str!'d
# probe script — replaces target/debug/setnayan-desktop. Measured 2026-09-05: three
# control runs died 10–40 s in with no Rust output while a rebuild happened beside them.
# The copy is removed when the run ends.
RUNBIN="$BIN.run-$$"
cp "$BIN" "$RUNBIN" || { log "could not copy $BIN to $RUNBIN"; exit 1; }
SETNAYAN_PROBE="$MODE" SETNAYAN_PROBE_MINUTES="$MINUTES" "$RUNBIN" >> "$LOG" 2>&1 &
APP_PID=$!
log "app pid=$APP_PID bin=$RUNBIN (copy of $BIN)"

pmset -g thermlog 2>&1 | while IFS= read -r line; do echo "[thermlog] $(date '+%H:%M:%S') $line"; done >> "$LOG" &
THERM_PID=$!

sample() {
  {
    echo "[sample] $(date '+%Y-%m-%dT%H:%M:%S') therm: $(pmset -g therm 2>&1 | tr '\n' '|')"
    echo "[sample] procs (pid %cpu rss_kb comm):"
    ps -axo pid,%cpu,rss,comm | grep -E "setnayan-desktop|WebKit\.WebContent|WebKit\.GPU" | grep -v grep | sort -k2 -nr | head -6 | sed 's/^/[sample]   /'
  } >> "$LOG"
}

# Silence = no new `[probe…]` line from the APP. It must NOT be the log's byte size:
# sample() above appends to the same log every loop, so a size-based check could
# never fire — measured 2026-09-05 as a hung control run that outlived its 300 s
# budget by an hour (rule 0c: a check that cannot fail is not a check).
last_probe_lines=0; silent=0
while kill -0 "$APP_PID" 2>/dev/null; do
  sample
  if grep -q '"stage":"done"' "$LOG" || grep -q '"stage":"fatal"' "$LOG"; then
    log "page reported done/fatal — stopping app"
    break
  fi
  probe_lines=$(grep -c '^\[probe' "$LOG")
  if [ "$probe_lines" -eq "$last_probe_lines" ]; then silent=$((silent+10)); else silent=0; fi
  last_probe_lines=$probe_lines
  if [ "$silent" -ge 300 ]; then log "no [probe] output for 300 s — stopping app"; break; fi
  sleep 10
done
kill "$APP_PID" 2>/dev/null; kill "$THERM_PID" 2>/dev/null; pkill -P "$THERM_PID" 2>/dev/null
# `pmset -g thermlog | while …` puts pmset in the pipeline, not under $THERM_PID —
# five of them were still alive from earlier runs on 2026-09-05. Kill ours by name.
pkill -f "pmset -g thermlog" 2>/dev/null
wait "$APP_PID" 2>/dev/null
rm -f "$RUNBIN"
log "app exited; log=$LOG"
echo "$LOG"
