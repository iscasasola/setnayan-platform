## 2026-10-24 · feat(hub): Me offers "Keep this invitation" first; the Event Details card leaves every page

- **Me offers the save first** (owner: *"on the me part, we start offering the linking of this event to their account"*).
  Right under Me's greeting: "Keep this invitation" · "Save it to your Setnayan account so it's on every device", on the
  shipped `SaveToAccount` (its Save button and Terms tick), the reason inside the ⓘ. Once saved: one line, "✓ Saved to
  your account". A host seeing as a guest gets nothing there (the slim host bar's ⓘ already says "Only they can save
  it"). The redrawn Me's `GuestMe plain` draws no Save of its own — one place. `me-keep-invitation.tsx`, held by
  `lib/me-offers-save-first.test.ts`.
- **No "Event details" card on any page** (owner, on cale-ice › Details as a guest: *"why do we have this details. it
  doesn't look as beautiful as the rest of the event hub. and isn't this a dupe?"*). The card (date · ceremony ·
  reception · your role · side, in every style) and the stranger's "The details · When · Where" plate are gone for
  every reader, every stage and the Maker's canvas: `OFF_THE_PAGE` (`lib/what-guests-see.ts`) is asked by the stage
  list, "What guests see" and `resolveSiteBodyPlan`, so the three agree. Role and side live on Me; date and venues in
  the Venues scene and Me's greeting. A guest whose Details had only that card gets no Details tab (the bar draws a tab
  only when a scene asks for it); a stranger's open-browse Details shows the existing empty plate. Held by
  `lib/the-details-tab-repeats-nothing.test.ts`; nine guards that pinned the card re-aimed; goldens and the port
  baseline regenerated.

SPEC IMPACT: None in the corpus files read for this change. The Maker part "The details" (`MAKER_PARTS.details`,
canvas `f:details`) is kept as a key but now draws nothing, so the Maker never offers its tile — owner call whether to
retire the part and its block look (`BLOCK_LOOK_BLOCKS` 'details') outright.
