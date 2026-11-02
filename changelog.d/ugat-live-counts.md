## 2026-07-30 · feat(ugat): make "Counts are live" actually true

The Ugat console's status line has always read **"Counts are live (updated …)"**. They were not. They were a server snapshot frozen at page load, so an admin tab left open overnight showed an hours-old figure under a label promising the opposite — a small dishonesty on the one surface whose entire job is telling the truth.

**`fetchUgatCounts()`** — a server action behind `requireAdminAction()`, delegating to the same `unstable_cache`-wrapped read the page already uses. Read-only, no new query, no new load path.

**A visibility-gated 75-second poll** in the console. Three deliberate choices:

**75s is slower than the 60s cache window on purpose.** Polling faster wouldn't produce fresher numbers — it would re-serve the same cached value more often. At 75s a poll usually lands on a freshly-revalidated entry instead of racing one.

**A backgrounded tab does nothing.** The interval stops on `visibilitychange` and restarts on return, with an immediate catch-up refresh so coming back to the tab doesn't mean waiting 75 seconds to see current numbers. Without this, a map parked in a background tab for a working day would fire a request every 75s forever, for numbers nobody is reading.

**A failed refresh keeps the last good numbers.** No spinner, no error state, no zeroes. The status line's relative timestamp simply ages visibly, which is the honest signal — a number that stops advancing tells you more than a number that vanishes.

Scope note: the original plan bundled this with the motion and focus-mode work, which was dropped as premature polish on a map describing three events. The poll is independent of both, so it was extracted rather than dragged along behind dependencies nobody wanted.

SPEC IMPACT: None — read-only admin surface behind existing gates. No schema, no RLS, no flag, no pricing.
