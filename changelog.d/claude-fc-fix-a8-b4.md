## 2026-11-25 · fix(admin): final check area 8, batch 4: Work, Focus, Catalogue and Verify read honestly

Final check, area 8 fixer, batch 4 (lane A only; no amounts, plans or rules change):

- **A8·C-1**: Focus's "Ask" answer counts the queue's own number (not the 3-row peek) and says "Couldn't read" for an
  unread queue instead of "0 · answered here".
- **A8·C-6**: Work's lane chips never add the watch-only trails into "All N".
- **A8·C-7**: the Work landing's "across every queue" is the same total the Work list and Focus show (every queue in
  `BASE_ROWS`, watch-only trails left out); card sums skip watch-only trails (`countToSum`), chips keep their counts.
- **A8·C-8**: "From suppliers": a kind whose read failed reads "—", and "All" says it is partial.
- **A8·C-9**: the "It is this event type" picker says it couldn't read the event types instead of opening empty.
- **A8·C-10**: a Documents row says when the automatic checks could not run, before Approve.
- **A8·B-14**: Categories counts read "—" on a failed read; the words and requests lists say they failed.
- **A8·B-15**: service requests say "Couldn't read the shop / category" and "Couldn't count the cards" instead of
  stating guesses ("a shop", "A retired category", "No cards to move") as facts.
- **A8·E-10**: Verify's visibility, auto and demoted tabs show only the "couldn't load" line on a failed read.
- **A8·F-20**: a refused editorial read says "Couldn't read this editorial", not a 404.
- **A8·D-15**: when the owner check fails, the row says so and is locked, never an ordinary editable admin row.

Skipped: **A8·H-14** (`/admin/ugat?tab=brain`): listed for retirement in the area 8 second pass (Add 17), so not fixed.

Guard: `app/admin/batch-4-honest-reads-hold.test.ts` (mutation-checked) + a `cardsMoveLine(null)` behaviour check.

SPEC IMPACT: None.
