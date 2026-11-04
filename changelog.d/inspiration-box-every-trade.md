## 2026-11-02 · fix(inspiration): the inspiration box is open to every trade

Owner 2026-11-02, the supplier gate ("creating services, service cards and inspiration box"); audit G5. `moodboardLibraryAccessForProfile` refused every shop whose services supply no inspiration part (`no_supplying_trade`), so lights-and-sounds, hosts, transport and the other trades with no part could not use one of the gate's five things.

- New `libraryUploadVerdict` (`lib/moodboard-gallery-upload.ts`): the trade rule stands for a shop that supplies any shelf; a shop that supplies none may file under any supplier shelf until its trade has one. A part with no supplying trade (the palette) stays refused. Photos are still screened and approved before couples see them; the rights tick is unchanged.
- Used by `uploadableSlotsForShop` (so the page, Today, Shop, Settings and first steps all open) and by the library upload and import. A couple's inspiration suggestion keeps `slotUploadVerdict`, the rule its SQL mirror holds.
- Guard `lib/the-inspiration-box-is-open-to-every-trade.test.ts`; `the-moodboard-card-reaches-every-trade.test.ts` now asserts the card shows for a trade with no shelf.

SPEC IMPACT: None — interim until "inspiration parts for every service" (DECISION_LOG 2026-10-28) is approved and added in Admin › Categories; then each trade gets its own shelves and this fallback stops applying to it automatically.
