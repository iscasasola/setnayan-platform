## 2026-10-08 · feat(studio): a style card whose file must load says how much is in, holds only its own strip, and can be stopped

Owner, verbatim (2026-10-08, the template gallery; `INTERACTION_RULES.md` § 9 "Style
card while a file loads"): *"when pressed. show a loading screen 0-100 pie to know how
long til it uploads"* · *"when we are picking and the option is not yet done loading,
nothing can be pressed"* — and his *"yes"* to both of the controller's limits (a pie only
where progress is really measured; only that strip locks). Stacked on
`rd/press-feel-everywhere`. Local commit; nothing pushed.

- **The pie is a MEASURE** (`lib/pick-load.ts`), read off what the pick was already doing —
  0 requests added:
  - a picture (a scene, their photo, the cover, a clip's still): the colour read's own
    `fetch`, read as a stream — bytes so far over the `Content-Length` the server sent;
  - a film: `buffered` over `duration` of the sample screen's own `<video>` — the element
    that plays it (`LoopPicture` tells; the pick hears);
  - an upload: `FileUpload`'s own printed figure, handed up (`onProgress`, optional);
  - **no total, no pie**: no `Content-Length`, a compressed body, a film whose length is
    not known yet → no figure anywhere (the small mark stands in). A plain save shows its
    words ("Applying to your Hub…") and never a percentage.
- **Nothing under a blink**: no veil, pie or tick for a file that arrives inside ~300 ms
  (`BACKGROUND_PICK_QUIET_MS`, the line's own).
- **Only the strip waits**: while a card's file loads, the other cards of THAT strip are
  dimmed (40 %) and cannot be pressed. Source ▾, the rows under the strip, the top bar and
  Exit are untouched. This replaces "a second tap moves the ring" for a LOADING pick; a
  pick that is only being saved still locks nothing (a later pick wins, as before).
- **A tap on the loading card cancels** — "Cancelled — nothing changed". It is true
  because a file is now LOADED FIRST, APPLIED SECOND: a film's draft write waits for the
  film (it used to be sent at the tap), a picture's already waited for its colour read. A
  cancel aborts the picture's fetch / stops waiting for the film, draws the last landed
  background again, and has written nothing.
- **The 8-second stop** (`BACKGROUND_PICK_CANVAS_WAIT_MS`, the existing constant): a file
  still not in after 8 s turns the line into "This is taking longer than it should." with
  **Try again** and **Cancel**. The load is not stopped by the clock — if the file arrives
  meanwhile the pick goes on. An upload is never called stalled (it may take minutes and
  `FileUpload` watches its own silence).
- A film that will never move on this device (reduce motion, a refused play, a film that
  failed) says "ready" at once — its still stands and the pick never waits on it.

Requests: a picture pick — 1 fetch + 1 draft write (unchanged; the fetch is now
abortable). A film pick — 1 draft write (unchanged), sent after the film is playing
instead of at the tap; the film's own bytes are the sample `<video>`'s, as before. A
cancelled pick — 0 writes (was: not possible). No poll, no interval: two one-shot
timeouts (the blink, the 8-second stop).

Guards: `a-loading-pick-is-honest` (6, new) · `a-background-pick-shows-at-once` (2 lines
re-aimed, with the reason) · `the-background-has-one-source` (1 line re-aimed). 25
sabotages seen red.

⚠ Words that are the builder's, not the owner's: "This is taking longer than it should."
and the hint "· tap the card to cancel" (the gallery's own). The owner's are "Loading
files…", "Applying to your Hub…" and "Cancelled — nothing changed".

SPEC IMPACT: None (the rule is already in `INTERACTION_RULES.md` § 9).

## 2026-10-08 · feat(maker): the Maker's sheet follows the pop-up rule — dark and blurred behind, nothing behind works, a live preview stays clear

Owner, verbatim (2026-10-08; `INTERACTION_RULES.md` § 9 "Anything popped up over the
page"): *"when there is a pop up. the rest of the screen darkens (except for when there
is preview) i think you know what I mean. The darkened area will be blurred and nothing
behind it will work. pressing on the dark part removes the pop up. the background will
not be scrollable when darkened blurred"*.

- `MakerSheet` (`stages-studio-parts.tsx` — every ▾ and sheet of the new Maker on a
  phone): the dim was ink at 20 %, no blur, and the page behind stayed reachable by
  keyboard and screen reader. Now:
  - **dark + blurred** — ONE class, `.sn-popup-dark` (ink 42 % + 6-px blur, the approved
    gallery's figures); **dark alone** (ink 55 %) where `backdrop-filter` is not
    supported or the device asks for less transparency;
  - **nothing behind works** — every branch of the page but the sheet's own is `inert`
    (`lib/popup-behind.ts` `inertBehind`), put back exactly on close;
  - **no scroll behind, Escape, Tab stays inside** — the app's one modal contract
    (`useModalA11y`), called; the list's picked row keeps the focus it took, and the focus
    goes back to the ▾ that opened the sheet;
  - **a tap outside closes** — one whole-screen button under the dark;
  - **a live preview stays clear** — Studio › Look's sample wears `data-popup-clear`; the
    dark is cut around its box (`clip-path`, even-odd), measured at open and on a resize,
    never polled. So a pick in a Look sheet is seen at once.
- Requests: none added, none removed (opening a sheet asks nothing).

Also in this commit (the controller's note after the gallery was approved):
- **The picked style card centres itself** in the Background strip (owner: *"when
  something is selected, must center as much as possible"*; `lib/centre-in-row.ts`): at
  once when a strip is opened, travelling on a pick, at once under reduce motion; the
  first and last cards stop at their edge. The strip no longer scroll-snaps (the approved
  gallery's strip does not) — a snap pulled the card back off the middle.
- The loading pie's centre takes its fill and ink from the selector template's own
  constant (`PILL_ON_CLASS`) instead of writing them.

Guards: `a-popup-darkens-what-is-behind` (5, new) · `a-loading-pick-is-honest` (+1: the
centring) · `modal-a11y-adoption` (unchanged — it caught the first draft, which claimed
`aria-modal` without the contract). 27 sabotages seen red; 1 stayed green and is said in
the report (a rendered check cannot tell a constant from the same words typed out — the
accent watch in the next commit holds that one).

SPEC IMPACT: None.

## 2026-10-08 · feat(ui): the app's accent is ONE setting, named by its job — and the templates read it

Owner, verbatim (2026-10-08, right after approving the template gallery;
`INTERACTION_RULES.md` § 9 "Our colour is ONE setting"): *"if we change our color to
blue, it will be easy to change the button colors"*.

- **The token.** `globals.css` `:root`: `--sn-accent` (what is on / picked / tappable on a
  template — today `var(--color-mulberry)`, the terracotta) and `--sn-on-accent` (the ink
  of words on it — white; in the dormant dark block the page's ink-black, where white
  reads 2.9:1). Tailwind: the `sn` family (`sn.accent`, `sn.on-accent`) → `bg-sn-accent` · `text-sn-accent` ·
  `ring-sn-accent` · `border-sn-accent` · `text-sn-on-accent`.
- **To make the app's accent blue, change ONE line** in `apps/web/app/globals.css`:
  `--sn-accent: var(--color-mulberry);` → `--sn-accent: 37 99 235;`.
- **`mulberry` is NOT renamed or repointed.** The hundreds of pages not yet moved onto the
  templates still read it and are unchanged.
- **The templates moved onto it** (nothing else): `pill-selector.tsx` (`PILL_ON_CLASS` =
  `bg-sn-accent text-sn-on-accent`, same export name) · `pill-thumb.tsx` · `press-feel.tsx`'s
  ring · `.sn-switch` when on · the style card's picked ring, name and loading pie, and the
  status line's Try again (`background-cards.tsx`) · the pill selector as the Stages tool
  group and Phases draw it by hand (`STAGE_TOOL_FACE`, `SP_PHASE` in
  `lib/maker-stage-room.ts`).
- ⚠ CORRECTED in the next entry (same day): this commit first named the classes
  `bg-accent` / `text-on-accent` by repointing Tailwind's old `accent` slot (the kit's
  gold). The controller ruled that a trap; the classes are `bg-sn-accent` /
  `text-sn-on-accent` and the gold slot is back as it was. The names in this entry are
  the final ones.
- **Pixels today: unchanged** — the same terracotta, the same white words. (Dark mode is
  dormant; there the ink on the accent becomes the page's ink-black.)

Guards — `lib/the-accent-is-one-token.test.ts` (4, new): (1) the watch — a template file
holds no `mulberry`, no hex colour, no `text-white` (the list of template files is in the
test; extend it as kinds become templates); (2) the two values keep 4.5:1, computed from
the stylesheet; (3) the one line swapped to a blue in a stand-in stylesheet — every
template's "on" colour resolves to it through the real Tailwind config (resolution by
reading, not a browser painting); (4) nothing under `app/[slug]` names the token or a
template. Re-aimed with the reason: `selectors-are-pills-that-slide`,
`the-press-feels-the-same-everywhere`, `a-background-pick-shows-at-once`,
`the-background-has-one-source` (the class names they pin).

SPEC IMPACT: None (the rule is already in `INTERACTION_RULES.md` § 9).

## 2026-10-08 · fix(maker): behind a sheet ONLY the preview stays clear — not the part of its box that lies under the controls

Controller, 2026-10-08, measured on the review copy at 375 × 812: the clear hole ran
y 52 → 576, but the sample screen ends near y 432 — so the Background | Elements | Music
pill and the Source row were left bright and sharp behind a Look sheet.

- Cause: the sample's own box runs on under the Maker's lower third, which is drawn over
  its foot. The hole was the box, not what shows of it.
- Fix (`lib/popup-behind.ts` `visibleBox`): the box is tightened to where the preview is
  really what shows — the browser's own hit test, asked along the box's middle column
  then its middle row, to the pixel, looking through the sheet's own layers. Measured
  BEFORE the page is made inert (an inert branch answers no hit test), and on a resize
  with the page woken for the length of the measure. Still once per open — never a poll.
- Checked against the real page on the review server (the sample's box 52 → 576; the hit
  test says it shows 52 → 432).

Guard: `a-popup-darkens-what-is-behind` (1b, new): the controller's measured geometry — a
point on the sample is clear; a point on the tabs row and one on the Source row are dark.
8 sabotages seen red.

SPEC IMPACT: None.

## 2026-10-08 · feat(ui): the dropdown wears the accent — its ▾, its picked option and its ✓ — everywhere but the guest's Event Hub

Owner, verbatim (2026-10-08, the approved template gallery; `INTERACTION_RULES.md` § 9):
*"Dropdown — Chevron should be teracota color?"* — "the dropdown's chevron and its ticked
choice are terracotta"; "the small mark that says 'you can tap this' is terracotta".

- `PickMenu` (161 uses in 79 files), colours only — shape and behaviour unchanged:
  - the **▾** is the accent (it was the button's ink);
  - the **picked option** is said by accent words and an accent **✓** at its end (it was a
    filled ink row with cream words);
  - a **multi-pick's ✓** is the accent (it was `text-success-700`, green).
- Written on the accent token (`text-sn-accent`), never a colour name.
- **The one exemption:** inside the guest's Event Hub (`.sn-editorial`; two pages draw a
  dropdown there — the RSVP's plus-ones and the owner's phase menu) nothing changes: the ▾
  takes the page's own ink by a CSS rule that only matches there, and the list — portalled
  to `<body>`, outside the hub's box — is told where its button is (`pickInHub`) and keeps
  the filled ink row and the green ✓ byte for byte.
- `pick-menu.tsx` is 9,573 bytes (ceiling 9,800 — the size that keeps it inlined in every
  route chunk): the looks moved into `pick-menu-place.ts`, so the file got smaller.

Guards: `the-dropdown-wears-the-accent` (4, new) — incl. Tailwind run on the real config,
proving `text-sn-accent` and the hub's rule are really emitted; `the-accent-is-one-token`
extended (the dropdown's two files join the watch; its three looks join the "one line
makes it blue" proof; the hub's list is checked to hold no accent).

NOT built (written down for the controller, as asked): the dropdown rising as a bottom
sheet on a phone outside the Maker.

SPEC IMPACT: None.

### The names, settled (controller, 2026-10-08): `sn-accent`, not `accent`

`bg-accent` being terracotta while `bg-accent-soft` is the kit's gold wash was a trap for
the next person. So, in the same commit as the dropdown:
- classes: `bg-sn-accent` · `text-sn-accent` · `ring-sn-accent` · `border-sn-accent` ·
  `text-sn-on-accent` (Tailwind family `sn: { accent, 'on-accent' }`);
- Tailwind's old `accent` slot is back to exactly `var(--accent)` (gold); a test pins it;
- the CSS variables keep their names (`--sn-accent`, `--sn-on-accent`); the one line to
  change the app's accent is unchanged; `PILL_ON_CLASS` keeps its export name
  (`'bg-sn-accent text-sn-on-accent'`);
- the watch now also refuses the bare `bg-/text-/ring-/border-accent` in a template file
  (it would paint gold).
