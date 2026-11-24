## 2026-11-24 · feat(for-suppliers): one adaptive Toolkit count, "430+ tools and templates", computed and rounded down

This is a re-cut of #8255 onto main's Toolkit port, carrying only its own feature.

- **One reader:** `lib/supplier-toolkit-count.ts`.
  - `toolkitTotal` adds what the app ships, each item once:
    - the Toolkit's own list, counted by its one reader `toolkitCounts` (widgets, payment-plan and availability templates, QR designs, graphs, badges);
    - the admin's starting card templates, read live (`readCardTemplateCount`);
    - the hub tools that are not widgets;
    - the print designs and pieces;
    - the availability styles.
  - `toolkitClaim` rounds it down to the nearest 10 and adds "+". On today's seed that is 321 + 116 = 437, shown as "430+ tools and templates".
  - An unread template count draws no number, never "0+".
- **The page shows that one count and no other total.** The "See all" sheet lists every item of the one Toolkit list by name (`toolkitShelves` reads `toolkitItems`). No shelf carries a second number, and main's per-shelf `toolkitCountLine` is gone.
- **Tags** are main's: Paid, Built in or Free. "Buy each once" stays as main words it.
- **Guards:** `app/for-suppliers/the-toolkit-claim-is-true.test.ts` runs the reader on the seeded templates.
  - It holds the honest total at 390 or more.
  - It checks the rounding is down, never up.
  - It checks the page draws the claim once and never calls the set "free".

SPEC IMPACT: None. This builds specs DECISION_LOG 2026-11-24, "The Toolkit count follows the real total, rounded down". The drawing's "390+" was a stand-in, and the /for-suppliers drawing session is updating its count line to follow this one.
