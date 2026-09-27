## 2026-09-27 · fix(maker): empty scenes stay on the Maker canvas; "Two ways to celebrate" leaves the Maker too

Owner, 2026-09-27, on his own page: *"i still cannot edit. the editing body page is not working at
all."* Measured live: his Love Story, Venue and Message were **empty**, so the Maker's canvas drew
nothing for them and they sank into "Not shown on Invitation". The scenes he most needed to fill
were the ones he could not tap.

- **An empty scene keeps its place in the Maker**, on the canvas and in the navigator. It is drawn
  as its name and one line saying what to add ("Add your story.", "Write your message.", "Add the
  moments of your day in Schedule."), marked "Empty · tap to fill" in the navigator, and a tap opens
  its panel like any scene. `MakerEmptyScene` renders it; `makerEmptyPrompt` and `makerDrawsEmpty`
  in `lib/maker-scene-list.ts` supply the text and the rule. In the Maker the plan fails open on
  content, so an empty scene is never dropped before it reaches the dispatcher.
- **Guests are unchanged.** An empty scene is still skipped on their page, and the placeholder
  markup never reaches them (`makerEmpty` is set only when `isMakerCanvas`).
- **"Not shown" is now only** for scenes the couple hid, scenes this stage leaves out, and scenes
  that only render on a guest's own link.
- **"Two ways to celebrate" is gone from the Maker** on the Invitation and On the Day, exactly as
  guests see it (owner review 2026-09-27). One rule, `widgetsGuestsMeet`, is read by the page and by
  the navigator; the Maker-only exception in `site-body.tsx` is removed. Post Event keeps it; that
  is a separate owner decision.
- The navigator no longer claims the schedule is left out on the day. The page has drawn it on the
  day since the owner's 2026-09-27 "YES TO ALL" (2).

SPEC IMPACT: None. This implements the owner's 2026-09-27 Maker rulings as relayed by the
controller. `the-navigator-follows-the-page.test.ts` is re-anchored to them, citing each ruling.
