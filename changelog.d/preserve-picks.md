## 2026-08-10 · feat(preservation): the couple picks what keeps full resolution — and "pick all" is the default by construction

Owner: *"they can pick which one to preserve"* · *"if nothing is picked, pick all."*

### The design is the rule

The column stores the **decline**, not the pick: `preserve_declined_at IS NULL`
means preserved. So "if nothing is picked, pick all" needs **no code at all** —
it is what absence means.

An opt-in `preserved_at` could not express it without backfilling every existing
capture, and then re-running that backfill forever for every capture taken
afterwards. A test fails if an opt-in column comes back.

### ⚠ The sweep now decides per capture, not per wedding

`lib/papic-fullres-drop.ts` skipped **every** capture on an event whose owner
held an active `HIGH_RES_ARCHIVE`. It now skips a capture only when the owner
holds it **and** that capture was not declined.

Safe to change today only because that catalogue row is inactive and nobody has
ever bought it. The same change after the first sale would silently begin
compressing originals somebody paid to keep — so this is the last moment it is
free.

### 🪤 Two hazards written into the migration, where a reader will find them

**It is not a delete flag.** Declining lets one ORIGINAL be replaced by its
compressed copy at the point already locked. The photo is never deleted and the
compressed copy is kept five years for everyone, paid or not. Both column
COMMENTs say so — that is what a schema browser shows the next person — and a
test fails if the column is ever read within 200 characters of a delete call.

**Declining cannot be undone once the sweep has run.** Re-including a capture
after its original is gone cannot restore the resolution. This is the only place
in the product where a couple can quietly destroy something by changing their
mind, so the surface that writes it must say so rather than imply an undo that
cannot exist.

### Guard — mutation-tested

| sabotage | result |
|---|---|
| skip back to all-or-nothing per event | ❌ 1 fail |
| stop selecting the column in the sweep | ❌ 1 fail |
| drop one of the two column COMMENTs | ❌ 1 fail |
| baseline | ✅ 5/5 |

The "reads the column" test exists because of this project's most repeated
defect: a column with no reader, or a reader with no writer. Here a missing
select would make every capture read as preserved and the picker would change
nothing at all.

### Verified

**7292 / 7292** unit tests · `tsc --noEmit` clean · 19 lint scripts pass ·
migration guard: `✓ 1080 migrations: unique prefixes + allocator-sourced`.

⏭ Next: the gallery selection, the points meter filling toward 5,000, and the
Preserved view.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-10 — applied and pushed.
