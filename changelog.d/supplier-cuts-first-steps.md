## 2026-11-14 · feat(supplier): the first steps — sign-up on the first screen, the tour once, inspiration without the year lock

Owner-approved 2026-11-14 (DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED", specs 93ed7cd0; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html`). Cuts 1 and 4 of the supplier's eleven jobs.

**Cut 1 · Register**
- /for-suppliers: the photo stage was a scroll-driven track about 3.5 screens tall, so the first "Create your shop free" sat 3,291 px down. Now the stage is short and still at the top: the same five photos and lines, playing on a timer (`HERO_STEP_MS`). The heading, "Create your shop free", "See a real shop" and the three facts are on the first screen. With reduced motion it is one still frame, and the dots switch the person.
- The supplier tour (`supplier_spotlight_v1`) shows once. The tick box is gone, so Done, Skip or closing all record it as seen through the engine's existing path. It no longer plays at every sign-in. "Show me around" still replays it.

**Cut 4 · Inspiration**
- "In business since" no longer locks Portfolio or My moodboard designs (`NOT_A_HOLD_ON` in `lib/basic-setup-gate.ts`). Every other missing step still holds them, and the year still holds the rest of the tree until it is filled on setup.
- The Part starts on the shop's own kind of work (`slotForShopKind`): the first part, in the couple's order, led by the shop's first service's trade. A florist starts on Bridal bouquet, not Table linens.
- The Label is optional. Left empty, the server names the photo after the linked service card (else the part).
- The Part and Service menus were measured at 390 px on current main: the page stays 390 wide with either open, so there was no width fix to make.
- Help answer `add-inspiration-photos` (new "Your shop" supplier topic).

Guard: `lib/supplier-cuts-first-steps.test.ts` (sabotage-checked: removing the year exemption turns it red).

SPEC IMPACT: None (implements the approved cuts; the decision is already in DECISION_LOG).
