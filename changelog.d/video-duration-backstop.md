## 2026-07-03 · fix(uploads): 30s showcase-clip ffmpeg backstop + validator re-entry guard

Two hardening items from the showcase-media review, plus the guard promotion.

**① Duration backstop (closes the probe-fail bypass).** The 30s showcase cap
was enforced only by a `<video>`-metadata read that FAILS OPEN on codecs the
browser can't probe — an unprobeable over-length clip uploaded uncapped.
`compressVideoForWeb` gains `maxDurationS`: when set and the clip needs
trimming (unknown duration or over the cap), the small-file/low-bitrate skip
is bypassed (a content rule, not an optimisation), the encode carries
`-t <cap+1>` (ffmpeg demuxes containers regardless of decoder support, so it
trims even when the probe lied), and the trimmed output is kept even if it
didn't shrink. Never-throws / original-on-failure contract unchanged — a
browser that can't run ffmpeg.wasm at all remains the one narrow bypass.
Threaded as `FileUpload.maxVideoDurationS` → set on the showcase video field.

**② Re-entry guard (covers the WHOLE pre-inFlight window).** The critical
section before a file is registered in `inFlight` — validation (`validateFile`
/ `qrGuard`) AND video compression (multi-second ffmpeg.wasm) AND presign —
runs on a `handleFiles` closure that captured a stale `items+inFlight` count;
a second drop during it could race a duplicate upload (single-file: last XHR
wins, loser orphaned in R2). A `busyRef` set at batch entry and cleared in a
`finally` after the loop now blocks a new batch for that entire window (not
just the validator sub-window — the first cut left the longer compression
window open, flagged by the review). `uploadOne` is fire-and-forget on the
XHR, so it returns once the item is counted — exactly when the window ends, so
in-flight uploads don't over-block new picks. The block gives FEEDBACK ("Still
preparing your last file — give it a moment") rather than silently dropping the
second batch.

**③ CI guard promoted.** `lint nested forms` added to the branch-protection
required checks (12th context, non-strict unchanged) after passing on every
PR since it landed.

Verified: tsc (0) · next lint (0) · lint-nested-forms · prod build.

SPEC IMPACT: None (upload hardening + CI policy).
