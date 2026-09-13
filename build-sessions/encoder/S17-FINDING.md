# S17 — FINDING: 60 minutes measured, but hidden, not visible; Windows deferred by owner choice

**Session:** S17 (`build-sessions/encoder/S17.md`) · **Measured against** `origin/main @ f0c38e932` (fetched 2026-09-09) · **Branch** `claude/s17-thermal-memory-windows`
**Machine:** this Mac only — macOS 26.6.2 (25G83), arm64, Apple M1 Pro (10-core, 8P+2E), 16 GB — same machine S0 used. **Not fanless** (has an active fan), so it is not the worst-case thermal machine the task is most worried about; it is still the only Apple-silicon macOS data point available.

This is a finding, not a feature and not the full closeout of S17's four gaps. It closes one gap
(macOS OS matrix — already closed by S0, just cited here), makes real but incomplete progress on
a second (60-minute sustained run — got 60 minutes, but of the wrong visibility state), and
leaves two open by explicit owner instruction, not by omission: the visible-state run, and the
whole Windows leg (owner has a Windows laptop and will run that leg personally later).

---

## 0. Headline

| Gap (from S17.md) | Status | Where |
|---|---|---|
| 60-minute thermal encode | **Ran the full 60 minutes, but the page never reached WindowServer "visible" state** — 358/359 ten-second windows report `visibility:"hidden"`. This is new data (a full hour hidden, no suspension — S0 only got 8 minutes hidden before WebKit suspended the page), but it does **not** answer the visible-state question the gap asks for. | § 1 |
| WebContent memory 439→910 MB, unattributed | **Still unattributed.** The RSS samples from this run are unreliable for the same harness reason S0 already documented (§ 2) — not re-measured cleanly here either. | § 2 |
| The OS matrix | **Already closed by S0** (`S0-FINDING.md` § 2.1) for this exact machine/OS/WebKit build. Not re-run — nothing has changed on this machine since 2026-09-05. | § 3 |
| Windows IPC + encode | **Deferred by owner instruction (2026-09-09), not attempted.** Owner has a Windows laptop and will run this leg personally; see § 4 for the exact next step so nothing has to be re-discovered. | § 4 |

---

## 1. The 60-minute run — hidden the whole time, and why

Command: `SETNAYAN_PROBE_TOP=1 src-tauri/probe/run.sh encode 60 src-tauri/probe/s17-encode.log`, launched
2026-09-09T03:22:06 → 04:22:52 (60.8 min wall clock), from a poll-and-launch wrapper that held off
starting until the machine's 1-minute load average was ≤ 5 (this Mac runs 12+ concurrent Claude
Code sessions; load bounced 4–20 for the hour before the launch — `load-at-start: 4.99 6.49 7.98`
in the run's own log line). Full raw log: `S17-logs/s17-encode-hidden-60min.log`.

**Why hidden, not visible.** `SETNAYAN_PROBE_TOP=1` pins the window always-on-top, which is what
S0's genuinely-visible regime relied on — but S0's visible period happened while the owner was
physically at the machine (the unified-log evidence in `S0-FINDING.md` § 4.1 shows a `PowerChime`
power-adapter-attach event mid-run — someone was there). This session ran unattended, with no
physical presence at the console and 11 other Claude Code sessions active on the same Mac at
launch time. I could not confirm from this shell whether the display was locked, asleep, or simply
never composited this window to the front (`ioreg`/`pmset -g powerstate` calls returned nothing
usable from this execution context) — but whatever the mechanism, the practical fact is
reproducible and total: **an unattended launch on this machine does not produce a visible window**,
regardless of the always-on-top pin. Getting the true visible-state measurement needs a human
physically at the keyboard for the hour, the same way S0 got its 170 seconds of visible data.
**Owner instruction (2026-09-09): defer that run, do not attempt to force it. Exact resume:**

```
uptime   # require 1-min load ≤ 5 AND nobody else on the machine
cd ~/Documents/Claude/Projects/setnayan-platform   # or a fresh worktree off origin/main
SETNAYAN_PROBE_TOP=1 src-tauri/probe/run.sh encode 60 src-tauri/probe/s17-visible.log
# then: physically keep the pinned window in front and the lid open for the full hour —
# do not ⌘H, minimise, or let another window/Space cover it (rule per S17.md § "how to measure").
```

**What the hidden hour *does* show — every 60th second (window = last 10 s, totals = since t0), full table of all 359 windows in the raw log:**

| min | fps | kbps | late | skipped | encodeQueueSize | maxQueueEver | errors |
|---|---|---|---|---|---|---|---|
| 0.17 | 30.08 | 2357 | 0 | 0 | 0 | 0 | 0 |
| 5.17 | 29.98 | 2340 | 0 | 0 | 0 | 0 | 0 |
| 10.17 | 30.01 | 2352 | 0 | 0 | 0 | 0 | 0 |
| 15.17 | 30.01 | 2351 | 0 | 0 | 0 | 0 | 0 |
| 20.17 | 30.04 | 2371 | 0 | 0 | 0 | 0 | 0 |
| 21.17 | 26.99 | 2231 | 18 | 30 | 0 | 0 | 0 |
| 24.17 | **14.92** | 1491 | 13 | 82 | 0 | 0 | 0 |
| 27.17 | 30.01 | 2350 | 0 | 0 | 0 | 0 | 0 |
| 35.17 | 29.99 | 2340 | 0 | 1 | 0 | 0 | 0 |
| 39.17 | 24.43 | 2059 | 19 | 56 | 0 | 0 | 0 |
| 45.17 | 30.01 | 2353 | 0 | 0 | 0 | 0 | 0 |
| 50.17 | **12.01** | 1343 | 40 | 177 | 0 | 0 | 0 |
| 55.17 | 19.65 | 1798 | 37 | 104 | 0 | 0 | 0 |
| 56.17 | **17.14** | 1599 | 39 | 130 | 0 | 0 | 0 |
| 59.83 (last) | 25.04 | 2128 | 20 | 52 | 0 | 0 | 0 |

Across all 359 windows: `encodeQueueSize` **0 at every single report**, `maxQueueEver` **0**,
`backpressureDrops` **0**, hard `errors` **0**. Two windows show a `fps:200.00, kbps:0.0` anomaly
(minutes 42.21 and 52.17) — the harness's own catch-up tick when the 10-s sampler falls behind
under throttling, not a real 200 fps encode; visible in the raw log, not cleaned up here.

**The pattern that's new versus S0:** S0's single 8-minute hidden sample held a flat ~16–17 fps and
then got suspended. This hour never got suspended (`SETNAYAN_PROBE_TOP=1` staying pinned may be why
— untested, flagged not decided), and instead of a flat throttle it **oscillates**: 20 minutes at a
clean 30 fps, then episodic drops as low as 12 fps clustered in two windows (minutes ~21–26 and
~38–59), with full recovery to 30 fps in between. The frame *supply* degrades (more `late`/`skipped`
counts); the encoder itself never falls behind its input (`encodeQueueSize` pinned at 0 throughout).
This is consistent with S0's conclusion that the bottleneck is upstream of `VideoEncoder` — but S0
never had enough hidden-regime duration to see the oscillation; this hour does.

**Thermal.** `pmset -g therm` at every 10-s sample across the hour: **"No thermal warning level has
been recorded" — nominal for all 60 minutes**, exactly like S0. This says nothing about the visible
case (running under background CPU throttling is a different power profile from a full-power
visible encode), so it does not answer S17's actual thermal question either.

## 2. WebContent memory — still not attributable

I pulled WebContent RSS at ~6-minute intervals across the hour and it swings non-monotonically
(267 MB → 720 MB → 692 MB → 284 MB → 171 MB → 756 MB → **1106 MB** → 209 MB → 456 MB → 40 MB → 91
MB → 134 MB) — not a value to trust: `S0-FINDING.md` § 4.1 already documented that `run.sh`'s
sampler is `ps -axo pid,%cpu,rss,comm | sort -k2 -nr | head -6`, sorted by CPU%, so a target process
sitting at 0.0% CPU can lose the tie-sort to other zero-CPU WebKit processes and simply not appear
in a given sample — which reads as the number vanishing or dropping, and is a harness artifact, not
a real free. That defect was explicitly left unfixed in S0 ("not fixed here (harness left as is)")
and is unfixed here too. **The 439→910 MB attribution question from S0 remains open**; answering it
needs either a `sort`-stable sampler keyed on PID (a small `run.sh` fix, not attempted in this
session — out of scope for a measurement-only session) or `leaks`/Instruments attached to the
WebContent process during a run.

## 3. The OS matrix — already closed, cited not re-run

`S0-FINDING.md` § 2.1 measured this exact machine, this exact macOS build, in full: `VideoEncoder`
/ `AudioEncoder` / `VideoFrame` / `AudioData` all `function`; 720p and 1080p `avc1.42E01F`
`prefer-hardware` supported; AAC-LC 48 kHz stereo supported; `hardwareAcceleration:'require-hardware'`
throws `TypeError` (WebKit rejects the enum value, expected — § 8a). Nothing on this machine has
changed since 2026-09-05 (`sw_vers`/`sysctl -n machdep.cpu.brand_string` identical), so re-running
`probe/run.sh matrix` here would reproduce the same numbers at the cost of contending with the 11
other sessions on the machine for nothing new. **RULE 0: it already exists — cited, not rebuilt.**
No second macOS version (14/15) or macOS 13/Intel "expected-fail" leg was available in this session
either — **left undone**, same as S0 left it. The floor (macOS 14+, Safari 26) stays **assumed**
for every macOS version except 26.6.2 arm64.

## 4. Windows — deferred by owner instruction, not blocked

**Not attempted.** No Windows machine is reachable from this session's environment. The owner has a
physical Windows laptop and, per an explicit 2026-09-09 instruction, wants everything else finished
first and will run the Windows leg personally later — this is a scheduling choice, not a technical
blocker, and should not be re-litigated by a future session without checking with the owner first.

**What Windows needs that doesn't exist yet, so the next session doesn't have to rediscover it:**
`src-tauri/probe/run.sh` is bash and macOS-only by its own header comment (`pmset`, `ps -axo …comm`
with BSD flags). The probe payload itself — `src-tauri/probe/encoder-probe.js` (page-side JS) and
`src-tauri/src/probe.rs` (the Rust `probe_report`/`probe_ipc` commands) — is already cross-platform
and needs **no changes** for Windows; only the *runner* needs a Windows equivalent:

- Build: `cargo tauri build --debug --no-bundle` (same command, different target).
- Launch: same `SETNAYAN_PROBE=<mode>` env var convention.
- Sampling: PowerShell `Get-Process` (or `Get-Counter`) in place of `ps -axo`, for
  `setnayan-desktop.exe` and the WebView2 (`msedgewebview2.exe`) processes — WebView2 is Chromium,
  so there is no `WebKit.WebContent`/`WebKit.GPU` split to sample; a single or few
  `msedgewebview2.exe` processes stand in for both.
- Thermal: Windows has no `pmset` equivalent; `Get-CimInstance -Namespace root/wmi
  -ClassName MSAcpi_ThermalZoneTemperature` is the closest built-in, gated by whether the specific
  laptop's firmware exposes it (many don't) — report "unavailable on this machine" rather than
  fabricating a number if it doesn't.
- This is additive work — a new `probe/run.ps1` beside the existing `run.sh` — not a rewrite of
  anything shipped. It does not "double" the programme; it's the one new small script plus one
  measurement run, whenever the owner is at the Windows laptop.

**The IPC question flagged in S17.md is still genuinely open**: WebView2 (Chromium) may treat
loopback origin trust differently from WKWebView (§ "why it matters" in S17.md) — nothing in this
session's macOS-only measurements can speak to that either way.

---

## 5. GUARDS — self-check against this report

S17.md's own guards ("a probe run that produced no samples reported as a pass → red · a frame-rate
table with a missing machine reported as a complete matrix → red · the `/download` floor copy
claiming a version this session did not test → red") are checks on the *claims this report makes*,
not new code assertions — this session changed no application code, only added evidence + docs, so
there is nothing to mutation-test in the rule-7 sense. Self-check:

- Probe run produced 359 real samples (not zero) — verified: `grep -c 'encode-10s'
  S17-logs/s17-encode-hidden-60min.log` → 359. Not reported as a pass on empty output.
- The frame-rate table above is explicitly **one machine, hidden-visibility only** — never
  described as "the matrix" or "the visible case." § 1 says outright it does not answer the gap.
- `apps/web/app/download/page.tsx:284-285` was checked and is untouched by this session; it states
  the floor as a requirement ("macOS 14 or later, with the Safari 26 update" / "Windows 10/11 with
  hardware video encoding"), not as a claim that every version in that range was tested — no fix
  needed, and this session made no edit there.

---

## 6. What this does and does not buy

**Does:** one new hour of continuous hidden-state data (no suspension, oscillating throttling
pattern, encoder never backpressures) that the programme didn't have before; a documented, exact
resume path for both the visible run and the Windows leg so neither has to be re-discovered.

**Does not:** answer whether a six-hour wedding degrades under full visible-state thermal load —
the actual question S17 exists to answer. That is still open, by design, pending the owner's own
hands-on time at this Mac (for the visible run) and at the Windows laptop (for that whole leg).
