## 2026-11-13 · fix(service-card): hidden items are dropped on the server · a failed hides read fails closed · a failed hide save says so · the retired section name is gone (PR #7554 audit)

Four fixes to the grown card's hide-per-card (ruling 5970), from the controller's audit of #7554:

1. **Dropped on the SERVER, not hidden in the UI.** The page used to send every card *with* its hidden items plus a
   `hiddenOnCard` list, and the browser left them out, so a couple's HTML still carried every photo, clip, event line
   and inspiration look the shop had hidden. Now `cardWithoutHidden` (`lib/service-card-hides.ts`, pure) strips them
   in `ServicesPricingSection`, after the inspiration looks are attached and before the cards reach `ServicesGallery`.
   The refs and the hidden-key list no longer ride along either. Only a viewer who runs the shop gets the unstripped
   card. That check now happens on the server (`viewerRunsShop`: `current_vendor_profile_ids()`, the same gate RLS
   uses for the write, fail closed), and the client's `card_owner` op reuses it.
2. **A failed hides read fails closed.** `readCardHides` returned an empty map on error ("nothing hidden"), which drew
   everything the shop had hidden straight back onto its cards. It now returns `{ status: 'error' }`. Every card then
   loses its hideable items (showcase photos, clip, event lines, inspiration looks; facts, cover fallback and reviews
   stay) and carries `hidesUnread`. The grown card says so in one line: to couples, "Some of this card's photos and
   events couldn't load right now"; to the shop, that what it hid couldn't load and the items are left out until it does.
3. **A hide save that fails says so.** The toggle used to flip at once and silently flip back on a refused or failed
   save. It now flips only after the save succeeds, marks the item busy (disabled, `aria-busy`) while it saves, and
   draws a `role="alert"` line on failure (`cardHideSaveError`: "That change wasn't saved. It is still showing on this
   card. Try again." / "…this account can't change this card.").
4. **One name: Events.** The owner ruled that what the card called a separate section is Events. The retired word is
   gone from the grown card's docblock and from this PR's fragment, and a test keeps it out of the card's files.

Tests: `lib/service-card-hides.test.ts` (fixes 1–3) and `app/v/[slug]/_components/the-service-card-grows.test.ts`
(fixes 1, 3, 4). Also merged `origin/main` and regenerated the exposure baseline, which adds only
`vendor_service_card_hides`.

SPEC IMPACT: None. Corrects the implementation to the approved prototype and the owner's rulings; no decision changes.
