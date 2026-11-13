## 2026-11-13 · fix(pricing): no typed price or included-credit number on a customer screen — guarded

Owner, 13 Nov 2026: the site carries no typed prices. Truth sweep T1 (prices).

- New guard `apps/web/lib/no-typed-price-on-a-customer-screen.test.ts`: parses every customer surface (`app/` minus admin/api/dev, `components/`, `lib/` minus the modules other sweeps own) with the TypeScript parser and fails on any `₱` figure other than `₱0`, any `PHP 999`, and any credit COUNT ("1,000 Papic credits") in a string, template or JSX text. Comments and identifiers are never read. Every exemption carries its reason; the `app/` figures already declared in `lib/public-price-literals.ts` count as exempt, and the guard pins that none of those declarations is a catalogue price. Sabotage-checked: a typed "₱2,499" and "1,000 Papic credits" on the front door each turn it red.
- `lib/vendor-dayof-modules.ts`: the supplier's Papic capture blurb typed "Papic Lite (50 credits) … Papic Ltd (70 credits) when you accepted the booking with a token" — two rules the 2026-09-05 credit ruling replaced, and a retired token. It now says it spends the supplier's Papic credits for the event, with no number.

SPEC IMPACT: None — enforces the existing rule that prices are read from `platform_retail_catalog_v2` / `vendor_billing_catalog`.

### Supplier prices — the catalogue row or no figure (same day)

Eight `*_FALLBACK_PHP` figures reached a supplier's screen whenever their catalogue row did not read. Each now shows NO figure instead of a remembered one:
- **Extra seat** (`SEAT_FEE_PHP` ₱990) and **extra branch** (`BRANCH_FEE_PHP` ₱990): constants deleted; `fetchSeatFeePhp` / `fetchBranchFeePhp` answer null; the Team and Branches screens drop the figure, and the buy / renew actions REFUSE ("We couldn’t read the … price just now") instead of minting an order at a typed price.
- **Per-event 3D booth** (`VENDOR_3D_BOOTH_EVENT_FALLBACK_PHP` ₱500): constant deleted; `fetchVendor3dBoothEventPricePhp` answers null for missing / refused / retired / unpriced (callers already refused on null).
- **3D Booth cycle**, **Papic Challenges**, **AI add-on**, **Deep Search**: the Plan page cards and the Deep Search page read the row or show the cadence with no figure (the charge-side resolvers are unchanged and stay held by `fallback-prices-match-the-catalog.db.test.ts`).
- **Supplier plan prices** (`TIER_PRICE_PHP`): the Plan sheet no longer substitutes the typed table for an unread `*_vendor_*` row — that plan shows no price and no Pay button.
- **Free Papic credits**: an UNREAD allowance now says nothing on the front door (was the seed 50); onboarding reads the promise reader, not the mint reader that turned an admin "0 — switched off" into "50 free credits", and says "on your first event", not "with every event".
- Supplier day-of Papic blurb no longer types 50/70 credits or "token".

Guards: `brand-your-booth-at-one-wedding.test.ts` now pins NO fallback and executes the null reader (was: pins one fallback); `the-free-credit-promise-is-true.test.ts` unknown → silence; `fallback-prices-match-the-catalog.db.test.ts` floors follow the three deleted pairs (pairs 5→4, compared 4→2) and gain two derived checks — a loose count of numeric fallbacks must equal the strict scan (sabotage-checked with `: number = 1_490`), and every paired code must exist in a catalogue.

### The in-app plan offer matches /pricing (Controller F-W2-29, same day)

Inside the app no Event Plus was offered anywhere and no plan showed its Papic credits, while /pricing offers Free · Event Plus · Event Pro. The plan screen every in-app "Unlock Pro" door already lands on (`/dashboard/[eventId]/studio/website-pro`, reached from Hub settings, the Maker, Details, Our Story, prints, save-the-date…) now draws **Free · Event Plus** above its Event Pro card:
- Prices and included credits are READ from `platform_retail_catalog_v2` through the front door's own helpers, moved to `lib/event-plans.ts` (`planPricesFrom`, `planCreditsFrom`; the front door re-exports them) — one place, where Event Ultra lands after #7601.
- Event Plus is bought with the page's existing checkout drawer at its catalogue price (`EVENT_PLUS`, already priced server-side by `order-charge-authority`); once paid it counts toward Event Pro (the Pro card then asks "₱X more", from `eventHubOwnership`). Held Pro hides Plus. An unread row shows no price and no count.
- The Event Pro card adds "N Papic credits included." from its row.
- New test `app/dashboard/[eventId]/studio/website-pro/the-app-offers-the-plans-pricing-offers.test.ts` renders the real component.
- Wording ("Event Hub Pro" → "Event Pro") is left to PR #7605.

### Event Ultra on the in-app plan screen (#7601 merged, same day)

- `lib/event-plans.ts` now carries Event Ultra (`EVENT_ULTRA`): `planPricesFrom` / `planCreditsFrom` return `ultra` / `ultraCredits` — #7601's front-door helpers folded into the one module (merge conflict resolved there; the front door re-exports).
- The in-app plan screen draws an **Event Ultra** card after Event Pro: the row's price and included credits, the front door's own lines (`ULTRA_PEEK`, `ultraMore`), bought through the same checkout drawer — which asks the server for the upgrade quote, so an event that paid for Plus or Pro is charged only the difference (`readUltraUpgradeCharge`, #7601) and the card says so. Holding Ultra hides Event Plus and the "Your plan" mark on Free.
- The plan quiz's Setnayan AI line names Event Ultra beside Event Pro.

### Event Ultra as a supplier gift and a badge reward kind (owner, 13 Nov 2026)

Owner: *"Gifting Ultra: yes, add it to shop gifts and badge rewards"*. An Ultra gift reaching an event that already holds Plus or Pro **gives full Ultra**; badge rewards: **Ultra is a kind, no step pays it yet**.
- Migration `20271345200551_supplier_gifts_event_ultra.sql` (via `pnpm migration:new`) extends the Plus/Pro gift and badge-reward migrations with a fourth kind, `event_ultra`. Every function is copied from its latest definition, and each change is marked 💎:
  - **Kind accepted everywhere:** the gift-table, given-unlock and reward-kind CHECKs; the stock and reward-stock readers; the badge reward door.
  - **Delivery:** the door gives Ultra lines first, gives full `EVENT_ULTRA` on a Plus/Pro event, and gives nothing on an Ultra event (the unit stays in stock). Like buying it, it turns AI on and tops up the row's included credits.
  - **What a gifted Ultra unlocks:** the gifted-access readers make it also answer for what Ultra grants (`COUPLE_WEBSITE_PRO`, `LIVE_STUDIO`, `PATIKTOK_COMPILER` — the app's aliases read orders only).
  - **Originals clock:** the clock counts a gifted plan's `fullres_extra_keep_days`.
- App: `ShopGiftKind` / `SHOP_GIFT_KINDS` / `SHOP_GIFT_UNLOCK_CODE` gain Ultra. `EventHolds` gains `'ultra'`, and the new `eventCanTake` is the one take rule. `fetchEventGiftHolds` reads Ultra first. Ultra also reaches the quote menu's refusal words, the shop's Promote stock rows, the admin gifts ledger, the gift-buy action, the gift kind words, the reward names and the reward kind. No badge step pays Ultra.
- `lib/iap/products.ts`: `gift_event_ultra` is declared beside the other gift products. It is not sellable, like the rest; the owner creates it in App Store Connect.
- What a shop pays for an Ultra gift is the `EVENT_ULTRA` row (`gift_price_php`, else the list price) — nothing typed.
- Tests: DB case 6 in `a-supplier-gift-lands-once.db.test.ts` (executed against the replay). New `lib/event-ultra-is-a-gift.test.ts` covers the take table, the verdict, "no step pays Ultra", and that the SQL Ultra list equals `EVENT_ULTRA_GRANTS`. The shop-gift, badge-reward and IAP tests are updated for the fourth kind.

SPEC IMPACT: DECISION_LOG row due — "Event Ultra is a supplier gift (full Ultra on a Plus/Pro event) and a badge reward kind with no step yet (owner 2026-11-13)". The corpus is not reachable from this cloud session; recorded here for the Controller to apply.
