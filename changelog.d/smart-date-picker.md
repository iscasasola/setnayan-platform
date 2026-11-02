## 2026-06-27 · feat(date-selection): smart candidate date picker

When a couple has `date_candidates` from onboarding but no wedding date locked yet,
the date-selection page now shows a ranked comparison of up to 3 candidates instead
of the generic 3-path chooser. Each card scores the date on 5 pro signals:
vendor shortlist availability · budget range · date perspective (season/day-of-week)
· marketplace service coverage · time-to-prepare status. Best match badge goes to
the candidate with most shortlist vendors free + most marketplace coverage.
Locking calls the existing `lockEventDate` action — no schema changes.
Falls back to the 3-path chooser when `date_candidates` is null/empty,
or when the user navigates to `?path=direct` / `?path=guided` explicitly.

SPEC IMPACT: None (additive UI change; no schema changes; no new server actions)

## 2026-06-27 · feat(date-selection): richer candidate comparison signals

Upgraded the candidate comparison so it is genuinely decision-ready: the
already-loaded `computeAuspiciousReasonsDetailed()` engine now feeds a dedicated
"Meaningful" row (personal resonance — anniversaries) plus cultural/numerology
"Why this date" reasons; a PH-holiday adjacency check adds a long-weekend
guest-travel signal; an "Our pick" banner + per-dimension winner pills (Most
vendors free · Most time to plan · Most meaningful · Most services) surface the
trade-off; and a "pin a must-have vendor" control re-ranks dates client-side.

SPEC IMPACT: None (additive UI; no schema changes)

## 2026-06-27 · feat(vendors): candidate dates shrink on lock + force-to-one date lock + milestones

Connects vendor locking to the candidate-date flow (`lib/candidate-dates.ts`,
`lib/lock-milestones.ts`):
- **Dates shrink with locked vendors.** The candidate picker narrows to the
  dates every already-locked vendor is free on; a note explains the narrowing,
  and a warning shows if a locked vendor conflicts with every candidate.
- **Force-to-one date lock.** When locking a vendor narrows the candidates to a
  single day, `finalizeVendor` returns a new `date_will_lock` result; the UI
  confirms ("Locking this will finally set your date to {date} — continue?") and,
  on confirm, finalizes both the vendor and the wedding date (mirrors
  `lockEventDate`'s writes; guarded against clobbering a concurrent date lock).
- **Milestone congrats.** Every lock now returns a `milestone` ("Congratulations!
  You have picked a {Reception venue}!") plus an optional "You can now finalize
  your {Save the Date}" CTA when the lock completes a feature's prerequisites
  (Save the Date = date + ceremony + reception venue; Seating = reception venue).

Wired through all three primary lock paths (accordion-lock, plan-card-lock,
plan-card-compare) via a shared `lock-milestone.tsx` (confirm modal + congrats
toast). Other lower-traffic lock callers (workspace, build-locked,
recommended-vendor-row, new-manual-vendor-modal) are safe but not yet wired —
the gate only fires for couples with candidate dates and no locked date, and an
unhandled `date_will_lock` is a no-op (no write happens), so no wrong behavior.

SPEC IMPACT: None (additive; reuses existing event_vendors + events columns)
