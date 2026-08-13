## 2026-08-13 · perf(papic): a third photo size — the one a wall actually renders

Neither stored size fitted a grid tile, and the last two days were spent discovering that from both ends.

| | long edge | quality | measured in prod |
|---|---|---|---|
| `thumb_r2_key` | 320 | 50 | **4 KB** avg |
| **`tile_r2_key`** *(new)* | **640** | **55** | ~a quarter of display |
| `display_r2_key` | 1280 | 60 | **96 KB** avg, **780 KB** max |

The Alaala wall first served the thumb — owner: *"the photos are pixelated"*, correctly, because `object-cover` on an `aspect-square` tile scales a landscape source by its **240px height**, so all three breakpoints upscaled 1.3×–1.6×. PR #4399 switched it to display, which is sharp at **27× the bytes**. 640 is the size that is neither: a **1.25× downscale** into the largest tile the app renders (383 device px at `lg:grid-cols-6`, 2× DPR), at roughly a quarter of display's weight.

Both existing sizes are untouched — several surfaces legitimately want each, and the dense day-of venue grid keeps the 320px copy on purpose.

### What moved

- **`papic-derivatives.ts`** — a third encode in both generators. A clip gets one too, from its poster: a clip left on the thumb would be the one visibly soft square in an otherwise sharp grid.
- **Migration `20271140609999`** — `tile_r2_key` + `tile_bytes` on both capture tables, idempotent, with `COMMENT ON COLUMN` (applied migrations are never edited, so the description a reader queries has to live on the object).
- **`resolveLargeStillRef`** — `tile ?? display ?? thumb ?? raw(unless dropped)`. Rows captured before today have no tile and fall back to display: sharp-and-heavy beats soft.
- **Backfill** — `POST /api/admin/papic/backfill-tiles`, admin-only, batched, idempotent. Without it the saving is theoretical for exactly the photos that already exist (prod: **14 rows**, measured). A tile-only generator does this, so a backfill does not re-encode and re-upload the display and thumb copies that are already there.

### Two traps handled rather than discovered later

🪤 **The pre-migration retry had to strip the new KEY column, not just the byte columns.** `persistDerivativeRefs` catches `PGRST204` (column absent on this deploy) and retries — because code and migration land at different times. Had `tile_r2_key` stayed in the retry patch it would have failed on the same error, taking the display and thumb refs *that the deploy could store* down with it. The fallback would have been silently useless for exactly the window it exists for.

🪤 **A new column inherits NO column-level grants.** Where a table-level `REVOKE` has pushed SELECT down to individual columns, a fresh column has it **nowhere** — and naming it then rejects the whole query, shipping as a silently empty wall. Measured before writing the migration (`pg_attribute.attacl`, not `information_schema`): `papic_photos` carries column ACLs on **39 of 40** columns but retains table-level SELECT, so it is fine; `papic_guest_captures` grants everything at table level; **`events` is the one where this bites** — no table-level SELECT at all, 188 of 202 granted individually. Granted explicitly anyway, so a future table-level REVOKE cannot quietly take the wall down.

### Exposure — reviewed, not rubber-stamped

Four new facts. On `papic_photos` they read `authenticated=S`, **narrower than their own siblings** (`display_r2_key` etc. are `SIU`): no RLS client ever writes a derivative ref — the pipeline runs as service role — so SELECT is all they get. The `SIU` on `papic_guest_captures` is inherited from that table's table-level grant and cannot be cut per column; it is unreachable, because the only write policy there is `is_admin()` for both `USING` and `WITH CHECK`, and anon has no write policy at all. **Verified against prod's `pg_policy` rather than pattern-matched to the siblings** — it matters, because `tile_r2_key` is presigned and served, so a forgeable value would read arbitrary objects out of our R2 buckets. That is the "the row is yours, the field is not" shape.

### Guards — 11 sabotages, all measured, all caught

The three sizes must stay **distinct and ordered**; the tile must still clear 383px *after the square crop* (the exact arithmetic the thumb failed); **1280 must stay put** — raising it was owner-declined at ~₱7.1 → ~₱10.6/event/yr, and adding a smaller size must not become a back door to changing it; both generators must actually produce a tile; the retry must strip the new fields; the resolver must prefer tile in both the photo and clip chains; **both** owned reads and **both** attended reads must select it.

And a db test that the column is **readable**, not merely present — using `has_column_privilege('authenticated', …)` rather than a `SELECT`, because 🪤 **the PGlite replay runs as superuser** and a plain select would succeed whatever the grants say. Its mutation reproduces the real hazard (the `events` shape: table-level SELECT revoked with no column grant), because the first mutation — deleting one redundant grant — **escaped**: the guard asserts the *property* that the role can read the column, which table-level SELECT still satisfied. Correct guard, wrong sabotage; the sabotage was fixed, not the guard.

Migration dry-run against prod in a rolled-back transaction first: both roles read both columns, 14 rows need backfill.

Full suite: **7,816 unit tests green**, 1,200 db tests green, typecheck clean, all 21 `lint-*.mjs` guards + `lint:dup-rule` + the migration-timestamp guard green.

SPEC IMPACT: None — no SKU, price or product rule. Adds ~24 KB of storage per photo against ~72 KB saved per wall tile served.
