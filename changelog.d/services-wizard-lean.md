## 2026-06-20 · refactor(vendor): slim the create-service wizard to "the menu" — per-couple pricing lives in the inquiry

Owner reframe: a service listing is a conversation-starter (the menu), not the contract — the real price, surcharges, and tailored payment plan are negotiated per couple in the inquiry/quote flow (which the code already owns: `event_vendors.total_cost_php` via the quote-bridge, the in-thread Adaptive-Pax surcharge confirm, the frozen `event_vendor_payment_plan`). A code-grounded split (workflow) confirmed it and found dead weight.

- **Removed the Discount block** from the wizard — `vendor_services.discount_*` has NO couple-facing reader anywhere; real discounts run through the separate voucher/promo-code system. Pure write-only friction, gone. (The action still tolerates null discount input; the legacy edit card's discount form is left for a later card cleanup.)
- **Tucked the per-guest rate + last-minute fields** (`added_pax_price_php`, `recommended_lead_time_months`, `last_minute_end_months`, `last_minute_surcharge_pct`) behind a single closed-by-default "Pricing rules (advanced) — optional" disclosure with a note that the real numbers are set in each couple's inquiry. They never block publishing.
- **The menu stays:** category, title, from-price, crew (size + meal toggle), comes-with links, availability (daily capacity/slots), the Setnayan Exclusive perk. Fewest-to-publish unchanged at 3 (category → from-price-or-skip → perk).

Honest gap noted (not silently assumed): `last_minute_surcharge_pct` is collected but no code applies it to a booking total today — it's a default pending wiring into the quote/pax confirm. The per-inquiry custom-rate override (quoting a different added-pax rate to one couple in-thread) does not exist yet — a future product decision.

Still flag-gated (`NEXT_PUBLIC_SERVICE_WIZARD_ENABLED`, default OFF) + migration `20270208451790` not applied. tsc clean.

SPEC IMPACT: 0022 vendor services — listing-vs-inquiry split. `Services_Builder_Create_Flow_Design_2026-06-20.md` updated. Logged in `DECISION_LOG.md`.
