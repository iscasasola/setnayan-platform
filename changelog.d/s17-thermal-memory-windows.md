## 2026-09-09 · docs(encoder): S17 — 60-minute hidden-regime run measured; visible run + Windows deferred

Ran the encoder probe's 60-minute encode mode end to end on this Mac (M1 Pro, macOS 26.6.2). The
window never reached WindowServer "visible" state during the unattended run (11+ other Claude Code
sessions active on the same machine, no physical presence at the console), so this measures a full
hour of the *hidden/background-throttled* regime instead of the visible-load thermal case S17 asks
for — new data (no WebKit suspension this time, unlike S0's 8-minute hidden sample; an oscillating
throttle pattern with `encodeQueueSize` pinned at 0 throughout), but not the headline answer.

The OS matrix gap is already closed by S0 (`S0-FINDING.md` § 2.1, same machine) — cited, not
re-measured. WebContent memory attribution stays open (harness RSS sampler is unreliable, same
defect S0 already documented, not fixed here). The visible-state run and the entire Windows leg
are deferred by explicit owner instruction (2026-09-09): owner has a Windows laptop and will run
that leg personally later, after everything else lands — this is a scheduling choice, not a
technical block. Exact resume commands for both left gaps are in `S17-FINDING.md` §§ 1 and 4,
including what a Windows runner script needs (the probe payload itself is already cross-platform;
only `probe/run.sh`'s bash/`pmset`-based sampling needs a PowerShell equivalent).

Full report: `build-sessions/encoder/S17-FINDING.md`. Raw log:
`build-sessions/encoder/S17-logs/s17-encode-hidden-60min.log`.

SPEC IMPACT: None — this is a measurement/evidence session, no product or schema change.
