## 2026-10-07 · fix(maker): the Stages panel's owner preview faults (behind `makerStagesStudioEnabled`)

Owner, on the preview of #6398 — fourteen faults, fixed on top of #6401's one style registry (`lib/scene-styles-parts.ts`, page-drawn look pictures):

- **A canvas tap only picks; it never jumps to Studio.** The four doors (words, Logo mark, schedule moment, fact editors) are fenced under Stages; the Style bar's quiet bar is the only door, and it opens the EXACT Studio field (`MAKER_PART_FOCUS` / `makerPartStudioDoor`) with "✓ Done · back to <Part>" returning to the same stage and part, draft kept.
- **Typing on the second tap on any words** — one keyboard bar (Typing · <Part> · Done).
- **Animate:** five How it moves presets + "Custom" (not "Its own"); Duration and Delay sliders 0–2 s; the Does line under Does; "◆ Into the next scene" on a part reads "Stage default · X" and writes the scene's transition; no row is ever a lone ⓘ.
- **The page:** the lower ＋ sits on the part's frame edge, not over its words.
- Guards: `lib/the-stages-panel-is-the-prototypes.test.ts` (tap never leaves the stage, studio door mapping, Done text), `lib/every-look-draws-a-picture.test.ts` (no lone-ⓘ row, a picture per style).

SPEC IMPACT: None — the prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` is the spec. Not done, for the owner: the prototype's look NAMES/COUNTS (e.g. countdown Big number · Boxes · Offset · Line · Circle) are not adopted — `lib/layouts-are-the-shipped-scene-styles.test.ts` forbids invented families and the words 'Offset'/'Statement'.

## 2026-10-08 · fix(maker): in Stages, every tab is its own page (owner: "i do not see the individual pages")

Owner, 08 Oct, on the Maker's Stages view: *"i do not see the individual pages. i still see invitation as a 1 long page that scrolls down"* (his ruling 2026-10-07, "yes pages": *"each page is just a bookmark on a single page that just jumps. this was not the plan"*). Measured on the preview: the canvas grouped by the READER's bar, so Our Love Story (unwritten) and the day's Welcome · Camera · Gallery had no page; greeting · pass · RSVP and the day's stand-ins sat outside every group and were drawn on every tab; on Me the label read "Welcome"; the stage menu said "3 pages" over one-page canvases.

- **One page list** — `lib/maker-stage-filing.ts` `makerStagesPages`: the Maker's tab bar, the stage menu's page count and the canvas's groups all ask it (the guest bar's own pages on the tabbed stages; a stage the canvas draws as one page is one page in the Maker — Save the Date and Post Event now read "One page").
- **One filing** — `makerStagesPageOf`: each part is on the page the approved prototype's `TABS` puts it on (`MAKER_STAGE_PAGES`). In the Stages canvas only, `site-body.tsx` groups every marker by it: Our Love Story on its own page; Countdown and Message on Welcome; the guest's look and the pass on Me; the day's venue · dress code · march on Welcome, photos on Gallery, the seat on Me.
- **Every page is a page** — a page nothing is filed on draws a stand-in in its own group (the Camera: its shape, "Only you see this · guests open the camera as its own screen").
- **A tab swaps, from the top, and stays there** — the bridge confirms the tab on screen (`hubTab`), holds the page's top against the pick's own scroll, and ignores a pick meant for the page in front while it is a warm stage behind it. The "You're editing · Stage › Page" label and the underline follow the canvas's word, not the shell's guess; the Reveal's stub stands only inside the first page's own group.
- Guests untouched: with no Stages page list (`?tabs=1` on the host's editor canvas only) the tabs are the reader's own bar's, exactly `inPageTabs`.
- Guard: `lib/every-stages-tab-has-its-own-page.test.ts` (14 tests on the real functions; each sabotaged red).

SPEC IMPACT: None — the prototype's `TABS` is the spec. For the owner: (1) Post Event is ONE page in Stages until its three prototype pages (Thank you · Gallery · Gifts) are built — the after-the-day story is drawn as one page, and a Gifts tab is a guest-bar change; (2) on a guest's phone Countdown and Message are still on Details and the seat on the day's Welcome — the Maker now shows them where the prototype does (Welcome / Me), so the two differ until the guest page follows.
