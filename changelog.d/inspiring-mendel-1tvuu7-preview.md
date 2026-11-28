## 2026-11-28 · feat(seating): the auto-arrange preview, and Accept in one transaction (seat plan D) 🟠 migration

Plan: specs `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.6 (preview D) and § 6 (Accept). It is stacked on the smart-layer PR (S). It is engine only; the `RiseScreen` preview and its 🔒 rows are the UI lane's.

- **The preview** is `autoArrange` with `intent=preview`, folded into the action because server actions are at the cap. It writes nothing: no table added, no table moved, no seat; a source assert holds that. `lib/seat-plan-preview.ts` › `buildArrangePreview` returns:
  - the counts for "X of Y seated · N rules broken · N wishes not met · N guests get a seat" (`previewSummaryWords`);
  - the Not met list: the seater's "didn't fit" plus any keep-apart rule it could not hold;
  - the tables that change: per table, who joins and who leaves, with a one-line reason from the seater's terms (the same `suggestionReason` the cards use);
  - **🔒 locks:** `keep` holds the tables the host locked in the preview. They are kept exactly as they are (nobody added, nobody cleared) and the preview re-runs;
  - **named repairs** when nothing fits: "Not enough seats: 212 coming, 200 chairs. Add 2 tables", or "Kuya Ronnie's party needs 3 seats together; the biggest gap is 2. Add 1 seat to Santos family". Words come from `repairWords`, using the shown table name;
  - the exact plan Accept writes, with `base`, the fingerprint of the seats it started from. The plan passes the independent check first; one that fails it is never shown.
- **Accept** is `intent=accept`. It calls the new RPC `apply_seat_plan`, which runs in **one transaction**:
  - it refuses a stale preview (`seatPlanBase` and the SQL hash agree byte for byte, held by a db test);
  - it clears only unlocked seats at unlocked tables;
  - it adds the plan's new tables and lays the tables out;
  - it seats each row, re-checking every hard rule: the table is not locked, Spare or the Sweetheart; the chair is real; the guest is not declined or removed; no table ends over its chairs.
  - Any refusal writes nothing.
  - It returns what the shipped Undo (`intent=undo`) needs, so there is **one Undo**.
- **Migration** `20271366023002_apply_seat_plan.sql`:
  - one SECURITY INVOKER function, so the couple's RLS authorises every write;
  - a per-event advisory lock;
  - EXECUTE for `authenticated` only.
- **The screens' three calls** (the controller's contract of 28 Nov, so L10's screens and this engine meet). They live in `app/dashboard/[eventId]/seating/seat-plan-calls.ts`: plain helpers over the one `autoArrange` action, not new server actions. The shapes are in `lib/seat-plan-api.ts`.
  - `dryRun(eventId)` → `{ suggestions: [{ tableId, guestIds, reason, planId }], problems: [{ kind, guestIds, tableId, reason, fix }], line, fixAllPlanId }`, or `{ ok: false, line }` when a read or the run fails. It comes from the new `intent=dry-run`, which writes nothing.
  - `previewArrange(eventId, { scope: 'unseated' | 'everyone', lockedTableIds })` → `{ planId, seated, total, rulesBroken, wishesNotMet, getSeat, notMet: [string], changes: [{ tableId, add, guestIds, reason }] }`, or `{ cannotFit: { rule, repair } }`. The changes use the shown table name.
  - `acceptArrange(eventId, planId)` → one transaction (`apply_seat_plan`), one Undo.
  - **A planId is the plan itself, encoded.** Taking a suggestion, a fix, Fix all or the whole preview all write through the same Accept. Because Accept re-checks every rule and refuses a stale plan, an old or edited planId can never write more than the host could by hand.
- **The seating page passes the dry run to the editor** (`dryRun` prop) from its one batched read, with no new read, client fetch or server action. A failed run is `{ status: 'failed', line }`. The problem kinds use the screens' names: `household_split · plus_one_apart · elders_near_speaker · table_over · rsvp_alone`.
- **Guard narrowed:** `a-seat-says-who-placed-it` now flags a second migration that *defines* `placed_by`. A function that only writes `'auto'` into it is a writer, not a second home.
- **Tests:** `lib/seat-plan-api.test.ts` (6), `lib/seat-plan-preview.test.ts` (9) and `tests/db/an-accepted-preview-is-one-transaction.db.test.ts` (6).
- **Not verified:** RLS on a real signed-in session, because the PGlite replay runs as superuser.

SPEC IMPACT: None (builds § 4.6 and the § 6 Accept RPC as planned).
