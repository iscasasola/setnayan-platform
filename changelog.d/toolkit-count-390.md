## 2026-11-24 · feat(for-suppliers): the Toolkit's one count, "400+ tools and templates", adapts by itself

Owner, 23 Nov: "put 390+ tools and templates on /for-suppliers", then "Should be adaptive to a rounded off number. So when we add a toolkit, it adapts to itself". This replaces closed #8249. It is stacked on AK #8245 (the /for-suppliers redesign #8238) and #8231 (Toolkit v19 PR 2), so merge it after both.

- **One reader, one formatter** (`lib/supplier-toolkit-count.ts`):
  - `toolkitTotal(cardTemplates)` adds the live starting card templates (`readCardTemplateCount`, a head count of `service_included_templates`, one more read in the page's single `Promise.all`) to what the code ships, each item once.
  - `toolkitClaim(total)` rounds DOWN to the nearest 10 and adds "+": 394 → "390+", 401 → "400+", never up.
  - A refused count draws no number ("Your Toolkit, ready to use."), never "0+".
  - No literal "390+" anywhere: `TOOLKIT_CLAIM_FLOOR = 390` is only the guard's floor.
- **One count on the page.** The Toolkit part's headline is that claim. The old "N in the Toolkit: …" line and the per-shelf numbers in the See all sheet are gone.
- **The sheet is the one Toolkit list.** `toolkitShelves(papicCapture)` reads #8231's `toolkitItems` (resolving the redesign's TODO):
  - widgets, QR designs, graphs named by `STORE_GRAPHS`, and badges;
  - the Papic camera only while its privacy switch is on;
  - tags per owner a02673ac: a paid widget is Paid, everything else Free, and My page's code and the badges are Built in.
- **Paid widgets are bought once (a02673ac).**
  - The special tools' start date is no longer read on /for-suppliers.
  - The plan card's line is the drawing's "Paid tools: buy each once. They work while you're subscribed."
- **Today's honest total is 402 → "400+".** That is 321 seeded card templates · 17 widgets (Papic camera off) · 10 other shipped hub tools · 17 graphs · 5 badge families · 6 QR modes · 15 print designs · 7 print pieces · 4 availability styles. Payment splits are left out: their presets live in a client component.
- **Guard:** `the-toolkit-claim-is-true.test.ts` runs the same reader on the seeded templates. It checks:
  - the honest total is ≥ 390;
  - one more template moves the total;
  - the rounding rule;
  - an unread count draws no number;
  - the page draws the claim once, with no second total and no "free".

SPEC IMPACT: The /for-suppliers Toolkit count line is now the adaptive "N+ tools and templates" (owner rulings 23 Nov). This supersedes the /for-suppliers half of DECISION_LOG 5ae3fbb2; the live per-shelf count stays on the Toolkit masthead. Controller to log the DECISION_LOG row.
