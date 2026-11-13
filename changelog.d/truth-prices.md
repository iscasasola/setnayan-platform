## 2026-11-13 · fix(pricing): no typed price or included-credit number on a customer screen — guarded

Owner, 13 Nov 2026: the site carries no typed prices. Truth sweep T1 (prices).

- New guard `apps/web/lib/no-typed-price-on-a-customer-screen.test.ts`: parses every customer surface (`app/` minus admin/api/dev, `components/`, `lib/` minus the modules other sweeps own) with the TypeScript parser and fails on any `₱` figure other than `₱0`, any `PHP 999`, and any credit COUNT ("1,000 Papic credits") in a string, template or JSX text. Comments and identifiers are never read. Every exemption carries its reason; the `app/` figures already declared in `lib/public-price-literals.ts` count as exempt, and the guard pins that none of those declarations is a catalogue price. Sabotage-checked: a typed "₱2,499" and "1,000 Papic credits" on the front door each turn it red.
- `lib/vendor-dayof-modules.ts`: the supplier's Papic capture blurb typed "Papic Lite (50 credits) … Papic Ltd (70 credits) when you accepted the booking with a token" — two rules the 2026-09-05 credit ruling replaced, and a retired token. It now says it spends the supplier's Papic credits for the event, with no number.

SPEC IMPACT: None — enforces the existing rule that prices are read from `platform_retail_catalog_v2` / `vendor_billing_catalog`.
