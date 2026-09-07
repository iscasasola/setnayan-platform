## 2026-09-07 · docs(build-sessions): store-shell + four-platform launch closeout

`build-sessions/STORE-SHELL-CLOSEOUT-2026-09-07.md` — the session record for the App Store
rejection work (#5186, #5276), the four-platform audit, and what remains.

Documentation only; no code, no schema, no behaviour.

Written to be re-measured rather than believed: every status line carries the command or query
that re-checks it, and the file says so about itself. This repo's `CLAUDE.md` records its own
"what is left" section pointing at two finished jobs for an unknown stretch of sessions — a
handoff decays fastest exactly where it is read most.

What it carries that would otherwise be lost when this conversation ends:

- The pool-channel token deadline and, more durably, **why `connection_health: ok` cannot be
  trusted** on it (`last_refreshed_at == granted_at` is the tell).
- **The Android answer, so it stops being re-asked.** A personal Play Console account exists and
  is the wrong one; a personal account faces two gates (12-tester test AND device verification on
  an Android phone the owner does not own); an org account waives both; the D-U-N-S requested
  2026-06-25 is now day 74 with no reply. Two sessions asked the owner a question the corpus had
  already answered in `Google_Play_Org_Launch_Runbook_2026-06-25.md`.
- That **Apple Individual enrolment is not a reopenable choice** — Apple's org enrolment does not
  accept sole proprietorships at all.
- **The encoder's missing rung**: S0–S12 merged and green, `encoder_ipc.rs` still carrying its
  `STUB SINK`, and no row in the ladder owning the integration. S5 expected S6 to do it; S6
  merged first.
- The residual 3.1.3(b) exposure left deliberately open, with the one-line-per-page lever.
- Five traps this session paid for, including a pipeline `exit 0` that was `head`'s and not the
  test suite's.

SPEC IMPACT: None — records decisions already logged (DECISION_LOG 2026-06-25 and 2026-09-05);
adds no new ones.
