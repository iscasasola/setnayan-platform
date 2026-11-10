## 2026-11-11 · feat(services): Shop › Services — the card, then ONE menu row under it: Edit · Share · Go online

Owner, 10 Nov 2026 (DECISION_LOG "SHOP › SERVICES: THE CARD, THEN ONE MENU ROW UNDER IT — EDIT · SHARE · GO ONLINE"), on a live phone screenshot: *"It is service card then a menu under to edit share go online"* — after asking *"Why diesn't it go online?"* (the card lacked a cover photo AND what's included; the refusal named only the photo). Build 5 Lane C.

- **The card shows full width.** The side copy icon and the side Online/Offline switch are gone; the "Edit · every field" row is replaced. Under the card, ONE `EqualRow` of three equal-width `ActionButton`s (new `services/_components/service-card-menu-row.tsx`):
  - **Edit** — the Card Maker for this card (same door, same `?offpeak` prefill). Tapping the card face opens the same place (a stretched link beside the card, so the showcase clip stays usable).
  - **Share** — the card's own public address (`serviceCardAddress`, `?service=`) through the one share helper (`shareShopLink`: share sheet, else copy, "Link copied."). Lucide `Share` icon. Waiting (grey) while the card is offline or the shop has no address.
  - **Go online / Go offline** — the shipped `toggleVendorServiceActive`, same publish gate, saved in place through its existing StayForm door. A card the plan holds reads **On hold** and opens "Which services stay on".
- **Duplicate** already lives inside the Card Maker ("Live · delete · copy" → "Start another from this"); the list no longer carries a second door.
- **A refused Go online names every missing thing at once.** New `publishRefusalFor(unmet)` in `lib/service-publish-gate.ts`: one missing → that requirement's own sentence, byte for byte (also the database's); two or more → one sentence naming all of them. `toggleVendorServiceActive` uses it. The refusal sits on its own line under the row (the form holds only its hidden fields and sits after the row; the button reaches it with `form=`), never a fourth cell.
- **Bundles untouched** — `shop/_components/shop-bundles.tsx` is its own component and does not share the service card row.
- Guard: `app/vendor-dashboard/services/the-card-menu-row-is-edit-share-go-online.test.ts` (no side switch/copy icon/"Edit · every field"; the row is exactly Edit · Share · one third cell, all ActionButtons; Go online is the shipped toggle; every unmet requirement is named; Duplicate stays in the maker). `card-row-refusal-own-line.test.ts` and `lib/vendor-card-copy.test.ts` re-anchored to the new shape.
- Lab: `/dev/service-card-row-lab` (`?v=now` · `?v=proposed`), added to the no-door baseline and the screens map.

SPEC IMPACT: HOUSE_TEMPLATES T20 ("Online / Offline worded switch — service and bundle cards only") is superseded for SERVICE cards by this ruling — service cards now say Go online / Go offline in the menu row, with no switch. Bundle cards are unchanged. Flagged for the corpus; not edited here.
