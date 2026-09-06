## 2026-09-06 · feat(reception): the room OFFERS what the couple booked, and never writes it

Owner ruling 2026-09-06 (Q9): when a couple has booked a supplier whose trade reaches a
reception zone, that zone SUGGESTS the treatment — *"You've booked {shop} — add {option}?"* —
and ONE click makes it theirs. `events.reception_design` is never written without that click.
The owner's reason, in their framing: a room that changes without them touching it is a room
they cannot trust — the same reasoning that made RV1's three celebration zones default to `none`.

- `lib/reception-scene.ts` — RV1 wrote each celebration option's marketplace trade as a COMMENT
  beside it (`// live_band`, `// mobile_bar`). Those comments are now an `Option.tile` field, and
  the redundant comments are deleted so a comment and a value cannot disagree. Type-only import
  of `WeddingTile`, so the module stays client-safe.
- `lib/reception-booked-suggestions.ts` (new, server) — resolves which booked shop reaches which
  zone. The zone-reach question is asked of the EXISTING bridge, `eligibleSuppliersForPart`; this
  module only narrows. A module-load assertion refuses any option tile the zone's own
  `MOODBOARD_PART_TRADES` entry does not already claim.
- `lib/reception-suggestion-chips.ts` (new, client-safe) — which offers to DRAW right now. Split
  from the above for the MB12 reason: the trade map reaches `next/headers`, and a client component
  importing it fails only the production build.
- `events.dismissed_room_suggestions` (migration `20271211125659`) — dismissals as
  `<vendor_id>:<zone>`, keyed on the booking, never a flag on it.
- Guards are the NEGATIVE: the saved room byte-identical across render, chip and dismiss; the
  click writes exactly one zone; no chip for a photographer, a coordinator, a frozen zone, or a
  shop whose trade names no option. 9 sabotages, 9 red.

SPEC IMPACT: None. This implements the owner's 2026-09-06 Q9 ruling as given; it adds no new
product decision and retires nothing. The three zones and their trades are RV1's, unchanged.
