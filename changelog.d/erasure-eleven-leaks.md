## 2026-08-02 · sec(erasure): eleven tables kept the subject's uuid after their erasure request — because `ON DELETE SET NULL` never fires here

Nine of these eleven declare `ON DELETE SET NULL` on the subject column, which reads like the problem is already handled. It is not:

> 🔑 **Erasure issues no DELETE.** `purge.ts` anonymizes the auth user in place via `auth.admin.updateUserById` — it never calls `auth.admin.deleteUser` — so `ON DELETE SET NULL` **never fires on the erasure path**. The uuid is still sitting in the column after the request completes.

That clause fires only for a hard delete (the anon-draft sweep). Reading it as "self-de-identifying" is precisely what excluded these tables in the first place.

⚠ Two are worse: **`vendor_change_orders` and `vendor_feature_recommendations` carry the uuid with no FK at all** — no clause exists to fire under any circumstance.

### Nulled vs deleted, and why

**Author stamps are nulled, the row survives** (9 columns across 8 tables). These rows are read by *event* or by *vendor*, never by their author — a shared agenda, a playlist, walkthrough notes, a call log. Deleting rows keyed on the author would strip the co-partner's agenda or the shop's own records because the person who typed them left. Nulling costs nothing: no reader selects these columns, none carries a label, no RLS policy consults one. Same call already made for `scan_events.scanner_user_id`.

**Subject rows are deleted** (3 tables). `vendor_lock_proposals` is `NOT NULL` + `ON DELETE CASCADE` — the schema's own answer is that it dies with the account, and erasure simply never issued the delete that would have fired it. `vendor_feature_recommendations` is `NOT NULL` with no FK: nothing can null it and nothing would cascade it. `vendor_web_dossiers` is a verbatim snapshot of the subject's own profile.

### How this set was arrived at

An earlier bulk pass over all 78 backlog tables was **53% wrong**, directionally toward under-erasure, because it reasoned from `CREATE TABLE` text that migration `20271032282809` had already invalidated. These eleven were re-settled **one table per agent** against `tests/db/user-fk-behaviour.generated.txt`, then each settlement attacked by an independent reader:

**10 of 11 survived unchanged**; the eleventh came back *"keep the disposition, fix the wording"*. Every one of the 13 columns is exact-matched against `prod-schema.snapshot.txt`.

### Proven, not assumed

Both code paths are seeded and asserted (`2p`) — an empty table would pass trivially, which is what META-3 exists to prevent:

| purge does | result |
|---|---|
| neither loop (today's `main`) | **33/34** — *"the subject's uuid is still stamped on the item"* |
| shipping | **34/34** |

`ERASURE_COLUMN_WRITES`, `ERASURE_ROW_DELETES` and `ERASURE_FILTER_COLUMNS` all **derive** from the two new constants rather than repeating the names, so a typo is a G1/G2 phantom failure instead of a silent `PGRST204` the best-effort purge swallows.

Backlog **78 → 67**.

Verified: full DB suite **730/730**, erasure guards **26/26**, `tsc --noEmit` exit 0 with zero errors. ⚠ The first `tsc` run exited **134** (out-of-memory crash) reporting "0 errors" — a crashed typecheck's error count is meaningless; it was rerun with a larger heap.

SPEC IMPACT: None — closes eleven gaps in an existing RA 10173 obligation.
