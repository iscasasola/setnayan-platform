## 2026-10-08 · feat(ui): the Form row, the ⓘ explanation and the Fold — three shared templates

Owner, 2026-10-08 (the approved template gallery, `prototypes/control_templates_2026-10-08.html` § 6 · § 7 · § 10 · § 19):
*"field follow form row style"* · *"cannot edit the other. no more check just (X) tapping out is auto accept or
pressing enter"* · *"highlighted text box are required"* · *"if a text box has incomplete information or invalid.
make it shake so they can find it easily"* · *"i want this to scroll so they see the whole content of the message.
pause for 1 second then start from the beginning again"* · *"should dropdown have a consistent width?"* · *"the
collapse should also animate how the Row Name returns"* · *"pill box not rounded edge"*.

- `app/_components/form-row.tsx` — `FormRows` (one pill width per list, one field open at a time) · `TypedRow`
  (the pill with a pencil; a tap opens the field across the row with ONLY ✕; tapping out or Enter keeps, ✕ or Esc
  leaves; a long message opens a taller box; an amount keeps its ₱; a long answer scrolls on its own strip, rests one
  second at each end and repeats) · `ChosenRow` (the house `PickMenu`) · `SwitchRow` (the one `SwitchTrack`) ·
  `FactRow` (a fact set elsewhere, one quiet line) · `nudgeFormRows` (a main button's press shakes what still needs
  attention). Required = the accent highlight + "Required"; red only for something wrong; a save that did not land
  says so with Try again.
- `app/_components/explain.tsx` — `Explain`: the ⓘ as its own 44-px button; a centred popup with "Got it" on a phone
  (dark, blurred, locked behind), a note under the ⓘ on a computer; one open at a time.
- `app/_components/fold.tsx` — `Fold`: opens downward, the arrow turns, one open at a time, what is inside stays
  mounted.
- `lib/form-row.ts` — the rules, pure (`keepOutcome`, `longAnswerPlan`, `amountWords`, …).
- `app/globals.css` — the row's motion (open, fold back, the name's return, the shake) at the press family's one
  speed; none under reduce motion.
- `lib/the-form-row.test.ts` — ten tests, nine mutations seen red. The three files join `TEMPLATE_FILES` in
  `lib/the-accent-is-one-token.test.ts` (no accent colour is written by hand).

No screen wears them yet — Studio › Info is next on this branch. No data, no request, no migration.

SPEC IMPACT: None (builds what `INTERACTION_RULES.md` § 9 and the approved gallery already say).

## 2026-10-08 · feat(studio): Studio › Info is Form rows — what must be typed first, the rest under "More for guests"

Owner, 2026-10-08: *"so first, Info. redesign it based on our rules similar to look? no preview needed since info is
just form. but how each row is presented there and create a selector if needed."* · *"prioritize only what they need
to input here"* · *"field follow form row style"*. Designer's map: `STUDIO_INFO_REDESIGN_2026-10-08_fable.md`.

- **Event name** — still ONE row that opens the two people in place (owner 2026-10-07); inside it each name is a typed
  pill and Name style a dropdown (`OpensRow`, new in `form-row.tsx`). A first name is required; the row arrives open
  only while one is missing. `studio-event-name.tsx`.
- **Date · Venue** — one quiet line each (`FactRow`): the value and "Set when you book your venue in Suppliers".
- **Opening line** (+ Start from ▾) · **Special message** · **What to bring** — typed pills; a message opens the
  taller box. `studio-info.tsx` (new).
- **"More for guests"** — ONE fold holding the Event Hub address (the shipped `SlugField`), Go live, Who can view ▾,
  Which version guests see ▾, Event Bar, Show the event QR with the QR's look and Copy · Share · Download. One amber
  line, once, names the rows that change the live Event Hub at once. `StudioHubSettings` in `studio-tools.tsx`.
- Info's two small-capital headings ("Your event", "Your Event Hub") are gone — the page opens on its first input.
- **Saving** — which rows are live and which wait for ✓ Apply is unchanged, with ONE exception the designer found:
  the Opening line's black Save (it posted the whole print-words form) is gone from Info; the line is drafted on its
  own key, `print_details.opening_line`, which ✓ Apply already publishes. The words form's own field stays in the
  page, hidden, so a Prints save still carries the line.
- **Requests** — a kept answer is ONE draft write and no render of the Maker (`studioDraftKeep`: `makerRedrawSave` +
  `makerLatestWrite` + the Apply bar in the answer). Names, Name style, What to bring and the QR switch each brought a
  whole-Maker render per save before.
- `lib/studio-details.ts` — the server-drawn skin steps aside for rows (no heading, no band padding, never the old
  14-px box on a row's own field).
- `lib/studio-info-wears-the-form-row.test.ts` — eight tests, nine mutations seen red, and the watch
  (`FORM_ROW_SCREENS`) a later builder extends. Six existing tests brought to the new rows;
  `scripts/port-control-baseline.json` regenerated (`StudioWhatToBring` → `StudioWords`).

SPEC IMPACT: None applied by this change. For the owner: the designer's four open questions were answered with the
safe defaults (Who can view stays on Info; live/draft unchanged but the Opening line; date and venue quiet lines).

## 2026-10-08 · fix(studio): Info — no bare "QR code" heading, a message's ✕ on its name's line, Go live under its name

Seen on the review copy at 375 × 812 (controller + builder): with "More for guests" shut, a bare "QR code" heading
showed under the fold with nothing beneath it (the QR had moved into the fold; the form's last field now holds only
Restore · Reset… · About, with no heading). A long message's ✕ moves from under the box to the name's line, at the
right — where every other row has it, and on screen with the keyboard up. The shipped Go live panel sits under its
row's name at the row's whole width instead of squeezed beside it.

SPEC IMPACT: None.

## 2026-10-08 · feat(studio): no title row under the top bar — "Studio ▾" in the pill chooses the page

Owner, 2026-10-08, with a picture of the "INFO ▾" pill row under the top bar: *"we will not have these."* · *"Tapping
studio will open a popup instead for us to choose which one?"* (and earlier, on Look: *"there is no more look title
there. make this same to the other studio pages"*).

- The slim Tool ▾ row (`StudioToolRow`) is no longer drawn on any Studio page; the page starts right under the top nav
  and has that height (the 52-px offset and the 8-px strip over a form are gone).
- Inside a Studio page the pill's Studio half is **"Studio ▾"**: a tap opens the house dropdown — a sheet from the
  bottom on a phone, a list under the pill on a computer — listing "All pages" (the Studio home) and the pages this
  event draws, in the home's order, each with its mark, its line and Ready / Missing, the current one ticked. At the
  Studio home and on the Stages side it is the plain segment, with no ▾. A pick is the same `openStudio` the row
  called: no request, no render of the Maker.
- **✓ Done stays** on Wedding March and Seat plan (`StudioDoneBar`): those two hide the top nav, so the row's ✓ Done
  was the only way out of them.
- The dev Maker lab hands Studio › Info's kept rows its save stand-in (`setStudioDraftDoor`, called by the lab only),
  so a kept name shows its tick and ✓ Apply's count rises there without a signed-in account.
- `lib/studio-pages-have-no-title-row.test.ts` — five tests, seven mutations seen red. Four guards re-aimed
  (`maker-stages-studio-ships-dark`, `studio-screens-follow-the-prototype`, `studio-followups-follow-the-prototype`,
  `selectors-are-pills-that-slide`); `scripts/port-control-baseline.json` regenerated (`StudioToolRow` →
  `StudioDoneBar`).

SPEC IMPACT: `INTERACTION_RULES.md` § 3 ("Where you are is one dropdown") now reads, for the Studio, as "Studio ▾ in
the pill" — the controller records the owner's ruling in the corpus.

## 2026-10-08 · feat(studio): the Page card — the Studio home's eleven tiles read and press like app buttons

Owner, 2026-10-08: *"we can improve the page card as well. how they can be presented — Logo / Topic / Description and
a small (i) that will give a more detailed explanation"* · *"Improve Page Card so it looks like an app button that
feels consistent with our design"*. Template: the approved gallery § 4; the eleven and their words:
`prototypes/studio_home_2026-10-08_fable.html`.

- `app/_components/page-card.tsx` — `PageCard`: the mark as an app-icon tile in the accent, the topic, ONE plain line,
  a state badge with its word (Ready · Missing), a small tag ("Full screen"), and the ⓘ as its own 44-px button
  BESIDE the card's button (never inside it) opening `Explain`. A fact that could not be read is said on the card.
- `lib/studio-page-cards.ts` — the eleven lines and each ⓘ's three short texts (what the page controls · where guests
  see it · what to do first). Two of the designer's ⓘ texts were corrected to what ships (Prints' pieces; RSVP's
  questions said without an unverified list).
- `studio-home.tsx` — the home wears it: one column on a phone, two from 768 px; eleven DISTINCT marks (Look and the
  Mood Board shared one) — and "Studio ▾" in the top nav reads the same list. `data-studio-tile`, `data-studio-done`
  and the ready count are kept. Opening the home, a card or an ⓘ asks nothing.
- `lib/the-page-card.test.ts` — five tests, eight mutations seen red. `page-card.tsx` joins `TEMPLATE_FILES`.

SPEC IMPACT: None.

## 2026-10-08 · fix(studio): "Studio ▾" lists the pages only — no "All pages" row

Owner, 2026-10-08, on the chooser: *"pop up looks good. remove the all pages."* The sheet is now exactly the Studio
home's pages (in its order, the current one ticked). The Studio home is still where Stages → Studio lands.

SPEC IMPACT: None.

## 2026-10-08 · fix(studio): Restore · Reset… · About wear the approved rows and buttons

Owner, 2026-10-08, with a picture of Studio › Info's last rows: *"we better fix the buttons here as well"*.

- `app/_components/action-button.tsx` — the Action button (kind 9, the approved gallery § 9), which had no shared
  source: `main` · `second` · `quiet` · `delete`, two sizes, and the waiting look (grey, `aria-disabled`, still a
  button — a press does nothing). Joins `TEMPLATE_FILES`.
- `StudioQuietRows` — each row is a house row (name · one quiet line · the action at the right): "Restore" is the
  second button (the waiting look when there is nothing to restore — it was faded text), "Reset…" is the delete button
  on the danger token (it was the gold `terracotta-700` family), both one size on one right edge; "About" has no
  button. `FormRow` gains `line` — a row's quiet second line.
- No handler, name or behaviour changed; nothing here asks the server. The Reset confirm itself is the draft bar's
  (`hub-draft-bar.tsx`) and is unchanged.
- `lib/studio-quiet-rows-wear-the-templates.test.ts` — three tests, six mutations seen red.

SPEC IMPACT: None.

## 2026-10-08 · fix(studio): the page cards say "moments", promise only what ships, and the lab shows their badges

- Love Story's line is "How you met, told moment by moment, with photos." (owner: they are MOMENTS, and a moment holds
  up to 3 photos); "chapter" is gone from every card and ⓘ.
- Each ⓘ text was read against what ships; reworded: Logo (no "travels into the bar"), Mood Board, Schedule, Wedding
  March, Seat plan, E-Gifts and RSVP no longer name a "Day page" / "Details page" guests do not have.
- The dev Maker lab hands the cards a mix of measured states (its stand-in, `LAB_STUDIO_DONE`), so Ready, Missing and
  a page with no badge can each be seen beside the head's count ("6 of 11 ready").

SPEC IMPACT: None.

## 2026-10-08 · fix(ui): ONE ActionButton — the quiet rows draw through the house button, which gains the waiting look

The fix before this one added a second `ActionButton` (`app/_components/action-button.tsx`) beside the house one
(`components/action-button.tsx`, the button rule, owner 2026-10-07). It is deleted. `StudioQuietRows` draws Restore
(`tone="neutral"`, the Maker's own Restore mark) and Reset… (`tone="danger"`, the Maker's own reset mark) through the
house button, 104 × 40 on one right edge. The house button gains `waiting` (additive): grey fill and word, its pill and
a line kept, `aria-disabled` (never the native `disabled`), a press does nothing — `disabled` keeps its own faded look,
so no caller that passes it today changes. A guard fails if any other file under `app/` or `components/` exports an
`ActionButton`.

SPEC IMPACT: None.

## 2026-10-08 · feat(studio): one head for every Studio page, in the top bar's place — ‹ · the page's name ▾ · ↺ · ✓

Owner, 2026-10-08, after the title row went: *"removing the header actually made me not know where we are at.. how can
we identify it without adding a row?"* → *"i think we are better off making all stages go full screen?"* · *"and make
the top nav show where we are at"* · *"with a go back button?"*.

- `StudioPageHead` (lazy, `stages-studio-parts.tsx`): inside a Studio page the top bar's first two places are **‹**
  ("Back to Studio" — the Studio home) and **the page's mark + name + ▾** (a dropdown's button named "<page> — choose
  another Studio page"; a tap opens the same chooser sheet). ↺ Undo and ✓ Apply are the bar's own, untouched.
  A name never truncates or wraps: the full name, else the short one, else the short one without its mark.
- ✕ Exit and the Stages | Studio pill are drawn on the Studio home and the Stages side only — one tap back from a page.
- Wedding March and Seat plan wear the same head: their ✓ Done band (`StudioDoneBar`) and the hidden top bar are gone.
- No row is added and nothing is drawn over a page; first-load code shrank (maker-shell.tsx 9,048 → 9,005 bytes
  min+gzip by esbuild; details-lazy.tsx 1,457 → 1,456).
- `lib/studio-pages-have-no-title-row.test.ts` rewritten (seven tests, twelve mutations seen red); five guards
  re-aimed; `scripts/port-control-baseline.json` regenerated (`StudioDoneBar` → `StudioPageHead`).

SPEC IMPACT: `INTERACTION_RULES.md` § 3 / § 8 (the Maker's top bar) — the controller records the owner's ruling.

## 2026-10-09 · feat(maker): the top bar's pill says where you are — both halves are dropdowns, always the same width

Owner, 2026-10-08, on the head that named only the page and then on the prototype of its replacement
(`public/review/studio-head-prototype.html`): *"what if we just replace the Studio with a chevron? since that is a drop
down"* · *"and we just change that name of the studio"* · *"studio is not showing drop down"* · *"Stages and Studio both
has dropdown"* · *"keep selector always balanced in width no matter what is pressed?"*

    in a stage          [ ✕ ]  [ Invitation ▾ | Studio ▾ ]      [ ↺ ] [ ✓ ]
    in a Studio page    [ ✕ ]  [ Stages ▾ | Love Story ▾ ]      [ ↺ ] [ ✓ ]

- `StudioSideSwitch` (lazy, `stages-studio-parts.tsx`): the half you are ON reads the stage or the Studio page and is
  the picked half (the accent, the one thumb); the other reads the plain word. Both carry a ▾. A tap on either opens
  that side's list and never changes side — a pick does. Names: "Stage: Invitation — choose a stage" · "Studio page:
  Love Story — choose a page" · "Stages — choose a stage" · "Studio pages — choose a page".
- The two halves are always the same width and the pill fills its place edge to edge (the 4-px side padding of its
  place is gone: 203 → 211 px at 375), so nothing in the bar moves when a stage or a page changes. A name never
  truncates or wraps: it tightens (both halves together), then a page writes its short name ("Mood Board", "March").
- The list of stages is the Stages panel's own `StageItemMenu` — its list, its sheet — drawn with no button (`bar`
  prop, additive); HERE ✓ only on the Stages side. The list of pages is the chooser sheet; the page on screen is ticked
  only on the Studio side. A stage picked from Studio goes to the Stages side at that stage (`pickSide` → `pickPage`).
- ✕ Exit is the left control everywhere: the ‹ and the page-only head (`StudioPageHead`, `StudioBack`) are gone.
- The Studio home of cards is NOT deleted, but nothing in the bar leads to it now (owner's answer pending).
- First load shrank: `maker-shell.tsx` 9,005 → 8,982 bytes (esbuild min + gzip), `details-lazy.tsx` 1,456 → 1,447.
- `lib/studio-pages-have-no-title-row.test.ts` rewritten to this rule (eight tests; all sixteen names painted, both
  sides, both ▾; twenty mutations seen red); five guards re-aimed (seven more mutations seen red);
  `scripts/port-control-baseline.json` regenerated.

SPEC IMPACT: `INTERACTION_RULES.md` § 3 / § 8 (the Maker's top bar) — the controller records the owner's ruling.
