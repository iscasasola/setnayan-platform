## 2026-11-12 · feat(service-card): an included line has no price — words only, one price per card

Owner, 11 Nov 2026: *"The inclusions should not have a price i think because if it had a price, then it should be a
service card. And this should be a bundle instead?"* · *"Yes. Let the other cards adjust as well."* · *"They only get
price for the service?"* (yes).

- **Card Maker** (`services/_components/service-list-editors.tsx` · `InclusionsEditor`, both shapes): each included line
  is one row of words. The "Worth" row, the `inclusion_worth` field and the older fold's "worth ₱" box are gone.
- **Every card render**: the summed "· ₱X free" after the Includes list is gone from the shared snapshot
  (`lib/service-card-snapshot.ts` — list rows, Find/Discover bench cards, chat cards, the maker's live preview), and the
  per-line "₱X free" from `lib/service-card-view-model.ts` (public shop page, Explore) and the 3D booth card. The
  couple-facing reads (`vendor-services`, `vendor-service-public`, `bundle-cards.server`, `service-card-maker.server`)
  no longer select the worth; bundle "what the couple gets" lines and the auto-reply carry labels only.
- **Data — hidden, not deleted.** No migration; `vendor_service_inclusions.worth_php` stays (nullable). Because the
  inclusion lists are replace-all writes, a re-save carries a stored worth forward on any line whose label is unchanged
  (`storedInclusionWorth` in `services/actions.ts`), so nothing a supplier typed is wiped. The admin plausibility
  scanner (Integrity watch, Tier 1) now reads the column itself — the only reader besides the save.
- **Left alone, by the ruling:** Extras (`vendor_service_addons`) stay priced; gifts keep "worth ₱X"; bundle pricing
  sums CARD prices (`lib/bundle-sums.ts` never read an inclusion worth). ⚠ NOT touched, flagged for the owner: the
  Bundle Maker's own "Extra inclusions" lines still ask "worth ₱" (`vendor_package_items.replacement_value_centavos`),
  and that value feeds bundle/quote money math (`lib/package-authoring.ts` money-freed sum, quote seeding in
  `messages/[threadId]/proposal-actions.ts`) — changing it changes money, so it waits for a ruling.
- 🔒 `lib/an-included-line-has-no-price.test.ts` — renders the maker (both shapes), feeds the snapshot a posted worth,
  scans 20 render/maker modules (comments stripped by `lib/strip-comments.ts`) and walks app/ + lib/ so only the save
  and the admin scanner may read the stored worth. Retired `a-worth-box-has-no-spinner.test.ts` (its box no longer
  exists).
- `dev/suppliers-lab` builds Lumina's Find card with the real `benchServiceCard` (for the shots).

Shots: `build-notes/shots/no-inclusion-worth/`.

SPEC IMPACT: The "Includes … · ₱X free" value story on the service card is retired (owner ruling 11 Nov 2026). Corpus
DECISION_LOG row to add: "AN INCLUDED LINE HAS NO PRICE — the card's one price is the service's; a priced thing is a
service card (two+ make a bundle) or an Extra." Open owner question: the Bundle Maker's "Extra inclusions" worth.
