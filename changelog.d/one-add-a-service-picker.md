## 2026-11-12 · feat(services): ONE Add-a-service picker — sign-up and the dashboard draw the same one (ruling 5820)

The sign-up picker (`/open-shop`) moves unchanged to `app/_components/service-picker.tsx`, and the dashboard's New service (`/vendor-dashboard/services/new`) now opens on it. Every behaviour of the sign-up picker comes along: search with the reviewed aliases, "Close matches — did you mean", the category photo tiles, a category's services as rows, and a one-service category added on the tap. The tree read (aliases, category photos, ⓘ hints) moves from `open-shop/page.tsx` into one loader, `lib/service-picker-tree.server.ts`, and both pages call it.

Added on the dashboard only:
- **On your shop.** Services that already have a card on the shop show in the rows marked "On your shop". They are not buttons, so they cannot be picked twice. A category whose only service is on the shop opens when tapped instead of adding it.
- **Make N cards.** Picks gather above the picker as rows; the house swipe removes one. One "Make N cards" press opens the shipped Card Maker for the first pick and queues the rest (`?then=` → hidden `card_queue` → `commitVendorService`). Each successful create opens the next maker. A refusal stays on the same card and keeps the queue. Nothing is written for a card the supplier has not made. The queue is shape-checked and capped (`lib/card-queue.ts`, `lib/card-queue.test.ts`).
- **Specialties stay optional.** Each card's Details fold asks for them, as before.
- The blank Card Maker is one press away ("Start a blank card"). It opens straight away when the supplier arrives from a quote (`?quote=`). Today's setup sheet still draws the maker on its own, without the picker.

Guards are retargeted to the moved file, none weakened. The onboarding button ratchet keeps scanning the shared picker (`SHARED_SIGNUP`), and the gate-walk test checks the aliases in the shared loader. The generated baselines (no-card, port controls, ugat screens) were regenerated for the move.

SPEC IMPACT: None — implements ruling 5820 as briefed. The taxonomy data is untouched.
