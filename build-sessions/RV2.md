# RV2 — the room offers what the couple booked, and never writes it for them

**Model · effort: Opus · high.** One new affordance in the reception designer, one server action,
and guards whose whole point is a NEGATIVE: the saved room must not change unless the couple
clicks. Same class of invariant as MB14b's byte-identical fallback.

**Owner ruling 2026-09-06 (Q9, confirmed to oversight): SUGGEST, never write.** When a couple has
booked a supplier whose trade reaches a reception zone, that zone shows *"you've booked X — add
it?"* and ONE click makes it theirs. Their `reception_design` is not touched until they click.
Reason in the owner's own framing: a room that changes without them touching it is a room they
cannot trust — the same reasoning as the `none` defaults.

## What exists (do not rebuild)

- **RV1 (PR #5242, merged 2026-09-06 00:29Z)** added the three celebration zones —
  `room:feast` · `room:program` · `room:booths` — to `lib/moodboard-slots.ts`, each with its
  option vocabulary (e.g. `program` = live_band · dj · host_mc · orchestra · wedding_singer ·
  choir · av_production · dance_floor), and to `MOODBOARD_PART_TRADES`, so what a couple dresses
  and what they book are the same noun. RV1's PR body names this as "piece 2 of three".
- **The booking → part bridge already exists:** `lib/moodboard-finalization.ts` —
  `BookedSupplier { vendorId, name, services[] }`, `supplierCanAnswerPart(partId, supplier)` and
  `eligibleSuppliersForPart(partId, booked)`, keyed on `canonicalServicesForPart`. **Reuse these;
  a second "does this booking reach this zone" mapping would be a competing source of truth
  (CLAUDE.md Rule 0 · 8).** Find how the finalization panel builds its `BookedSupplier[]` (from
  `event_vendors` joined to the shop's `vendor_profiles.services`) and load the same way.
- **The editor** is `app/dashboard/[eventId]/seating/lab/_components/reception-design-editor.tsx`;
  **the writer** is `app/dashboard/[eventId]/seating/actions.ts` (the mood-board `actions.ts` also
  writes `reception_design` — pick the one the editor already calls, do not add a third).
- **The render** is `renderVenueSvg` in `lib/reception-scene.ts`; RV1's report: three defects were
  only visible by rendering and LOOKING. Do the same.

## The build

1. **Suggestion chips, per zone.** For each of the three celebration zones (and any other zone
   `eligibleSuppliersForPart` can answer), if the couple's booked suppliers include one whose trade
   reaches the zone AND the zone's current value does not already reflect that trade, render a
   chip: *"You've booked {shop name} — add {option label}?"* with one button. The chip is derived
   at render time from bookings + current design; it is NOT stored.
2. **One click = one ordinary write.** The button calls the existing zone-set action with the
   option the supplier's trade maps to (first tile the shop matches, the same "most characteristic
   first" rule the vocabularies state). Nothing else changes in `reception_design`. If the zone is
   finalized (MB12's `touched_roles` freeze), the chip does not render — a frozen part is not
   re-derived (`a-finalized-part-never-re-derives.test.ts` already says so; extend, do not
   contradict).
3. **Dismiss is per chip, per booking, per couple** — stored as a small jsonb list on
   `reception_design` (e.g. `dismissed_suggestions: ["<vendorId>:<zone>"]`), never as a flag on
   the booking. A dismissed chip does not come back for that booking; a NEW booking gets a fresh
   chip.
4. **The negative guards — the ones that matter:**
   - a couple with bookings and an untouched room: `reception_design` byte-identical before and
     after page render, before and after the chip is shown, before and after dismiss (dismiss
     changes ONLY the dismissed list — assert the rest of the document is byte-identical).
   - the click writes exactly the one zone; every other key byte-identical.
   - a supplier whose trade reaches NO zone renders no chip (a coordinator, a photographer).
   - a frozen zone renders no chip.
   Sabotage each: auto-apply on render → red; write two zones on click → red; chip for a
   photographer → red; chip on a frozen zone → red.
5. **Copy** is honest and short: the shop's real name, the option's real label. No "recommended",
   no "we picked this for you".

## Out of lane

The generated artwork (RA1). The 3D room. Vendor colour access (MB16). Any change to how
bookings are made.

## Report

The four lines in `MB-OVERSIGHT.md`, plus one screenshot: a couple who booked a live band seeing
the `program` chip, and the same room after one click.
