## 2026-11-05 · feat(couple-photos): a couple's photo on a supplier's card carries "✓ Verified booking" — only when it was one [migration · ships alone]

The Supplier front page promises *"Photos from couples — a couple shares, you approve, it lands on your card with the
Verified booking mark."* The share → approve → card flow already shipped (2026-10-30, migration `20271297221336`); the
card drew no mark, and the share door accepts any shop LINKED to the event (booked or only on the couple's list).

- Migration `20271309527923_a_couples_photo_says_it_was_a_real_booking`: one internal rule,
  `couple_photo_share_is_verified_booking(event, shop)` — TRUE only while the event's own `event_vendors` row names the
  shop at `contracted · deposit_paid · delivered · complete`, not archived, not voided for fraud, and not a self-booking
  (the same exclusions as `vendor_completed_events`). Both card reads (`service_card_couple_photos`,
  `viewer_service_card_couple_photos`) return it as `verified_booking`. Derived at read, never stored — a cancelled or
  archived booking takes the mark off on the next read. Same filters, same grants; the rule itself is granted to nobody.
- The card (`service-card-view.tsx`) draws "✓ Verified booking" on a photo only from the read's `true`
  (`coupleLookOf`, `lib/couple-photo-share.ts`); a missing column (code before the migration) draws nothing. Tiles grow
  80 → 96 px so the mark fits at 390 px.
- Tests: DB — every booked status draws it, `considering`/`shortlisted`/archived/voided/self-booked do not, waiting and
  declined never reach the card, withdraw takes it off, nobody may call the rule directly. Source guard now reads the
  NEWEST definition of each card read. Lab `/dev/supplier-lab?s=couple-photos&card=1` shows two marked and one unmarked.

SPEC IMPACT: None to a locked decision. The two open product questions (should only BOOKED suppliers be able to
receive a couple's photo; may Papic/Memories event photos be shared, not only mood-board uploads) are listed for the
owner in the PR, not decided here.
