## 2026-11-02 · feat(schedule): a moment can be "right after the one above", with no time

The first of the owner's four schedule additions (DECISION_LOG 2026-11-02 "SCHEDULE FITS THE COORDINATOR'S TIMELINE
AS WRITTEN: 4 ADDITIONS" (1)). A real coordinator's timeline writes "Bouquet toss" with no clock under "Cake cutting";
until now the database refused a moment without a time (`time_tba` was chapter-only).

- **Extends `time_tba`, does not rebuild it.** Migration `20271302727358`: a MOMENT may be `time_tba` too (still no end,
  still never shown to guests), and `follows_block_id` names the moment of the same chapter it comes right after. Its
  `start_at` is that moment's start — an order key, never a guessed time and never a midnight. A trigger moves it (and
  a whole chain) whenever the moment above moves; a chapter move shifts everything once; deleting the moment above
  keeps the follower, unanchored. Every reader that already asks `time_tba` (the `a-tba-chapter-is-never-midnight`
  scan) fences it out or names it — never draws the key as a clock.
- **Run of show** (a chapter's page): in run order (`inRunOrder`), the clock column says "Right after".
- **Moment sheets**: one When ▾ dropdown — At a time · Right after the one above. Picking "At a time" saves nothing
  until a time is typed; a typed time clears "right after" in the same save.
- **"Your schedule"** (the guest's own moments) and the **supplier's Schedule view** say "Right after", in order; the
  supplier's edit form never prefills the key as a time. The host's "View as" says it too.
- Approving a supplier's new time on such a moment ends "right after" (`schedule-suggestion-decide.server.ts`).
- One helper, `lib/moment-order.ts` (words + order), one server door, `lib/moment-follow.server.ts` (which moment is
  "the one above").
- Tests: `tests/db/a-moment-can-be-right-after.db.test.ts` (5) · `app/dashboard/[eventId]/schedule/a-moment-can-be-right-after.test.ts` (7).
  `a-chapter-time-can-be-tba.db.test.ts` loses its "a TBA moment is refused" half — the owner reversed it.

⚠ For the controller: #7198 (CHANGE LOCK) lists the part fields by name; whichever merges second should add
`follows_block_id` to `PART_FIELDS` and the lock trigger's tuple. A host move of an anchor whose follower is a LOCKED
supplier's moment would be refused by #7198's trigger (the follower moves with it) — correct by the lock's rule.

SPEC IMPACT: None (implements the 2026-11-02 ruling; no decision changed).
