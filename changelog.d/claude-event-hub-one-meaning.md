## 2026-08-15 · fix(naming): "Event Hub" now names exactly one thing

Follow-up to the Event Hub rename (#4444). That change made the couple's event page the
**Event Hub** and its upgrade **Event Hub PRO** — but the guest's day-of screen had carried the
title *"Event Hub · Setnayan"* since long before, so one name pointed at two surfaces.

**The collision was smaller than first reported, and this corrects that claim.** The day-of
screen only said "Event Hub" in a **fallback** state — in every state a guest actually meets it
(*Almost here* · *Happening now* · *Just wrapped*) it says something else. Two strings and four
screen-reader labels, not a competing product name.

🔑 **AND THE SCREEN ALREADY HAD ITS OWN NAME.** The chip a guest taps to open it says
**"Live hub"**, and always has. Only the browser-tab title and the accessible labels had
drifted to "Event Hub" — so this is not a new name, it is the visible one finally applied to
the places a guest cannot see but a screen reader announces.

- Tab title → *"Live hub · Setnayan"*, matching the door they came through. It stays a static
  string: a private event's name must never leak into a tab title or a bookmark on a
  deliberately unindexed page.
- The two entry chips' accessible names → *"Open the live hub"*, matching their visible label.
  They previously announced *"Open the live event hub"*, which matched neither the button nor
  the product.
- The hub's landmark labels → *"Live hub"* / *"Live hub sections"*.

Net effect: **Event Hub** is the event's space, **Event Hub PRO** is the paid upgrade, and
**Live hub** is the fullscreen day-of view inside it. One name, one thing.

SPEC IMPACT: None — the naming decision is already recorded in `DECISION_LOG.md` 2026-08-15.
No schema, no migration, no price change.
