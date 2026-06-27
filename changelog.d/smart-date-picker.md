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
