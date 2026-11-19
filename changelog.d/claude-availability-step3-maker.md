## 2026-11-19 · feat(card-maker): Availability plan step 3 — a card's own Availability style

The one-page card maker (Services › a card › More settings › Booking terms) opens with an **Availability** block
(owner "ok" to every pick on `prototypes/availability_steps_3_4_2026-11-19.html`, DECISION_LOG 2026-11-19
"AVAILABILITY STEPS 3 AND 4 APPROVED"):

- **Recommended for ‹service›: ‹style›** + **Use it** (→ **Using it ✓**), read from the service's step-2
  `canonical_service_taxonomy.availability_style`. Left out when the service has none, or the read was refused.
- One **PickMenu** dropdown of the seven styles. By the hour · Set times with seats · Rooms by the night are listed as
  **Coming soon** and can't be picked (step 5). **Not set** keeps the card booking exactly as today.
- One sentence: how Setnayan reads the card.
- **Made to order:** the count question becomes **Orders for one day** (same `daily_capacity`), plus a NEW
  **Order at least N days before the date they need it** (`vendor_services.order_lead_days`, 0..365), refused when
  a couple asks too late (`service_card_order_lead_days`, in `finalizeVendor`). **Book ahead (months)** stays beside
  it as advice (ruling 1).
- **Rented by the piece:** the question becomes **How many do you have** (same `daily_capacity`), with **no cap above
  500** (ruling 3): the 500 ceiling is skipped for a piece card in the maker and in the save.
- **Always available:** the number is hidden (the stored one is kept), time slots are hidden, and
  `service_card_daily_limit` answers no limit — the card is never counted (ruling 4).
- One booking a day and halls are unchanged.

New per-card column `vendor_services.availability_style` (same seven-value CHECK, held to `lib/availability-styles.ts`
by `availability-styles.test.ts`). A new card pre-fills it from the service; empty means the card behaves as today.
Saved as one more owner-scoped part after `save_vendor_service`.

The dropdown and its button show the style in plain words only ("Made to order"), never an AV code — owner, final
drawing `spaces_final_screens_2026-11-19.html` (DECISION_LOG ba647712: "availability opens preset in plain words, no
AV codes shown"). AV-* names stay in code and tests.

Migration `20271351451190_a_card_books_by_its_own_availability_style`. Motions: none.

SPEC IMPACT: None — builds the approved step 3 drawing as ruled. (Drawing copy "couples pick no date" for Always
available is replaced by ruling 4's "Couples still give their event date, but it is never counted.")
