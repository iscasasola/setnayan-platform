# Badge build J3 — the service-card badges (390 px, light)

Rendered from the SHIPPED `ServiceCardView` + `CardBadgeRow` in a local throwaway page (never committed), with sample
holds — the shop page itself needs a database. The shop page is always light (it is not on `DARK_READY`).

1. `1-card-badge-row-390.png` — top: a card holding all six (Hot Booking lifted, gold rim, "Hot Booking · 4 mos");
   bottom: a card of a verified shop with no earned badge — Setnayan Verified alone, still.
2. `2-card-badge-row-after-2s6-390.png` — the same page 2.7 s later (measured: the label reads "Quick Responder · 2 wks").
3. `3-explainer-popup-390.png` — a tap on the row: "This card’s badges", each medal, held time · since, the rule.

The red "3 Issues" pill is the dev overlay reporting the absent database (brand settings · nav registry · loader
settings), not this change.
