## 2026-09-05 · ci(encoder): the native encoder's 42 tests now block a merge

S6 shipped 42 Rust tests for the FLV/RTMPS encoder and **nothing in CI ran a single
one of them**: `grep -rl "cargo test" .github/workflows/` returned nothing, and
`build-desktop.yml` — the only workflow that touches cargo — has been
`workflow_dispatch`-only since 2026-06-20. Three of those tests are guards that cost
real work to write and would have rotted in silence: sequence headers before any media
tag, RTMP's extended-timestamp encoding past 16,777,215 ms (4 h 39 m 37 s, which lands
inside a wedding reception), and the sweep asserting no string the program emits
contains the stream key.

- **`cargo test -p setnayan-encoder` runs as a STEP inside `typecheck + lint`**, with
  `continue-on-error` + an aggregator line, matching the pattern that job's own header
  prescribes. A job of its own would go red on the PR page and the PR would merge
  anyway until somebody edited branch protection — that job's header records nine
  guards that spent months blocking nothing for exactly that reason. Verified by
  running the aggregator's script directly: `success` → exit 0, `failure` → exit 1,
  `skipped` → exit 1.
- **The encoder moved to its own crate**, `src-tauri/crates/encoder`
  (`setnayan-encoder`), re-exported from `setnayan_desktop_lib` as `encoder` so
  `encoder::…` paths still resolve. This is what makes the check affordable:
  `setnayan-desktop` cannot compile without tauri, and `tauri::generate_context!`
  cannot expand without `src-tauri/icons/*.png`, which are generated and gitignored —
  so testing in place would mean apt-installing libwebkit2gtk, installing node and the
  Tauri CLI, generating icons and compiling tauri + wry on every PR. That is the exact
  cost the owner removed on 2026-06-20 when the desktop builds came off push/PR
  triggers for "dominating GitHub Actions usage". Measured on a clean worktree with no
  icons at all: **42 tests, 41 s, no tauri in the tree**; the full desktop `cargo build
  --lib` still passes (125 s) so `build-desktop.yml` is unaffected.
- The S5 and S7 prompts and the encoder README now name the new path, and S5's says
  plainly that `contract.rs` already exists and is to be mirrored, not rewritten.

SPEC IMPACT: None — CI and crate layout; no product behaviour, no decision changed.
