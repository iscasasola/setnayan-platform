## 2026-09-06 · feat(encoder): S5 — the webview→Rust IPC transport, gated and bounded

Part of the S-series encoder plan (`build-sessions/encoder/README.md`). Builds on S6's
`contract.rs` (already shipped) and S4's in-flight worker (video-encode.ts, concurrent
session `claude/encoder-s4-video-encode` — not yet merged at the time of this PR).

### The owner decision this session builds to (2026-09-06)

The raw-binary IPC path is unreachable from `https://` origins on WebKit (S0 measured
1797/1797 chunks arriving as `InvokeBody::Json`, zero `Raw`). The owner chose to budget
the JSON envelope rather than serve the app from a Tauri scheme or patch wry for a
private WebKit API — see `build-sessions/encoder/S0-FINDING.md` §7 and PR #5232 (the
not-yet-merged doc correction this session treated as authoritative per RULE 0a, since
its content matches this session's own prompt verbatim and origin/main's S5.md was
still the stale pre-2026-09-06 version).

### What lands

- **`apps/web/lib/encoder/ipc-contract.ts`** — TypeScript mirror of
  `src-tauri/crates/encoder/src/contract.rs`'s 16-byte header, `ChunkKind`, `Envelope`,
  and the `DecoderConfig` payload. Both sides assert against the SAME hard-coded hex
  literal (`ENCODED_FIXTURE_HEX`) — neither derives the expected bytes from its own
  encoder, so a drift between the two languages fails one side's test, not both
  agreeing with themselves.
- **`contract.rs` gains `from_base64`/`to_base64`** (the envelope changes; the 16-byte
  header does not) plus a Rust-side byte-math test proving base64 (~1.33x) beats a JSON
  number array (~3.6x) on the same payload — deterministic, so it doesn't need a live
  webview measurement to be true.
- SPEC IMPACT: corpus `DECISION_LOG.md` — the JSON-envelope decision is already recorded
  via PR #5232; this fragment cross-references it rather than duplicating the row.

### Left for follow-up commits on this same branch

Rust command surface (`encoder_start/config/push/stop`), the ACL/capability grants, the
server-minted token route + migration, the CSP guard, and the backpressure ring's real
drop policy (S4's placeholder ring is a simple drop-oldest; this branch defines
drop-oldest-non-keyframe-then-whole-GOP, as its own module since S4 has not merged).
