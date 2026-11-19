## 2026-11-19 · feat(onboarding): supplier onboarding — the shared screens + Door B (self-serve)

The owner-approved supplier onboarding (DECISION_LOG 2026-11-19 "SUPPLIER ONBOARDING — BOTH DOORS APPROVED (v3)",
drawing `36jmQMWrANcgd2HxihAUw5` v4), part 1 of 3. `/open-shop` (Door B, from /for-suppliers "Create your shop free")
becomes the five shared screens, on the SAME always-mounted form and the SAME one submit (`becomeVendor`):

- **1 · Open your shop** (PB1) — the shop name and what you do / the main service, on one screen.
- **2 · Create your account** — Google / Apple / Email · Terms. Second, not last.
- **3 · Check your shop** — one list, a sheet per fact: Shop name · Contact person · What you do · Events you serve ·
  Where you are (the map pin stays) · Contact number. A missing line reads "Add" and holds Continue.
- **4 · Your first service card** — drafted from the category + service; the supplier types the price. Approve
  (needs a price) · Edit (the shipped Card Maker, once the shop is open) · Skip (no card). Made by the shipped
  `createVendorService`.
- **5 · You're all set** — the plan sits here (`PlanOnLastScreen`), then Open my shop.
- **Today welcome** — `?opened=1` (and `?claimed=1`, which nothing read before) draws Add the clients you already
  have · Add your logo (`/open-shop/logo`, no longer forced in between) · Get verified. No leads promised.
- The onboarding wears the supplier blue look (`data-supplier-look`).

One vocabulary for every door: `lib/supplier-onboarding.ts`, pinned by `lib/supplier-onboarding.test.ts`.
Superseded pins updated with the ruling cited (four-steps, the-approved-redesign, the-w1-walk-16-nov,
the-walk-round-1, the-gate-walk-fixes, a-new-shop-lands-on-today, a-new-shop-is-counted-for-what-it-was-asked).
Regenerated: `port-control-baseline.json` (PlanPane / PlanSheet leave `/open-shop`), `ugat/screens.generated.json`.

Not in this PR (next parts): Door A (couple QR) · Door C (coordinator) + "Trusted partners" · the service-card
edit lock (waits for the Card Maker stack #7928/#7939).

SPEC IMPACT: None new — implements the 2026-11-19 DECISION_LOG rows as written.
