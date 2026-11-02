## 2026-10-02 · feat(maker): the Maker in 4 — Exit · Page ▾ · Look · Details · Undo · Phone · Apply · ⋯

Builds the approved simple Event Hub Maker toolbar (`prototypes/maker_in_four_2026-09-30_fable.html`;
DECISION_LOG "THE MAKER IN 4 IS A DIRECTION, NOT A COUNT", "✂ THE MAKER RE-PLAN IS CUT TO ITS
CORE", "IN THE EVENT HUB MAKER, NOTHING TAKES EFFECT UNTIL APPLY", "SIMPLIFY FIRST, THEN TOUR",
tracker answer d15) — FIRST_TIMER_TEST_2026-10-02 task H2 ("Make the invitation", scored HARD),
fixes 4, 5 and 6. Extends the shipped `maker-shell.tsx`; nothing redrawn.

- **The bar is exactly** Exit · Page ▾ · Look · Details · Undo · Phone · Apply · ⋯
  (`MAKER_TOOLBAR`, `maker-bar.ts`). One row from `md`; two lines on a phone by CSS `order`
  alone (Exit · Page ▾ · Undo · ⋯ / Look · Details · Phone · Apply) — same DOM, never a second bar.
- **Page ▾** is ONE `PickMenu`: the five stages (Save the Date · RSVP · Invitation · On the Day ·
  Post Event) as groups, each with its guest pages in the guest bar's own words and icons
  (`makerGuestPages`). The stage row and the navigator's own Page ▾ are removed; a pick jumps the
  canvas through the work area's existing `jumpToPage` (`MakerState.guestPages` / `pageJump`).
- **Look · Details · ⋯ › Prints** are three doors into the ONE Details page (`makerPressDoor`),
  each on its part; exactly one is lit; pressing the open one closes it.
- **"Your info" retires as a name** (d15): `MAKER_DETAILS_LABEL`, the page title and every Maker
  string a person reads now say **Event Details** (plus the onboarding venue line, the printed
  menu placeholder and Our Services' "where it lives" lines).
- **⋯ holds the rest**: Add a scene · Play this scene · Preview the whole stage · Scenes · Phone
  and desktop (Both) · See it as… · Prints · Restore · Reset this stage… · the address · who can
  view · About the Maker. Restore is the draft bar's own act, registered with the shell
  (`MakerState.draft`); the draft bar's second ⋯ is gone and Apply wears the change count.
  The "Snap grid" note row (no control) is removed.
- **First open**: no slide tour and no Pro pitch — one quiet line on the canvas, "Tap anything to
  change it", gone at the first touch (which records the tour as seen). `customer_event_hub_maker_v1`
  is two slides with no Pro; it plays only from ⋯ › About the Maker. Post Event's own hint now
  mounts only once the couple is on Post Event.
- Guards: new `the-toolbar-is-the-maker-in-four.test.ts` holds the RENDERED bar to exactly the
  approved items (sabotaged once: a Scenes button put back → 3 red). It replaces the retired
  bar's three guards; every "lose nothing" ledger re-points each old control to its new home.
  `port-control-baseline.json` regenerated (removed: `MakerBar`, `MakerPlayMenu`,
  `AddSceneTool`, `ComingNext`, `MakerPagePick`).

SPEC IMPACT: None
