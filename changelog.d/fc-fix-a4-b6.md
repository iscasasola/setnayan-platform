## 2026-11-25 · fix(guest): area 4's sweep members say what is true (final check, area 4, batch a4-6-sweep-members)

Final check fixer, area 4 (Guest), lane A — area 4's rows of the shared sweeps:

- Papic tier copy formats pesos only through `lib/php.ts` `formatPhp` (A4-64, SW-PHP). The ₱1-per-credit rate
  (`PAPIC_PESO_PER_CREDIT`, owner 2026-08-26) is kept: it is the ladder's definition, not a typed price.
- `/papic/order/[token]`: an unknown amount no longer draws "₱0.00" with a Copy button offering "0.00"; the page says
  it couldn't read the amount (A4-77, SW-PHP).
- `/[slug]/pabuya`: "E-Gifts" everywhere a guest reads (the header and the eyebrow; never "Pabuya"), and the footer no
  longer promises "Kept safe on Setnayan" (A4-42, A4-43, SW-WORDS).
- The E-Gifts card list drops "No commission, no middleman, no fees."; the host's arm keeps the one allowed line,
  "Hosts pay 0% commission." (A4-B12, SW-PROMISE).
- The Papic join app banner says nothing until a real store link is set — never "The app is coming soon" (A4-72,
  SW-COMING).
- The supplier desk says "Time to follow", never "Time TBD" (A4-B10, SW-PLACE).
- `/[slug]/print`: the bare fallback headline announces a marriage only at a wedding; other events print their own name
  (A4-47, SW-WEDDING).
- The request key's words take the event's own word ("the family" at a wake), and the door's two reasons need no noun
  (A4-48, SW-WEDDING).

A4-14 (SW-RAWDB) is fixed by area 2's sweep (#8323), so it is not repeated here.

Held by `apps/web/lib/area-4-sweep-members-say-what-is-true.test.ts`; `lib/request-key.test.ts`,
`lib/admin-money-and-gift-words-are-honest.test.ts`, `app/[slug]/_lib/the-wake-never-celebrates.test.ts` (one
celebratory literal re-frozen: "E-Gifts · digital money dance") and `app/[slug]/_lib/the-walked-pages-read-and-press.test.ts`
follow the new words.

SPEC IMPACT: None — wording and honest-state fixes under docs/brand.md and the existing rules.
