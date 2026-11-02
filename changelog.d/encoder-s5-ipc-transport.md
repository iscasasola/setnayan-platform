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

### Everything above, now landed (this same session, resumed after a rate-limit kill)

- **`apps/web/lib/encoder/backpressure-ring.ts` + `.test.ts`** — the real drop policy:
  capacity 90 (3s @ 30fps); on overflow, drop the oldest non-keyframe first, then the
  oldest whole GOP once only keyframes remain, and NEVER evict the newest keyframe's
  GOP (the resync floor) — enforced by a small ring capacity in tests, not just
  asserted in prose. `RingEntry` has no audio member, so "never audio" is a type-level
  guarantee, not a runtime branch. 9 tests; mutation-tested (unbounded-ring sabotage:
  9/0 → 6 failing).

- **`src-tauri/src/encoder_ipc.rs`** (NEW, in the APP crate — `crates/encoder` stays
  tauri-free on purpose) — `encoder_start(token)` / `encoder_config(chunk)` /
  `encoder_push(chunk)` / `encoder_stop()` / `encoder_probe(request)`, registered in
  BOTH `generate_handler!` lists in `lib.rs` and in `build.rs`'s manifest command list
  (ships in every build, unlike the debug-only `probe` module). `encoder_start` verifies
  a token against `POST /api/live-studio/encoder/token/verify` over its own
  reqwest/rustls connection (never through the shared IPC channel), then stands up a
  bounded `tokio::sync::mpsc` (cap 256) and a stub sink task (S6 replaces it) that counts
  bytes/chunks. `encoder_config`/`encoder_push`/`encoder_stop` all refuse
  (`not_authorized`) unless a prior `encoder_start` succeeded — there is no other way to
  set `authorized = true`. Both media commands decode ONLY via
  `EncodedChunk::from_base64` — a plain string that isn't valid base64 is refused by
  name, never smuggled through as bytes. 5 Rust unit tests (pure `require_authorized` /
  `decode_and_check_kind` helpers, factored out the same way `stream_key.rs` factors
  `set_pasted_inner`); mutation-tested: command-without-token sabotage 5/0 → 4 failing;
  base64-bypass sabotage 5/0 → 2 passing/3 failing.

- **`src-tauri/capabilities/default.json`** — `allow-encoder-{start,config,push,stop,probe}`
  added under the existing `remote.urls` grant, mirroring exactly how `allow-stream-key-*`
  is granted (S8). `build.rs`'s command list gained the five command names so
  `tauri-build` emits their permission definitions.

- **`apps/web/lib/live-studio-encoder-tokens.ts`** + migration
  `20271209362403_live_studio_encoder_tokens.sql` (table `live_studio_encoder_tokens`,
  RLS enabled, NO POLICY, service-role only — same posture as
  `live_studio_encoder_claims`/S8, deliberately a SEPARATE table: that one hands over the
  real hosted-channel stream key, this one only authorizes the Tauri command call itself,
  and applies to both the own-channel and hosted-channel tiers). Two routes:
  `POST /api/live-studio/encoder/token` (mint, host-gated via `isLiveStudioSetupHost` +
  `supabase.auth.getUser()` — the same pattern `/api/live-studio/ingest-health` uses) and
  `POST /api/live-studio/encoder/token/verify` (single-use, delete-on-read consume,
  called only by Rust's own reqwest client, generic `{ok:false}` on any failure so it
  cannot be used to probe token validity).

- **`apps/web/lib/encoder/ipc-envelope.ts` + `.test.ts`** (NEW — referenced by
  `ipc-contract.ts`'s own header comment but not yet written before this commit) — the
  base64-in-JSON envelope's encode/decode (`chunkToBase64`/`chunkFromBase64`, mirroring
  Rust's `to_base64`/`from_base64`) and the go-live guard's `probeTransport`, which calls
  `encoder_probe` once before `encoder_start`. Refuses go-live ONLY when the probe
  measurably fails (the invoke throws, or Rust reports the base64 field didn't decode)
  — NEVER merely because the answer is the base64/JSON envelope, which is the EXPECTED
  path on every platform per the 2026-09-06 owner decision. This corrects S5's own
  original wording ("anything but Raw refuses go-live"), which S0 already measured would
  refuse every macOS user. 12 tests; mutation-tested (flip the "usable" branch to refuse
  on the base64 path → 12/0 becomes 9 passing/3 failing).

- **`apps/web/lib/live-studio-ingest-health.ts`** — extended `decideIngestHealth`
  (per rule 24: never a second decider) with an optional `transportEnvelope` input and a
  `transportNote` output field. Purely informational/additive: every existing caller
  that never passes it is unaffected, and no envelope value can change `state` — pinned
  by a test that sweeps all four `EnvelopeValue`s across five base scenarios. Mutation
  test: made a non-`raw` envelope degrade a healthy `receiving` read → 19/0 becomes
  17 passing/2 failing.

- **`apps/web/next.config.ts`** — draft `connect-src` gains `ipc: http://ipc.localhost`,
  commented with both why it's necessary (Windows/WebView2 requests
  `http://ipc.localhost/<command>`; absent from connect-src, that's a CSP violation) and
  why it's insufficient alone (macOS/WebKit still refuses the custom protocol from an
  `https://` document for a mixed-content reason no CSP entry fixes — hence the base64
  envelope on every platform, not just a Windows fix). Guarded by
  `apps/web/lib/csp-encoder-ipc.test.ts` (3 tests, mutation-tested: stripping the line
  fails the extractor-regression test).

### Environment note (not a code change)

An earlier attempt of this session hit `cargo check -p setnayan-desktop` failing with
`failed to open icon .../32x32.png: No such file or directory` — the generated app icons
are gitignored (`src-tauri/.gitignore`) and are only produced by `cargo tauri icon
src-tauri/icons/icon.svg` (or `pnpm tauri:icons`). By this (resumed) session's
verification pass the icons were already present in this worktree and `cargo check -p
setnayan-desktop` / `cargo test -p setnayan-desktop` (13/13 passing, including
`encoder_ipc`'s own 5) both ran clean — recorded here in case a future worktree hits the
same missing-icon state fresh; CI's `build-desktop.yml` runs the equivalent `tauri icon`
step itself, so this never affects CI.

### Verification pass (this resumed session) — three real defects found and fixed

The uncommitted work above was inherited from a prior attempt of this same session,
killed mid-turn by transient infra (a rate limit, then a DNS blip) rather than any
defect in the work. It was reviewed against S5.md fresh rather than trusted, and three
real problems turned up:

- **`backpressure-ring.ts` failed `tsc --noEmit`** (`TS2532: Object is possibly
  'undefined'` at `dropOldestGop`'s `buf[i].keyframe` under
  `noUncheckedIndexedAccess`) — the loop bound (`i < buf.length`) already guarantees
  `buf[i]` exists, so this was a missing `!`, not a real undefined case. Fixed to
  `buf[i]!.keyframe`. `TSC_EXIT=0 ERROR_LINES=0` after the fix (was `TSC_EXIT=1
  ERROR_LINES=1` before).
- **A real naming collision with an existing guard**: S5's new `allow-encoder-probe`
  capability (the go-live transport-envelope probe, ships in every build) shares the
  substring "probe" with `lib/desktop-probe-is-debug-only.test.ts`'s release-capability
  check, which — before this fix — banned ANY permission string containing `/probe/`
  as a way of keeping the S0 debug-only spike harness (`allow-probe-report`,
  `allow-probe-ipc`) out of release builds. Running the FULL `pnpm --filter
  @setnayan/web test:unit` (13332 tests, not just this branch's own new files) caught
  it: 1 failure, `not ok 4091`. Fixed by tightening that guard's regex from a bare
  `/probe/` substring to the S0 harness's two actual permission names
  (`/^allow-probe-(report|ipc)$/`) — mutation-tested both directions: the legitimate
  `allow-encoder-probe` now passes (3/3), and re-injecting the original sabotage
  (`allow-probe-report` leaked into `capabilities/default.json`) still fails it (3/3 →
  2 passing/1 failing), so the guard's original catch is intact.
- **A stale doc comment**: `src-tauri/src/lib.rs`'s top-of-file comment still said "S5
  … is re-scoped pending an owner decision" and "the desktop build still links it even
  though nothing calls it yet" — both false once `encoder_ipc.rs` started calling
  `encoder::contract`. Corrected to describe the actual, current split (crate holds no
  Tauri commands by design; the app crate's `encoder_ipc` module is what calls into it).

After these three fixes: `cargo test -p setnayan-desktop` 13/13 passing (5 of them
`encoder_ipc`'s own); `cargo test -p setnayan-encoder` 42/42 passing (untouched);
`pnpm --filter @setnayan/web test:unit` 13329 passing, 0 failing, 3 skipped (pre-existing
skips, unrelated); `pnpm lint` clean (only pre-existing warnings in unrelated files);
the two required Ugat db-tests (`ugat-schema-claims.db.test.ts`,
`ugat-concept-coverage.db.test.ts`) both green, 6/6 — the new `live_studio_encoder_tokens`
table did not require a graph/baseline update (it extends an already-mapped subsystem,
not a new one).

Mutation counts (before → after), the ones not already listed above:
- Rust `require_authorized` sabotaged to always `Ok(())`: 13/0 → 12 passing/1 failing.
- Rust `decode_and_check_kind` sabotaged to skip `from_base64` entirely (raw bytes
  passed through): 13/0 → 11 passing/2 failing.
- TS backpressure ring's eviction loop disabled (`while (false)`): 9/0 → 3 passing/6
  failing.
- TS backpressure ring's `droppedNonKeyframe` counter commented out: 9/0 → 6 passing/3
  failing.
- CSP `ipc: http://ipc.localhost` line stripped from `next.config.ts`: 3/0 → 1
  passing/2 failing.

### Merge against 50 commits that landed on `main` while this branch was open

`origin/main` moved 50 commits ahead (S3, S7, S10, R2-secrets-tracker, and others,
including S9's `live-studio-ingest-health.ts` change) before this PR's checks finished,
producing three real conflicts — resolved by understanding both sides, not by picking one:

- `lib/live-studio-ingest-health.ts` / `.test.ts`: S9 (build-sessions/encoder/S9.md,
  already merged — its own docblock names this PR, #5239, by number) restructured
  `decideIngestHealth` around encoder-health precedence (`reconnecting`/`encoder_down`
  states, YouTube-always-wins-on-no_data, local-preempts-fine-YouTube, bitrate as a
  sub-state). Merged so S9's precedence logic and this PR's additive, state-never-changing
  `transportNote` annotation coexist: `decideFromEncoderOnly`'s return type narrowed to
  `Omit<IngestHealthDecision, 'transportNote'>` since every call site now adds it via
  spread. Both test suites kept intact and concatenated, not interleaved.
- `tests/db/user-fk-behaviour.generated.txt`: regenerated against the merged migrations
  (`UPDATE_FK_BEHAVIOUR=1 pnpm test:db`) rather than hand-resolved — it is a live DB-replay
  artifact, not authored text. Final: 238 FKs, CASCADE=65/RESTRICT=3/SET NULL=170.
- `tests/db/comp-grant-survives-its-granter.db.test.ts`: the merged tree's actor-stamp
  guard (added since this branch started) correctly flagged
  `live_studio_encoder_tokens.requested_by` as a new CASCADE actor stamp. Added it to the
  "almost certainly correct" section (not the "genuine candidates for review" one) with
  the actor-vs-subject argument the test requires in its own docblock: the row is a
  single-use, 60s-TTL, service-role-only nonce (RLS, no policy at all) with no third party
  who could ever rely on it — the same shape as the already-pinned `oauth_state` rows, not
  the shape the guard exists to catch.
- `lib/ugat/graph.ts`: added `live_studio_encoder_tokens` to joint J39 alongside S8's
  `live_studio_encoder_claims`, same reasoning S8's own comment there already gives.

Verified on the fully merged tree: `TSC_EXIT=0 ERROR_LINES=0`; root `pnpm lint` clean;
`apps/web/tests/db/*.db.test.ts` 2346/2346 passing (was 2345/2346 — the one failure was
the actor-stamp guard above, fixed with an argument, not silenced); both required Ugat
db-tests 6/6 passing.

### What is still open (owner questions / left undone)

- `encoder_probe`'s ACL entry (`allow-encoder-probe`) was added to
  `capabilities/default.json` even though S5.md's original ACL wording named only
  `allow-encoder-{start,config,push,stop}` — `encoder_probe` is new (it did not exist in
  that prompt) and the go-live guard cannot call it at all without a capability grant.
  Flagging for owner awareness rather than silently deciding it needs no review: it is a
  read-only diagnostic (decodes a throwaway "PROBE" chunk, returns a short status
  string, touches no state), so it was granted the same way the other four commands are.
- The RTMPS/FLV stub sink in `encoder_start` is intentionally a byte/chunk counter only
  — S6 owns the real writer (`encoder::tagger`/`encoder::sender`) and replaces it at one
  call site.
- Live evidence ("Rust logs `Raw` for 100% of chunks over 10 min on macOS AND Windows")
  was not gathered this session — it requires a running Tauri webview against a real
  `setnayan.com` session, which this environment cannot drive. What IS verified: the app
  crate compiles and all of its and `crates/encoder`'s tests pass; the base64 path is
  the one this task's own owner decision already settled on for both platforms, so a
  live `Raw` measurement would not change which code path ships.
