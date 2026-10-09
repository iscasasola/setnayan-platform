## 2026-10-09 · feat(maker): The Day's toolbar is the approved prototype's — the Camera is a full-screen page with its three looks

The new Maker's toolbar (Edit · Style · Background · Animate, phone only, behind `makerStagesStudioEnabled`) on **The
Day**, part by part, against the approved prototype (`public/review/studio-head-prototype.html`, walked headless at
375 × 812 and 375 × 667) and the owner's rulings (`Maker_Two_Bars_LOCKED_2026-10-09.md`, "The Day › Camera").

**The Camera** (owner: *"Camera is a full screen design"* · *"edit is greyed out too. only have style"*)
- It could not be picked at all: its page was a small grey shape with no marker, nothing was picked on arriving, and
  every tool was "live" over four empty rows — the three looks were unreachable.
- The Camera's page IS the camera now: one part, edge to edge above the guests' bar, drawn from the camera's own
  pieces in the look picked (`stage-panel/camera-page.tsx`, `camera-face.tsx` — the same mechanism as the Reveal:
  drawn into the Maker's canvas from the lazy toolbar; nothing in a guest's page, and the live camera is still never
  opened in the Maker). It is picked on arriving and by a tap; picked, its frame is inside its edge.
- Only Style is live. Edit, Background and Animate are grey and each says the prototype's own line (*"Nothing to
  edit on the camera."* · *"The camera is the whole screen."* · *"Nothing to animate on the camera."*).
- Style is the three looks that exist — Classic · Your brand · Challenges — as the toolbar's Style cards over all
  four rows (`StyleCards` gains a `picture` render so the Camera draws no card of its own). A pick shows on the card
  and on the page at once. The prototype's **Minimal** and **Film** are a proposal the app does not have: not built.
- What a pick saves is unchanged (`{ events: { style_preferences: { camera_look } } }`, intent `save`). It now goes
  through the draft door the work area lends — `hubDraftAction` itself on a real event — so it can be tried on the lab.

**Happening now** — Style slid over four empty rows; it is grey now and says *"Style has nothing to change on this
part."* (`MAKER_PARTS_NO_LOOK`, `lib/maker-parts.ts`).

**Left as shipped, and named** (`lib/the-day-toolbar-is-the-prototypes.test.ts` `NOT_AS_DRAWN`): the prototype draws
"Open in Studio › Look" on the Reveal and Happening now and "Open in Studio › Prints" on the pass — Studio has no place
behind the first two, and the pass's ticket style is picked right there under Style (which the prototype greys). The
Day's Gallery has no look cards (the prototype's three are tagged NEW — a proposal). Background and Animate on the
fixed blocks stay grey (another builder's work).

**Lab** — `/dev/maker-lab` draws The Day as the real canvas files it (`app/dev/maker-lab/guest/lab-day.tsx`): five
pages, the day's own parts on the page the one filing puts them on, the Camera a page. Dev-only.

Guards: new `the-day-toolbar-is-the-prototypes.test.ts` (5; eight sabotages seen red and restored). Re-aimed, each with
its reason in place: `every-style-card-is-phone-shaped` (the Camera's cards joined the toolbar's Style cards),
`the-stages-panel-is-the-prototypes`, `a-tool-with-nothing-to-do-says-so`, `the-toolbar-is-four-rows`,
`the-preview-only-selects`.

First load: nothing added. The new modules are imported only by `stage-tools.tsx` and `stage-panel/camera-look.tsx`,
both reached only through `details-lazy.tsx`'s `dynamic()` (chunk `maker-details`); guard (5) holds that. `next build`
was not run.

SPEC IMPACT: None.
