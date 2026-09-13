## 2026-09-13 · feat(papic): a host's "delete this photo" really deletes it

Owner ruled 2026-08-10 (DECISION_LOG row 3099, ruling 7): *"Delete a photo" means
DELETE EVERYWHERE — genuine erasure, the one exception to the compress-never-delete
rule.* Until now the host's only controls wrote `hidden_at`: reversible, and every
file survived to the six-month sweep. LAU-11 / CP-11.

- **`deletePhotoForever`** (`app/dashboard/[eventId]/studio/papic/moderation/actions.ts`)
  — host-only, event-scoped, both capture tables. Refs are proven against the row's own
  tenant folder by `planPapicRowDeletes` and removed through `executeCleanupDelete`, so
  the delete cannot be pointed at a stranger's object. Objects first, row second. A
  refused or failed object **keeps the row**, so the deletion stays retryable and the
  surviving copies stay nameable. The delete counts its returned rows — a zero-row
  delete is success-shaped.
- **The papic key list said SEVEN; the schema has TEN.** `safe_display_r2_key`,
  `safe_tile_r2_key` and `safe_thumb_r2_key` — the face-blocked copies a *public*
  surface may show — were missing from every deletion path. Measured against production
  the same day: all three are still NULL on every row, so nothing is orphaned yet.
- **`papic_guest_captures` was never read by the celebration sweep**, though its rows
  `CASCADE`. A couple removing their own wedding was told the photographs were gone
  while every guest upload stayed in storage, permanently unnameable — the failure
  `event-media-sweep-core.ts` describes for the *supplier* table, which was added,
  while the guest table beside it was not.
- **Hide is unchanged** and remains the default, reversible option.
- Guards: `lib/a-delete-really-deletes.test.ts` (18) plus three new cases in
  `lib/event-media-sweep.test.ts`. Eight sabotages were run against them — dropping the
  three face-blocked columns, un-reading the guest table, deleting the row before the
  files, dropping the tenancy predicate, dropping `.select()`, letting a refusal drop
  the row, removing the seat-side mount, and removing the confirm — each turned the
  suite red, and the tree restored clean.

SPEC IMPACT: None. The 2026-08-10 ruling is already recorded in `DECISION_LOG.md`; this
makes the code match it. No corpus text asserted the old hide-only behaviour.
