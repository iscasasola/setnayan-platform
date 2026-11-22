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

## 2026-11-20 · fix(onboarding): the first card is "on your page" only when the shipped switch says so

- The maker makes every card as a draft. After making it, the door now asks the shipped switch (`toggleVendorServiceActive`), which applies the publish gate and the live-cards cap. Live lands on `?card=live`. A refusal lands on `card=draft` with the switch's own sentence, the Card Maker opened on that card, and "Put it on my page".
- Today's ticked row says "Your shop and first card" only on `card=live`. A bare `?opened=1` names the shop alone.
- PB5 no longer says "· on your page" and no longer ticks a card that isn't made yet.
- Approve is idempotent: a card the shop already has under that title is reused, so opening the confirm link twice makes no duplicate.
- Tests: `lib/supplier-onboarding.test.ts` 11 (live, cap-refused, gate-refused, no answer, idempotency).

SPEC IMPACT: None.


## 2026-11-21 · fix(onboarding): PB4 and PB1 fit 375 px, as drawn

Caught up with `main` (merge only). PB4: Approve card full width, Edit · Skip for now under it (three in a row ran past the right gutter at 375 px). PB1's not-yet button says Continue, as drawn ("Pick a service to continue" ran past the gutter). Shots: `build-sessions/shots-onboarding-375/`.

SPEC IMPACT: None.

## 2026-11-21 · fix(onboarding): Today's welcome says what is true of THIS shop · first-card reasons ride as keys (ship review)

Ship review @ `f38fbbb93f` (FIX-FIRST), all three:

1. **The welcome no longer tells every `?claimed=1` landing "Your shop is open on Free."** Main also sends established
   shops there (the claim finalize page, the services action). The line now names the shop's real plan off Today's one
   shop read (`readTodayShopRow` → `todayWelcomeLine`: "Your shop is open on Pro."), and "Get verified to be found" is
   drawn only for a shop that read says is not verified (`todayWelcomeSteps`). A failed read names no plan ("Your shop is
   open.") and does not ask. No new read.
2. **A failed re-read after the maker answered is said as that** (`FIRST_CARD_MADE_UNREAD`: made, but not found again to
   put on the page — open your cards), not "made, not live" with no id; the welcome's link goes to the cards list.
3. **The first card's reason rides the address as a KEY** (`lib/first-card-why.ts`): `not-made` · `not-live` ·
   `made-unread` · `cards-unread` · `shop-unread` · `owner-only` · `no-shop` · `needs-<cover+price+inclusions>` ·
   `cap-<n>`. The welcome draws the sentence from code (rebuilt from the shipped publish gate, live-cards cap and shop
   check), so nobody can put their own words on a supplier's Today; free text on the address is dropped.

Tests: `lib/supplier-onboarding.test.ts` 11b · 11c · 11d (+ 8 and 11 moved to keys). Seven sabotages, each red.

SPEC IMPACT: None.
