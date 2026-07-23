## 2026-07-23 · fix(widgets): reconcile the seed trigger to the canonical 16 types

`populate_default_invitation_widgets()` had drifted to 14 types: the
20270110320023 our_love_story migration rebuilt it from a stale 13-type list
AFTER the 20270110130000 reconcile had fixed it to 15 — dropping
`what_to_bring` + `our_photos` and squatting our_love_story on
what_to_bring's display_order 14. All 4 prod events held exactly 14 rows;
those two sections never appeared in the couple's widget editor.

Migration `20270919679722` (allocator-minted, idempotent): CREATE OR REPLACE
with the canonical 16-row seed (our_love_story → 16), a guarded 14→16
re-number of existing our_love_story rows, and a defensive full-16 backfill
via ON CONFLICT DO NOTHING. Order-independent with open-browse PR4's `mode`
column (seeded rows pick up its DEFAULT when it lands). New db test
`invitation-widget-seed.db.test.ts` (2/2 on full replay): new event seeds
16/16 at canonical orders with zero collisions; the backfill heals a
drifted event without touching healthy rows.

SPEC IMPACT: None (schema reconcile to the existing canonical list).
