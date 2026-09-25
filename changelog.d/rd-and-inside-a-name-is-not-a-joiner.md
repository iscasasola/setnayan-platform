## 2026-09-25 · fix(monogram): "and" inside a name is not a joiner

The monogram fallback (`deriveMonogram` / two inline mirrors) split couple
names on the bare substring `and`, so "amanda & ben" (owner: *"I made A&B
Monogram. it showed A&A"*) cut into "am"/"a"/"ben" and rendered "A & A". `and`
now only matches as its own WORD (`\band\b`); a hyphen only splits with a
space on both sides, so a tight hyphen inside one name ("Mary-Anne") no
longer reads as a joiner between two people. Fixed in `lib/monogram.ts`
(`deriveMonogram`), and the two documented inline mirrors: `deriveMonogramFallback`
and `deriveFirstNames` in `app/[slug]/_components/editorial/data.ts`, and
`deriveInitials` in `app/dashboard/(account)/library/_components/editorials-tab.tsx`.
Added `lib/monogram.test.ts`.

## 2026-09-25 · fix(suite): the filter chip reads "Event Hub", never "Website"

`lib/add-ons-catalog.ts` tagged six catalog entries `'Website'` — the browse
chip and card-tag label the Suite page renders directly from `tags`. Renamed
to `'Event Hub'`, matching the owner's standing rule that UI copy never says
"website"/"site". The Suite's "Mood Board" appearing in both "Recommended for
you now" and "Free to use" was checked against `lib/studio-recommendations.ts`'s
own docblock ("Free add-ons are recommendable on purpose … this answers 'what
to set up next', not 'what to buy'") — confirmed INTENDED, left unchanged.

## 2026-09-25 · fix(store-shell): two doorway leaks closed, one speculative one ruled out

- `/vendors` (the supplier price ladder — Solo/Pro/Enterprise, priced live via
  `getVendorPrices()`) is now a refused doorway (`STORE_SHELL_WEB_ONLY_DOORWAYS`
  in `lib/store-shell.ts`), so the existing `StoreShellLinkGuard` hides the ☰
  drawer footer's "For suppliers" link on native. `/open-shop` ("Open your
  shop") was audited and found to carry NO prices anywhere in its wizard —
  left open.
- The Mood Board page's "‹ Back to add-ons" link (→ `/dashboard/[eventId]/studio`,
  the paid catalogue) is now withheld in the store shell — the hub already
  filters its own grid to free tiles there, but the link itself is withdrawn
  too rather than leaving a reviewer one tap from a screen framed as
  "add-ons".
- `/refunds` and `/download` were audited for a purchase CTA and found to have
  none (refund policy text with no buy button; a free desktop-installer page)
  — left open. `/creators` documents itself as carrying no prices — left open.

Added regression tests to `lib/store-shell.test.ts` (probed both ways).

SPEC IMPACT: None.
