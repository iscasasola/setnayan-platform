## 2026-11-14 · fix(admin): Growth names event types and divides like for like (AW-8)

Admin walk AW-8, Insights › Sign-ups & growth:

- **Events by type** printed raw keys (`simple_event`, `debut`, `date`) from a hand-kept five-entry map. It now uses the admin-managed event-type names, read through the one shared reader every admin page uses (`readEventTypeNames`, F-A-15). A missing type reads "No type set".
- **Guest → account conversion** divided two different sets. The top number was every account-linked guest membership, including guests since removed. The bottom number was the non-removed guests only. The label says "converted ÷ all non-removed guests", so the top number now counts only those guests: an inner join on `guests` with the denominator's own `deleted_at IS NULL` filter. Same query count, still head counts. The figure reads "5 of 294 guests", not "5 / 294".
- **Guard:** `lib/admin/growth-reads-what-it-says.test.ts`. Both breaks were landed (1 → 0) and went red.

SPEC IMPACT: None.
