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

### Review fixes (19 Nov, Fable review FIX-FIRST → drawing parity)
- **Email way keeps the card and the welcome.** With email confirmation on, nobody is signed in when the shop opens, so
  the shipped card maker cannot run. The confirm link (and that screen's "sign in") now lands on Today's welcome carrying
  the drafted card (`firstCardCarryPath`: a service name + price, no personal detail); the welcome's **Approve card**
  makes it through the same maker (`approveFirstCard`). It used to land on a bare dashboard and the card was lost.
- **A refused card is said on screen.** `makeFirstCard` returns the maker's own sentence; the door lands on the welcome
  with "Your first card wasn't made." + why, Approve again and Edit in the Card Maker. It used to open Today as if the
  card existed. A skipped card is told to the welcome too, so its ticked row never claims a card.
- **Words, rows and steps match PB1–PB6:** step names under the bars (Start · Account · Your shop · Your card · Done);
  PB1 "Three answers. Free." + the Free line + "I have an account"; PB2 Google · Apple · "or" · Email · Password · Your
  role at once (supersedes 7 Nov "Email hides the other ways"); PB3 "Your shop" with Shop name · Services · Events ·
  Where · Contact · Number · They pay you (Later), each row's value or what to add, ✓ on the right, and its note;
  PB4 the drafted card face, "Built from what you typed", From (PHP), Edit · Skip for now · Approve card; PB5 Shop ·
  Cards · Link rows, Free · Tools for the clients you have, "Couples can't find you yet. Get verified later.", the tick
  for every shop, Open my shop; PB6 "Welcome, <shop>" · "Your shop is open on Free." · the ticked first row · "Get
  verified to be found".
- **Q3 — a row opens a sheet** (PB3·a): it rises from the bottom on the house backdrop with the house modal hook, Save
  closes it. The panels stay inside the one form, so nothing typed is lost.
- **"Your changes save as you go."** — each step and each sheet's Save park the answers in this browser tab.
- Pins re-stated to the 19 Nov drawing (the-approved-redesign, the-gate-walk-fixes, the-v21-deltas, the-w1-walk-16-nov,
  supplier-onboarding — test 8 new). None deleted.
