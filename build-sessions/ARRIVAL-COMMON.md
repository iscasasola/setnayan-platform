# Arrival slices — the block every session pastes first

Read the repo's `CLAUDE.md` and follow RULE 0: assume what you are about to build already
exists, and find it before writing anything. On this stream RULE 0 has paid repeatedly — the
day-of hub, the guest menu bar, the QR render and the monogram resolver all already ship.

0. MEASURE AGAINST `origin/main`. `git fetch` first, then `git grep <pattern> origin/main -- <path>`.
   Never read code from `~` (a stale checkout). Never cite a line number; cite a greppable symbol.

1. THE DESIGN IS ON A CANVAS: https://claude.ai/artifact/WhaPx4CKwbDTUqN1QCBedh
   Boards are phone-first: arrival · RSVP sheet · scrolled · pass · on the day · everything else.
   Build the DELTA against what ships. Do not redraw a working screen.

2. TWO CONSTRAINTS THAT LANDED 2026-09-20 AND BIND YOU:
   · The booking fee gates a SUPPLIER's per-event surfaces (app #5738, SQL #5770). Settled = paid
     OR waived_free5 OR waived_import. Both switches are OFF today. Guests and couples are NOT
     gated, so arrival work is unaffected — but ANY supplier-facing detail you add must read
     `lib/event-access-stage.ts`.
   · Venue screens require the PAID Live Studio unlock (owner-confirmed). The decision log's
     earlier "free" row is superseded. Do not re-open it.

3. 🕐 DATES. Use `manilaToday()` from `lib/std-views.ts`. `new Date('YYYY-MM-DD')` is midnight
   UTC — the PREVIOUS day in Manila — and flips a day-of branch eight hours early. Compare
   `YYYY-MM-DD` strings. Say in your handback WHICH timezone resolved any date you used.

4. WHAT "DONE" MEANS HERE:
   · one pure decision module + a test that EXECUTES it, never a comment that describes it;
   · at least two sabotages, each turning exactly one test red — say which;
   · SCOPED checks only: `npx tsc --noEmit -p .` from `apps/web` under
     `~/Documents/Claude/Projects/heavy-lock.sh` (ONE heavy job at a time — three concurrent runs
     shut this laptop down on 2026-09-13), plus your own test files. Do NOT run the full suite.
   · a `changelog.d/<branch>.md` fragment. Never edit CHANGELOG.md or STATUS.md.
   · push, `gh pr merge <n> --auto --merge`, report, EXIT. Do NOT watch CI.

5. ⚠ VERIFY AS A REAL GUEST WHERE YOU CAN. Two merges on 2026-09-20 shipped defects that only a
   real event caught: a timezone bug, and a dress code that existed but never rendered. Both
   passed their tests. If your slice can be opened with a guest link, say so in the handback and
   say what you could NOT verify.

6. ⛔ DO NOT add a second `fixed bottom-0` bar. `GuestHubBar` was retired for covering the menu
   whole (`z-40` over a `z-30` menu). Render in the flow.

7. ⏱ TWO OR THREE SESSIONS RUN AT ONCE, BUT ONE HEAVY JOB DOES. `heavy-lock.sh` serialises
   typechecks; you will QUEUE behind a peer and that is correct — do not bypass it, and do not
   start a second heavy job of your own while one is running. Three concurrent runs shut this
   laptop down on 2026-09-13.

8. MERGE ONE AT A TIME. Arm auto-merge and exit; do not watch CI. If your PR goes CONFLICTING,
   the slice that merged first was not wrong — rebase on the merged tree and redo your edit there.
