## 2026-09-10 · feat(encoder): the go-live guard — probe once, refuse only a broken transport

`src-tauri/src/encoder_ipc.rs` has cited `apps/web/lib/encoder/go-live-guard.ts`
since S5 as the caller of `encoder_probe` before `encoder_start`. The file never
existed, so the transport was never probed before a broadcast began. It now
exists at exactly that path, and `DesktopEncoderHost` calls it once, before
`encoder_start`.

**The refusal rule was already decided — S18 was wrong to file it as an open
owner question.** Three documents agree: `ipc-envelope.ts`'s docblock,
`live-studio-ingest-health.ts`, and `S5.md` trap 3. Refuse only when the probe
does not round-trip or Rust cannot decode it. Never on the envelope: S0 measured
Raw arriving 0 times in 1797 on WebKit, so "anything but Raw refuses" — S5's
original wording — would refuse every macOS user.

**And no latency refusal, because the data does not support one.** S5 allowed a
refusal "above a threshold you set from (1) and justify". From `S0-FINDING.md`,
same machine and origin:

| run | completed | mean | p95 | max |
|---|---|---|---|---|
| healthy | 1797/1797 | 50.7 ms | 151 ms | 501 ms |
| CSP enforced | 300/300 | 155 ms | 304 ms | 420 ms |

The degraded mean sits inside the healthy p95, and the healthy max is worse than
the degraded max. No threshold separates them, and both runs delivered every
chunk. A slow probe is therefore a sentence on the strip — S5's "a warning,
never a silent pass" — and never a gate. `PROBE_SLOW_MS = 500` is the healthy
max, so ordinary traffic never trips the note.

The envelope reaches `decideIngestHealth` as provenance only; that decider
already refuses to let it change a state. 18 new tests; 7 mutations, each proved
to turn the suite red — including S5's original "refuse anything but Raw" rule,
and a snapshot-stability break that would hang the controller in a
`useSyncExternalStore` render loop.

SPEC IMPACT: None — implements S5 trap 3 as written. X0 item 8 closed.
