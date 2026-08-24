## 2026-08-24 · fix(vendors): a supplier's published numbers keep the record the slices preserved

Slices 1–6 made a supplier's review, booking, contract, payment, quote and
amendment survive a couple deleting their celebration. Measured in production
2026-08-24 in a rolled-back transaction, **every published number still went to
zero**:

| | before → after a delete |
|---|---|
| review row | 1 → 1 ✅ |
| booking row | survives ✅ |
| dated Track Record list | 1 → 1 ✅ |
| `trusted_review_count` (THE public star rating) | **1 → 0** 🚨 |
| `public_completed_count` (experience tier badge) | **1 → 0** 🚨 |
| `full_completed_count` | **1 → 0** 🚨 |

All three matviews carry `EXISTS (… FROM events …)`; once the column is NULL that
predicate is false, so the preserved row is filtered out of the very number it
was preserved for. The product was internally contradictory — the dated list
showed the job while the count above it said the supplier had never worked.

Relaxing the predicate alone would have **laundered** self-dealt work into a
public number forever, because the self-dealing guards read the cascading
`event_members`/`comp_grants`. Reviews now get the shape slice 2 already used
for bookings: a self-dealt review is destroyed at deletion time (exactly what
the cascade does to it today), so "orphan ⇒ arm's-length" holds by construction
and no stamp column is needed.

🚨 Also caught by its own test: prod carries `ALTER DEFAULT PRIVILEGES … GRANT
**ALL** ON TABLES TO anon, authenticated`, so a bare `DROP`+`CREATE` would have
given `anon` INSERT/UPDATE/DELETE/TRUNCATE on all three matviews and published
the supplier-only count. Every rebuild now REVOKEs before granting.

Migration `20271164950523`. 4 db tests; 3 mutations, each measured by occurrence
count (3→0, 1→0, 1→0), each turning exactly one test red.

SPEC IMPACT: None.
