## 2026-10-22 · feat(pro): Event Hub Pro, part by part — the Apply sheet, the parts page, "₱X more", Studio nesting, the custom address (PR 2 of 3)

Owner rulings 2026-10-22 ("yes" / "yes to all") on `prototypes/pro_part_by_part_2026-10-22.html` (frames 1–5, 7).
Stacked on PR 1 (`rd/pro-parts-entitlements`).

- **✓ Apply sheet** (`apply-pro-sheet.tsx` + `lib/apply-sheet-parts.ts`): the held effects grouped under their part
  in the parts' order, each priced from the catalogue; "These N parts" subtotal; "Or everything … for ₱X more";
  the cap band ("You've paid ₱3,500 toward everything…", owned parts named) on the raised surface, no border; the
  buttons by the one rule (`hubApplyOffer`): parts lead while they cost less than the "more", everything leads once
  the "more" is no more than they cost, the parts are not offered above the rest. Four parts or more → one line a part
  that opens its effects. **The "Go to ↗" links are gone** (owner: no go-edit-elsewhere links) — the row is the press.
- **Buying**: one order per press — a part under its own code, several parts as one `COUPLE_HUB_PARTS` order with one
  line per part (`onboarding_order_items`, read by ownership through the basket lines), everything as Full Pro at the
  rest. The charge authority prices all three from the catalogue against what the event holds (an order under review
  counts): never above the rest, never twice (`hubPartsCharge`, `resolveHubProCharge`).
- **The parts page** (`studio/website-pro`, body in `_components/pro-parts-body.tsx`): Everything one tap on top
  (repriced to the rest once something is paid), Big parts and Small parts below, each with its line and ◆ price /
  ✓ Yours / Under review; a row opens in place with every gate it unlocks (the gate table, never a second list) and
  its own button; the Apply sheet's pick (`?buy=`) arrives as one card.
- **The quiet line** (`pro-quiet-line.tsx`): "◆ Pro parts from ₱500 · everything ₱5,000 ›" / "₱X more unlocks
  everything · you've paid ₱Y ›" / "Style is yours · …" on Look, Animate, QR and Prints; gone at everything and in
  the store shell.
- **Studio nesting** (`lib/studio-tiles.ts` `STUDIO_TILE_PARTS`): Info → Custom address · Look → Style, Background,
  Motion, Music · Logo → Logo & QR · Love Story → Photos · Prints → Prints, as a quiet "◆ … from ₱500" line, ✓ owned.
- **Custom address**: the free address shown (Copy · Share); "Pick your own ◆ ₱500" opens in place and tries the pick in
  the draft (`HubDraftState.address`), named at ✓ Apply as "Custom address"; Apply renames through the ONE rename
  (`lib/event-slug-rename.server.ts` — conflicts, the old link forwarding). `updateEventSlug` refuses a rename without
  the part. An event that renamed before keeps it ("chosen before, kept free" — `slug_change_log` is the proof).
- The Maker's theme, QR, celebration, venue-drawing and Love Story rows read their own part; onboarding's (i) adds "Or
  buy it part by part later, from ₱500"; the Studio tile's blurb gains "Or part by part"; llms.txt names the parts.

Guards: `lib/buying-pro-part-by-part.test.ts` (the charge, the sheet's groups and buttons by the prototype's numbers, no
Go to, the rename gate, Apply's one rename, the authority's keys, no typed price). Lab: `/dev/pro-parts-lab`.

SPEC IMPACT: corpus `DECISION_LOG.md` row "EVENT HUB PRO, PART BY PART" (2026-10-22, pushed with PR 1).

- Guards re-aimed to the parts page (the buy page's claims are the Everything sentence + each part's line), the one
  rename (`renameEventSlug`), and the drafted address field ("Available — ✓ Apply keeps it."); two unread Supabase
  errors now logged; the ugat screens map regenerated.
