## 2026-07-11 · fix(guests): Living Roster P3 review-fixes — seat-suggest stage anchor, restore guard, decline-toast truth

Three fixes from the adversarial review of PR #3102 (Living Roster P3 · reactive
seat chips + decline undo). The review returned **0 must-fix** (so #3102 merged
clean), but each confirmed finding is a cheap correctness/hardening win — split out
here as a focused follow-up. (P4 mobile seat-parity + the deferred low-sev
follow-ups ship separately.)

- **#3 · real stage anchor (correctness).** `lib/seat-suggest.ts` hardcoded the
  stage at top-center `{x:50,y:8}`, and `guests/page.tsx` never fetched the floor
  plan — so the reactive "~T#" seat SUGGESTION pointed to the wrong band for any
  couple who moved their stage. `suggestTableFor` now takes an optional `stage`
  (defaulting to the old anchor); `page.tsx` folds `fetchFloorPlan` into the
  existing parallel fan-out and passes `{stage_x, stage_y}`, so the hint ranks from
  the same point Auto-Arrange uses. +2 unit cases (moved-stage flip + default
  fallback); 15/15 seat-suggest tests pass.

- **#1 · guest∈event guard (authz hardening).** `restoreGuestRsvpAndSeat`'s seat
  upsert lacked the `guest.event_id === eventId` (and `table.event_id === eventId`)
  gate its sibling `addGuestToGroup` enforces. The review REFUTED it to a nit (RLS
  + the no-join read side contain it to self-pollution — no cross-tenant
  disclosure), but the guard is added as cheap defense-in-depth so a foreign
  `guest_id`/`table_id` from the payload can't pin a phantom seat under the
  couple's own event.

- **#4 + #2a · truthful decline toast + corrected comment.** The decline-undo
  toast named the freed seat from a possibly-stale SSR prop; `setGuestRsvp` now
  reads the freed table's CURRENT label (embedded read) into
  `ReleasedSeat.table_label` and the toast prefers it. The misleading
  `chip-editors.tsx` comment (claimed the optimistic patch restores the seat chip —
  it only flips the RSVP pill) is corrected. **#2b** (optimistic seat-chip restore
  on undo) is deferred as accepted cosmetic: the chip self-heals on revalidation in
  ~1 round-trip and a true fix needs a seat dimension in the optimistic store.

tsc clean · `tsx --test` (seat-suggest + guest-optimistic + guest-parse: 57 pass).

SPEC IMPACT: None. All three are code-level correctness/hardening on shipped P3 —
no SKU/pricing/schema/RLS-pattern change. The guard reuses the existing
event-scoped reads; `table_label` is an optional field on an in-memory type
(`ReleasedSeat`), not a DB column.
