## 2026-11-06 · feat(shop): Shop › Promote › Share your work — stories + recaps live in Promote

Owner, 6 Nov: *"Use fable to decide. Find the best location for each. Make the pages live there and not jump to
another menu."* — DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL", row 4: Share your work (real stories +
recaps with their Facebook / Pinterest / share / copy / story-card buttons; `/real-stories` and `/recaps` forward to
`/shop/promote#share`; out of Settings › More tools).

- RULE 0: both lists, their loaders and their buttons existed (`/vendor-dashboard/real-stories`,
  `/vendor-dashboard/recaps`, `ShareButtons`, `SaveStoryCardButton`, `loadVendorFeaturedStories`, `loadVendorRecaps`).
  Delta: one section on Promote (`shop/promote/_components/share-your-work.tsx`) with one loader
  (`share-your-work-data.ts`) that reads the pool ONCE for both lists (the two pages read it once each), read beside
  the gifts.
- Honest reads: a thrown read is `null` and is said ("Couldn’t load — reload to try again"), never "None yet". Recaps
  keep their Solo gate (same rule as the old page's `VendorTierGate`), said in one line.
- The two routes are now forwards to `/vendor-dashboard/shop/promote#share`.
- Doors removed: Stories + Recaps from the shop shelves (= Settings › More tools, 15 → 13), the "Event recaps"
  specialist tool on Services (`lib/vendor-service-tools.ts`), and the two routes from the Shop tab's `activeMatch`.
- Guards: new `shop/promote/share-your-work-lives-on-promote.test.ts`; the two empty-state guards now read the
  section and check the forwards; `vendor-room-access.test.ts` pool-read list 7 → 6 (the loader carries the reason);
  `settings-is-one-list.test.ts` 15 → 13; `gifts-live-on-promote.test.ts` follows the shared await. Port baseline and
  `lib/ugat/screens.generated.json` regenerated (deliberate removals).
- Left as is: the legacy `vendor.sidebar.real-stories` / `vendor.sidebar.recaps` rename-registry defaults (no rail
  draws them; the rail has four destinations) and `routes.vendor.realStories/recaps` (no caller).

SPEC IMPACT: None — implements DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL" row 4; no corpus edit.
