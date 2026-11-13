## 2026-11-12 · feat(service-card): the grown card's cover morphs into the hero · 👁 Couple view · hide per card · Events without names · a review keeps only a card booked on its event (rulings 5970 · 5976)

**A · ruling 5976 (Service card grown, prototype `service-card-maker.html` @ 8391e487).** Extends the shipped
`ServiceDetailsSheet` — nothing redrawn. While the layer rises from the tapped card, the hero's `clip-path` opens out of
the card's own cover (`heroClipFrom` in `lib/rise-motion.ts`, pure + tested) over the house 0.7 s (`RISE_MS` — the later
"SIX ANSWERS" (2) ruling, not the prototype's 520 ms); ✕ plays it back. Reduced motion: the layer crossfades and the clip
never moves. The hero plays the card's photos with the face's own cover show (#7532). The bar is ✕ · 👁 · ⓘ (👁 only on
the shop's own card) and still pins as the slim title bar; one section head pins at a time.

**B · ruling 5970 ("reviews per card · events without names").**
- Reviews were already keyed per card (`vendor_reviews.service_id`, `vendor_guest_reviews.service_id`; NULL before
  6 Nov → shop page only) — no new key. The host review action now keeps a card only when it was booked ON THIS EVENT
  (the row the page opened on, or this shop's booked rows), not merely "a card of this shop".
- **Hide per card never deletes:** new `vendor_service_card_hides` (card × item; migration `20271342673075`, RLS at
  create via `current_vendor_profile_ids()`, no anon, no second FK to `vendor_profiles`). The shop taps a photo, the clip,
  an event line or an inspiration photo → greyed "Hidden on this card", tap to restore. Couples get the card without
  them. Keys: `lib/service-card-hides.ts`.
- **👁 Couple view** on the shop's own card; the **opens count** (`service_card_opens`, the same number as Shop ›
  Analytics) under the face, no hide; a failed read says "Opens couldn't load", never 0.
- **Events** = the record's anonymised ledger lines (type · month · guest band, SQL floor intact) as their own section
  after Reviews, no names; the ledger is no longer drawn twice.
- The shop is recognised after the page via two new ops on the existing `couplePhotoShare` dispatcher — no new server
  action (the export budget is at its ceiling).
- Lab: `/dev/shop-preview-lab?view=card-owner`.
- ⭐ **A shop can hide a REVIEW on one card too** (owner ruling DECISION_LOG 2026-11-13, verbatim "Yes, add reviews"):
  new kind `review` (`review:host:<id>` · `review:guest:<id>`) in `CARD_HIDE_KINDS` and the table CHECK; the hosts'
  quote and the guest line on the grown card take the same 👁 hide control as photos. Couples get the card with the
  review's words, name and photo dropped ON THE SERVER (`cardWithoutHidden`); the card's number still counts it, and it
  stays on the shop page and with the couple or guest who wrote it. A failed hides read drops them too. The ⓘ copy no
  longer says reviews can't be hidden. Migration re-allocated forward to `20271342673075` (main gained a later prefix).

Not done here: Forms · the Card Maker door to the grown card (the shop's own card opens from its public shop page today).

SPEC IMPACT: None — builds the approved prototype and the 10 Nov rulings as written, plus the owner's 13 Nov review
ruling (already in DECISION_LOG).
