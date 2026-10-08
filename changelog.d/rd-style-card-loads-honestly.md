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
  reads 2.9:1). Tailwind: `accent` and `on-accent` → `bg-accent` · `text-accent` ·
  `ring-accent` · `border-accent` · `text-on-accent`.
- **To make the app's accent blue, change ONE line** in `apps/web/app/globals.css`:
  `--sn-accent: var(--color-mulberry);` → `--sn-accent: 37 99 235;`.
- **`mulberry` is NOT renamed or repointed.** The hundreds of pages not yet moved onto the
  templates still read it and are unchanged.
- **The templates moved onto it** (nothing else): `pill-selector.tsx` (`PILL_ON_CLASS` =
  `bg-accent text-on-accent`, same export name) · `pill-thumb.tsx` · `press-feel.tsx`'s
  ring · `.sn-switch` when on · the style card's picked ring, name and loading pie, and the
  status line's Try again (`background-cards.tsx`) · the pill selector as the Stages tool
  group and Phases draw it by hand (`STAGE_TOOL_FACE`, `SP_PHASE` in
  `lib/maker-stage-room.ts`).
- Tailwind's `accent` slot was `var(--accent)` (the kit's gold); no class anywhere used it
  (measured) — it now names the app's accent. `accent-soft` / `accent-deep` (the blog's
  gold wash) are unchanged.
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
