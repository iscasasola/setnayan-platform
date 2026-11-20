## 2026-11-20 · feat(event-hub): The Day keeps one guest bar — the /hub second bar goes (the Post Event bar is left as shipped)

Controller ruling under owner delegation, 20 Nov 2026 (DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED", its last sentence; drawing `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` › "Bottom bars, per stage").

- **The Day keeps ONE bar: Live · Home · Camera · Memories · Me.** `/[slug]/hub` no longer draws its own screen and bar (Live · Watch · Camera · Memories · Me · More). The address stays and sends each visitor to the event page's matching tab (`dayHubLanding`, `app/[slug]/_lib/day-hub.ts`): Live, Watch, Schedule and Directions → Live; Camera → Live (the bar's Camera is one tap); Memories → Memories; Me → Me. After the day it lands on the recap (`#site-gallery` / `#site-me`). The stage and door rules are unchanged: a guest before the day goes to the stage's page, a signed-in host still rehearses The Day (`?phase=event`).
- **Post Event is left as shipped** (Recap · Film · Suppliers · Memories · Me for a guest with Papic off; a Papic-on guest and the couple keep their Camera, and Suppliers yields first under the five-tab cap). This PR first dropped Camera there; that was taken back out on 20 Nov, because DECISION_LOG "POST EVENT LEAVES THE EVENT HUB" (2) supersedes the same day's call on that bar. `stage-bar.ts`, `site-nav.ts`'s `phase === 'after'` branch and their tests (`site-nav.test.ts`, `the-post-event-bar.test.ts`, `papic-on-camera-every-stage.test.ts`) match `main` again.
- Save the Date and the Invitation are unchanged. A booked supplier's "Cues" tab on the day is unchanged.
- Removed with the second screen: `HubShell`'s stage frame, the "Live hub" chip on both day bars (it would now open the same page), and the recap footer's "The day as it happened" link (after the day `/hub` is the recap itself).
- **Nothing lost:** `/find-my-table` ("See the venue map →") was linked only from the hub's seat tile; the link now sits under the event page's own seat block. The footer's "Happening now" goes straight to `?tab=live`.

Guards: `the-day-hub-follows-the-stage.test.ts` pins the new rules (every old `/hub` tab lands; the hub draws nothing; the venue map keeps its door). Guards that listed `/hub` as one of their surfaces drop it, with every check on the remaining surfaces unchanged.

SPEC IMPACT: None new — the rulings are already the DECISION_LOG rows named above ("EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED" as amended by "POST EVENT LEAVES THE EVENT HUB").
