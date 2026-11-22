## 2026-11-21 · fix(journal): the zero-commission post no longer promises a free first booking

The owner's 20/21 Nov booking-fee ruling (#8061) removed the free first booking for a client Setnayan brings. The Journal post `what-zero-commission-means-for-couples`, which 20271355899662 already imported into `creator_chapters`, still said "a supplier’s first booking from Setnayan is on us".

- New forward migration `20271356969132`. It UPDATEs that one post only, scoped by `is_journal` and the slug. It runs under `lock_timeout` and is idempotent: it matches only while the clause is still there.
- The same edit is made in `lib/blog-batches/december-news.ts`.
- `lib/journal-edits-after-import.ts` lists post-import edits, so `journal-move.test.ts` test 6 still proves that the applied import file is what the source generated.
- New test 6b checks that the source carries each edit and that its migration replaces exactly that text for exactly that slug. Sabotage-checked both ways.

SPECS IMPACT: None. The ruling is already in DECISION_LOG on 2026-11-20 and 2026-11-21.
