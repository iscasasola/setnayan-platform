## 2026-11-10 · feat(portfolio): the approved Portfolio — Apple Photos › Collections, who-sees-it in its own ⚙

The supplier Portfolio (`/vendor-dashboard/collections`) is redrawn to the owner-approved prototype
(`prototypes/shop_discounts_bundle_card_open_2026-11-09/portfolio.html`, artifact SwnvjGzHNhgHML7X34F3fL v3;
DECISION_LOG 2026-11-09 "PORTFOLIO IS REDESIGNED AFTER APPLE PHOTOS › COLLECTIONS" + "PORTFOLIO PROTOTYPE APPROVED FOR
BUILD 5"; 2026-11-11 "SUPPLIER ASKS b–e ANSWERED" (c)(d)).

- **Sections** (`portfolio-sections.tsx`, new): every collection is a titled section — › opens it, ˅ folds it (the
  house rise token, the shut body `inert`) — with a rail of large photo tiles, the name on the photo. Order: On my page ·
  Service cards · Albums by event · Your own shots · Delivered to couples · Instagram · Moodboard library · Song bank ·
  Stories couples published · Video links · More (a 2-column pill grid: All photos · Video links · Inspiration you
  curated). Lane E's cards are reorganized into these rails; none dropped.
- **Empty collections**: never hidden — a greyed Example tile (the shared `ExamplePreview`, sample in
  `lib/empty-look-samples.ts` `SAMPLE_PORTFOLIO`) and one placeholder tile with the honest line and the one door. On my
  page's door is **Upload — the device picker in place** (`PortfolioUploadDoor`, the ONE uploader). A refused read says
  "Couldn't load" and wears no Example.
- **Who sees it** moved into the Portfolio's **own ⚙** (`portfolio-settings.tsx`): Who sees each collection (On my page ·
  Private · Shared with a couple), the page switch as a Your-page draft change (unchanged rule: nothing reaches couples
  until Apply), and **Show plays** as one dropdown (was a ✓ per row). Not Shop › Settings.
- **Dropped** (approved (6)): the "Everything" filter (`COLLECTION_FILTERS`, `filterRows`) and "N collections · one
  place" (`collectionsLine`).
- **Opened collection** (`portfolio-groups.tsx` `OpenedCollection`): the one in-body panel, its name wrapping to two
  lines (`BodyPanel titleLines`), a full-bleed 3-column grid with 2-px gaps (`BodyPanel bleed`), and a tapped photo opens
  Show on that photo (`PortfolioShow start`). Video links open the shipped editor in the same panel.
- **Fix**: the hidden pinned row lay over the band's ⚙ and swallowed every tap on it; it now lets taps through.
- Tour: the "Show which collections" stop became "Who sees what" on the ⚙ (`collections-gear`).
- Guards: `the-portfolio-is-collections.test.ts` (new — ⚙ placement, dropped filter, section shape, 16-px gutters,
  full-bleed opened grid) and `an-empty-portfolio-looks-finished.test.ts` (rewritten to RENDER the list: every section
  kept with its Example and one door, Upload is the in-place picker, refused reads honest). Updated with the move:
  `the-portfolio-is-all-media`, `your-page-applies-once` (4 now reads the ⚙), `every-palette-part-reaches-the-supplier-library`,
  the tour + spotlight anchors, `supplier-collections.test.ts`. Port and Ugat baselines regenerated.
- Deferred (NEW, listed on the PR): "Your best work" (per-photo view counts), Reorder (a stored section order), the
  photo viewer's slide and Share → Send to a chat, Select.

SPEC IMPACT: None — builds the approved prototype and the 9 Nov / 11 Nov rulings as recorded; no decision changes.
