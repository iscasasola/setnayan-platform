## 2026-10-26 · fix(guests): a removed +1 leaves no name — the bringer's one-name copy follows the +1 rows

Owner, cale-ice, guest Juanita Sacdalan: *"I deleted that guest and added a new plus 1. It is still there?"*
Prod (read-only): her +1 "Ggvv Vfh" was soft-deleted and a fresh "+1 · TBA" seat minted, but her own row still
carried `guests.plus_one_name = 'Ggvv Vfh'` — the one-name copy the reply writes, which no delete / rename / Undo
path ever wrote back. Readers that took the copy at its word (the Guest list's search; the check-in desk, souvenir
desk, find-your-seat and pass card's "no live row → the copy" fallback) kept a deleted person alive.

- **Write side — the database keeps the copy in step** (`20271288562348_a_plus_ones_name_is_their_row.sql`):
  triggers on `guests` run `guest_plus_one_name_follows_rows` whenever a NAMED +1 row appears, is removed (soft or
  hard), comes back (Undo), is renamed or moves — the copy becomes the oldest live named +1's name, or NULL.
  Unnamed TBA seats never fire it, so the count's own seat minting/trimming leaves the copy alone. Covers every
  writer (card, List, Release seat, bulk delete, Undo, reply, import, SQL) by construction.
- **Existing data** (`20271289389441_backfill_stale_plus_one_names.sql`): the copies that already name nobody on a
  live +1 row are recomputed — measured 3 live guests in prod (of 14 carrying a copy). Narrow and idempotent.
- **Read side — the rows, never the copy**: `companionNames` drops its mirror fallback; the pass card's party count
  and "bringing" come from live rows only; the Guest list's search matches a guest by their live +1 rows' names
  (`companionNamesByBringer`) instead of the copy; the reply's own mirror write only takes a name that landed on a
  row (a `full` mint or a failed write no longer leaves a name on no row).
- Guards: `apps/web/tests/db/a-plus-ones-name-is-their-row.db.test.ts` (delete → cleared, Undo → restored, rename,
  hard delete, placeholders don't touch it, backfill idempotent) and `apps/web/lib/a-removed-plus-one-leaves-no-name.test.ts`
  (Juanita's rows on every reader, an exhaustive mix, the guest card painted, the search, source guards).

SPEC IMPACT: None — implements the standing rule that a guest's +1s are their rows (owner 2026-09-21); no product decision changes.
