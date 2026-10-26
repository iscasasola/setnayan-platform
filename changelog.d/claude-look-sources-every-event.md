## 2026-10-27 · fix(look): Look › Background's Source ▾ for every event — ◆ sources locked in the app without Pro, Apple's sheet unlocks in place

Owner, in the iPhone app on a free test event (Debut 18) after #6970: *"still none for the background"*. #6970 built the
main-background row (Source ▾ Colour · Scene ◆ · Video ◆ · Upload ◆) in the app only for a Pro event. Now it is built
for EVERY event (`website/editor/page.tsx`, no gate), and only the ◆ sources' door differs
(`lib/main-background-offered.ts` `mainBackgroundProDoor`): open on the web and for a Pro event; in the app where Apple
sells, the ◆ cards are locked and `IapUnlockSheet` (`COUPLE_WEBSITE_PRO`) unlocks Event Hub Pro in place; in the app
where nothing can be sold, locked with no price and no web link. Colour is everyone's. cale-ice reads Pro (an internal
host on the event — the Full Pro chain's first step), so it is open. Lab: `/dev/maker-lab?shell=1&iap=1`.
Guard: `lib/the-look-background-offers-every-source.test.ts`; five source guards follow the cards' `proOnly` door.

SPEC IMPACT: None — the owner's ruling (every event sees the sources) applied with the shipped Apple rules.
