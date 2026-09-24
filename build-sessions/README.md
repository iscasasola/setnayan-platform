# `build-sessions/` — the controller's working corpus, now under version control

> **Committed 2026-09-24.** Until this commit, **every file here except eleven existed only on one
> Mac's disk** — 204 files, including the 3,971-line register and every binding prototype the owner
> has approved. The only carrier was a zip on a Desktop. That is why this commit exists: the owner
> asked for documentation that survives an account change, and a document that lives in one folder
> on one machine is not documentation, it is a habit.

⚠ **A HANDOFF IS NOT EVIDENCE — including every file in this folder.** Each one was true when it
was written. Re-measure before acting on any line, with the commands the file itself gives.

---

## Read these, in this order

| file | what it is |
|---|---|
| **`CONTROLLER.md`** | **Start here.** Makes a fresh Claude Code account *be* the redesign controller: the role, the gate, how to talk to the owner, the discipline, the route ceiling, the Apple rejection. |
| `SEQUENCE-2026-09-23.md` | The owner-set ranking — Event Hub first, then most-done to least-done — and the measurements behind it. Its foot carries "What actually happened". |
| `REDESIGN-CONTROL.md` | The register. 3,971 lines, the largest single artifact here. |
| `BUILD-SEQUENCE.md` | The build order across streams. |
| `SESSION-ROSTER.md` | Who is working on what, by session name. Decays fastest of anything here — `ListAgents` is the truth. |
| `make-handoff-zip.sh` | Rebuilds the account-handoff bundle, with a LIVE board snapshot each run. |

## Standards and rulings the builds must follow

| file | |
|---|---|
| `DESIGN-LANGUAGE-AMENDMENT.md` | The 2026-09-23 brief — no cards/borders, four viewport states, `(i)` tooltips, "the number is the interface", depth, kinetic micro-interactions. **It supersedes** `design_handoff_setnayan_redesign/README.md`'s *"separate cards by border #E1DCD1"*. |
| `STANDARD-collection-card.md` | The collection-card standard (Planning · Alaga · Samahan · Shortlist) with the next-batch animation. **Open question: does it survive the no-cards brief?** |
| `SCHEDULE-event-menu-by-moment.md` | The event sidebar / bottom nav / ☰ rebuild. Owner-approved design, **scheduled, not started.** |

## `prototypes/` — binding, and more authoritative than any description of them

45 HTML files. **Open the prototype before settling what it shows.** A description of an artifact is
not the artifact; that mistake has cost this project real time more than once.

The owner's viewer **runs no JavaScript**, which is why several prototypes are built from radios and
`~` sibling selectors. 🔑 **That machinery is a prototype transport, not a design.** Nobody should
port it into shipped React.

## The families — what is live and what is scaffolding

| prefix | count | status |
|---|---|---|
| `CTRL-*` | 55 | **Scaffolding.** One brief per delegated session. Historical once its PR merged. |
| `BA1–BA8` | 8 | Scaffolding — the build-area sweep briefs. |
| `ARRIVAL-*` | 6 | Scaffolding — the arrival-sequence briefs. |
| `C1 … C11`, `P0-b-SWITCHES` | 12 | The original tracked eleven, plus siblings. Historical. |
| `AREA-*`, `MERGE-*`, `*-CONTROL.md` | — | Live registers. `MERGE-CONTROL.md` is a **generated snapshot** — re-run `merge-control.sh` rather than trusting it. |
| `harness/`, `encoder/`, `kit-page-redesign/`, `HANDOFF-2026-09-18/` | — | Test harnesses and one archived handoff. |

🛑 **A session brief is not a status.** `CTRL-S17.md` describes what a session was asked to do, never
what it did. For what shipped, read `git log origin/main`, never this folder.

---

## Why a document in here rots faster than code

Code has a compiler and a guard suite; a register has neither. Three rules, learned the expensive
way and repeated in most of these files:

1. **An anchor is a string, never a number.** Never write a line number or an occurrence count as if
   it were stable. Cite a greppable symbol, or the exact command that re-measures it.
2. **A register's status rots in BOTH directions** — it lists finished work as pending *and* pending
   work as finished. This repo's own `CLAUDE.md` pointed at two jobs that were already done and
   fenced, in the passage every session reads first.
3. **Decay scales with age.** Roughly two in three claims in a month-old register are wrong in some
   detail. Re-measure; do not transcribe. **A copied claim is an unmeasured claim.**
