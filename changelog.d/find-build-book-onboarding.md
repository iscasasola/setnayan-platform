## 2026-11-17 · feat(suppliers, onboarding): Find · Build · Book (search · cart · orders) + when · where · guests that never end blank — Build 1 of 3

Drawing v15 (artifact Ru32rXtNijZv148DSVwSru, specs `prototypes/find_build_onboarding_2026-11-17_fable.html`), rulings
DECISION_LOG 2026-11-17, the owner's "Yes, all five" on PR #7920.

- **Suppliers row:** three plain steps — Find · Build · Book — and ⚙. The cart badge counts picks not yet asked (moves at
  the press); the orders badge counts first payments due. The Find ▾ dropdown, both fractions and ▶ are gone.
- **Build:** "Covered N of M categories ⓘ" atop; "Book this build" and its sheet are gone — each priced pick has
  "Ask to book" on its line. "Lock this"/"Book" → "Ask to book"; an unpriced pick → "Ask for a quote".
- **Ask = one tap** (Q11) with Undo on its answer; the confirm stays only for a shop not yet verified (the 16 Nov
  always-told line).
- **Book:** Waiting for their answer → Waiting for your first payment (Pay) → Booked ✓ only after the first payment.
- **Beyond reach · N km away** on a supplier past its reach.
- **Migrations:** `event_type_profiles.event_size` + `core_categories` (wedding seeded; editable in Admin ›
  Categories; a new event's starter ring reads it) · `events.date_mode` admits `months` + `events.date_months`.
- **Onboarding:** When — Specific dates · A range (up to 3 months) · Some months · Not sure yet (month list with the
  drawn season lines). Where — up to 3 areas; "Not sure yet" ranks areas by verified shops whose own reach covers them.
  Guests — starts at the type's size number (wedding 150) worded as the minimum. The generic flow requires all three.

SPEC IMPACT: None — every rule is an owner ruling already in DECISION_LOG 2026-11-17. Open with the controller: Q15
(the later "Q15 areas = 3" row vs the v15 OK row's 2).
