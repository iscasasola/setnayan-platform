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
