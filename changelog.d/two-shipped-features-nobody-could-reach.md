## 2026-08-25 · fix(vendor): two shipped features get the doorway they never had

W6 item 1. Measured by scanning every `.ts`/`.tsx` under `app/` and `lib/` for
importers — not by reading the brief. **Neither feature was rebuilt.**

- **Peer comparison** — `lib/funnel-benchmark.ts` had **ZERO importers anywhere
  in the repo**. The SQL bands and their privacy contract are LIVE in production
  (`funnel_benchmark_for_vendor`, verified by the object), the min-N suppression
  and the percentile math all ship, and the module's own docblock names its
  caller as `vendor-stats-panel.tsx` — **a file that does not exist**. Sixth
  "gate with no handle". Now rendered by a new presentational card inside the
  existing Pro-and-up market-intel section of `/vendor-dashboard/performance`,
  beside the Demand Radar. It reads what the library already assembles: no second
  query, no second percentile, no second suppression rule, and a suppressed band
  renders the honest "not enough shops like yours yet" state rather than a
  fabricated ranking.
- **The supplier's day-preload card** — `vendor-event-day-prep-cta.tsx` had
  **ZERO mount sites**, while its couple-side twin `<EventDayPrepCta>` is mounted
  on the event home. Now mounted on the vendor's own message thread, the one
  screen already holding every prop it needs.
  ⚖ **Gated on `booked`.** The component's own docblock scopes it to a
  CONTRACTED relationship, and an asked-but-unanswered supplier must not be
  nudged to pull down a run-of-show they have not earned — the boundary PR-H
  draws. Nothing is widened: the action runs on the RLS-bound user client, so a
  supplier can only cache what they could already read. The card also self-gates
  to T-3 → T+1, so on most days it renders nothing.

⏭ **The third item on this list is CLOSED as stale, not built:** the lucky-date
card is richly reachable — `date-selection` is linked from the save-the-date
builder, the details page, the home nudge, find-date and paperwork (8 sites).

Guard `lib/these-features-have-a-doorway.test.ts` — the importer scan is derived
by walking `app/` + `lib/` and floored, and it strips comments so a docblock
MENTIONING a module never counts as reaching it (which is how the benchmark's
phantom caller read as real).
🪤 **Its first assertion was DECORATIVE and only the mutation run said so:**
it asked for an IMPORTER, and deleting the page's read left it GREEN at 1 → 0
because the new card imports the module for its types. An import is not a read —
it now asserts a CALLER of the fetch. 5 mutations, all measured, all red.

SPEC IMPACT: None — both features were already specced and built; only their
doorways are new.
