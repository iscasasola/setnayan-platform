## 2026-10-30 · feat(maker): Event Hub Pro slice 3 — Studio ▾ is Logo · Palette + Dress Code · Love Story (· Prints until #7020)

Builds the Studio slim-down of the approved Event Hub Pro look redesign (DECISION_LOG 2026-10-27 "STUDIO IS LOOK AND
WORDS ONLY — LOGO · PALETTE + DRESS CODE · LOVE STORY · PRINTS"; 2026-10-30 "EVENT HUB PRO (look redesign)"; prototype
`prototypes/build-contracts-2026-10-30/event-hub-pro/` "Studio ▾ open"). Owner: *"Stages and the Studio will be on
dropdown. move all other details on the settings."* Stacked on slices 1, 2 and 4 (the ⚙ must hold Look and E-Gifts
before they leave the menu).

- **Studio ▾ lists `STUDIO_MENU_KEYS`** (lib/studio-tile-defs.ts): Logo · Palette + Dress Code · Love Story — and Prints,
  left for PR #7020 ("PRINTS LEAVES STUDIO") to take out with its own page. The Studio home's cards list the same, and
  "n of N ready" — now at the list's heading too (LOCKED 2026-10-09 decision 6) — counts only these, so it never says
  "Missing" about a page the menu does not show.
- **The others stay pages the Maker opens, each from its new home — every door still lands:** Look and E-Gifts from the
  Hub's ⚙ (slice 4); Info's facts are Home › Event settings and its address the Hub's ⚙; Schedule → Suppliers › Booked
  is another builder's move (its page opens from every door that names it until then). `STUDIO_TILE_KEYS` is unchanged.
- **"Mood Board & Dress Code" is "Palette + Dress Code"** (short "Palette") — the Studio page, its part door ("Open in
  Studio › Palette + Dress Code"), the dress-code notes that point at it and two Help answers. The inspiration part's
  move to Suppliers › Find is another builder's.
- Look's own item ▾ in the lower third lists Studio ▾'s pages and Look (the page it is on).
- **Studio ▾ ends with "Event Hub Settings"** — the prototype's last row: after a hairline, "Event Hub Settings · Look ·
  address · QR · who can view · E-Gifts"; it closes the list and opens the pinned row's one ⚙ sheet (`moreOpen`), so
  what left Studio is found from where it used to be. A row of the list, not a page (never counted, never ticked).
  Guard: `lib/studio-menu-ends-with-hub-settings.test.ts`. Carries slice 4's redraw of ⚙ › Your Event Hub (merged in).

Guards re-aimed to the ruling: studio-tiles (1 · labels; new 1b · the menu), studio-pages-have-no-title-row (the home's
cards, the switch's list, the short name, the "ready" heading), studio-followups-follow-the-prototype,
edit-types-the-words-in-place, the-day-toolbar-is-the-prototypes.

SPEC IMPACT: builds the 2026-10-27 "STUDIO IS LOOK AND WORDS ONLY" row (its "NOTHING BUILT" now reads built, Prints left
to #7020, Schedule's move to its builder). Renames the page "Palette + Dress Code" as that row and the 30 Oct prototype
name it. No new ruling.
