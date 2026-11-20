## 2026-11-20 · feat(event-hub): one guest bar per stage — the /hub second bar goes, Post Event gets Suppliers

Controller ruling under owner delegation, 20 Nov 2026 (DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED", its last sentence; drawing `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` › "Bottom bars, per stage").

- **The Day keeps ONE bar: Live · Home · Camera · Memories · Me.** `/[slug]/hub` no longer draws its own screen and bar (Live · Watch · Camera · Memories · Me · More). The address stays and sends each visitor to the event page's matching tab (`dayHubLanding`, `app/[slug]/_lib/day-hub.ts`): Live, Watch, Schedule and Directions → Live; Camera → Live (the bar's Camera is one tap); Memories → Memories; Me → Me. After the day it lands on the recap (`#site-gallery` / `#site-me`). The stage and door rules are unchanged: a guest before the day goes to the stage's page, a signed-in host still rehearses The Day (`?phase=event`).
- **Post Event: Recap · Film · Suppliers · Memories · Me.** The Camera tab leaves after the day for everyone (the couple and a Papic-on guest too); Suppliers keeps the slot the five-tab cap used to take from it. The camera itself is untouched. `STAGE_BAR.editorial` drops `camera`; `resolveSiteNav` pushes no camera when `phase === 'after'`.
- Save the Date and the Invitation are unchanged. A booked supplier's "Cues" tab on the day is unchanged.
- Removed with the second screen: `HubShell`'s stage frame, the "Live hub" chip on both day bars (it would now open the same page), and the recap footer's "The day as it happened" link (after the day `/hub` is the recap itself).
- **Nothing lost:** `/find-my-table` ("See the venue map →") was linked only from the hub's seat tile; the link now sits under the event page's own seat block. The footer's "Happening now" goes straight to `?tab=live`.

Guards: `site-nav.test.ts`, `the-post-event-bar.test.ts` and `the-day-hub-follows-the-stage.test.ts` pin the new rules (every old `/hub` tab lands; the hub draws nothing; Post Event has no Camera tab; the venue map keeps its door). Guards that listed `/hub` as one of their surfaces drop it, with every check on the remaining surfaces unchanged.

SPEC IMPACT: None new — the ruling is already the DECISION_LOG row named above.
