## 2026-10-08 · feat(maker): the Stages panel wears the approved templates — A · buttons and marks take the accent

Owner, 2026-10-08: *"we want the whole app to be adaptive to the same feel"* · *"if we change our color to blue, it
will be easy to change the button colors"* · *"pop up is like a notification. so it should peek from the top"*.

The shared stage panel (Style | Text | Animate), as the Invitation stage shows it:

- **One colour, from the one setting.** The panel's own `--sp-cta` (the picked card's ring, the slider's fill) and its
  wash now READ `--sn-accent`; `--sp-bad` reads the house danger token. Thirteen neutrals are all the panel still
  writes. The part frame, its name, ＋ ↑ ↓ ✕ and the grip are `bg-sn-accent text-sn-on-accent`; 🗑 is `--color-danger`.
- **The dropdown's ▾ is terracotta** — the panel no longer repaints it gold (nor Gallery ›, Upload +, the stage ▾).
- **Actions are the app's action button** (`ActionButton`): Style › Look's door ("Edit the E-Gifts") is the second
  button, not an ink-black bar; the remove confirm answers with the second button and the delete button (the house
  red, not the blush brown that read as a second terracotta); the typing bar's Done and the colour sheet's Use are
  the main button. `ActionButton`'s `brand` tone now reads `--sn-accent` / `--sn-on-accent` (same colour today).
- **Move's direction is ONE dropdown** ("From · the bottom ▾"), where four ink arrow buttons stood; **Grow | Shrink
  is the app's pill selector**.
- **Colour swatches are circles** (kind 21), the picked one ringed in the accent — one drawing (`Swatch`) for Text
  and Background.
- **The toast, drawn once**: `app/_components/toast/peek-toast.tsx` — peeks from the top centre, the accent with a ✓,
  the danger token darkened with a warning mark for a failure, leaves by itself, nothing under reduce motion, never
  darkens the page. The panel's "added / removed / moved" strip is this toast now. (`ToastProvider` / `useToast` —
  the older toast at the bottom, ~35 callers — adopts this drawing in the app-wide sweep; not moved here.)

Requests: none added. The Suppliers door is a client link now (`prefetch={false}`): one route fetch on a press,
where a full page load stood.

Guards: `lib/the-stages-panel-wears-the-accent.test.ts`, `lib/the-toast-peeks-from-the-top.test.ts` (21 sabotages,
each seen red). `scripts/port-control-baseline.json` regenerated (it named `<Dir>` gone; `PeekToast`,
`PillSelector`, `Swatch`, `SwatchMore`, `ActionButton` new).

SPEC IMPACT: None (the rulings are already in `INTERACTION_RULES.md` § 9; this builds them).

## 2026-10-09 · fix(maker): a first Background pick no longer drops the guest sample to the error screen

Measured on the Maker lab (Message → Style › Background ▾ → Opaque): the sample fell to "Something on our end didn't
work · Try again · Take me home", its console saying `NotFoundError: Failed to execute 'removeChild' on 'Node'`.

The canvas bridge lays a background preview by hand, and a scene with no frame yet is WRAPPED — which moves a node
the page's own React tree drew (`app/[slug]/_components/scene-bg-preview.ts`). That was safe while every save was
followed by a canvas reload. Since 2026-10-06 a pick that changes who draws the card is confirmed by a redraw IN
PLACE (`editor-bridge.tsx`, `router.refresh()`): React then removes the scene from the parent it remembers, and the
browser refuses. The same file removed a photo layer the page had drawn — the same throw on the next redraw.

Now the bridge marks what it wraps and lays, only HIDES a photo layer the page drew, and puts the DOM back exactly as
the page's render left it in the commit where the redraw's transition ends — before React touches the DOM
(`getSnapshotBeforeUpdate`), never when the refresh is asked, so the previewed background does not blink off while
the server answers. Only the Maker's canvas mounts the bridge; a guest's page is untouched.

Cost, said plainly: `editor-bridge.tsx` is imported statically by the guest page's `site-body.tsx` (it has no
`next/dynamic` door; only the Maker's canvas mounts it), so the 12-line class — about 0.2 KB before compression —
rides the guest bundle.

Guard: `lib/a-laid-scene-frame-is-undone-before-a-redraw.test.ts` executes the sequence over a DOM whose
`removeChild` refuses as a browser's does (7 sabotages, each seen red — two of them restore today's behaviour).

SPEC IMPACT: None.

## 2026-10-09 · feat(maker): the Stages panel wears the approved templates — B · every pop-up follows the pop-up rule

Owner, 2026-10-08: *"when there is a pop up. the rest of the screen darkens … The darkened area will be blurred and
nothing behind it will work. pressing on the dark part removes the pop up. the background will not be scrollable"*.

The panel's sheets that are `MakerSheet` already held the rule (measured: Colour, Font, Gallery, Upload, the ＋
sheet, the remove confirm). Three that could not be that sheet now hold it with the same pieces — one dark
(`.sn-popup-dark`), `inertBehind`, `useModalA11y` — through one small hook, `lib/use-popup-behind.ts`:

- **The colour sheet where there is no Maker sheet** (a computer; the Mood Board and the Logo on their own pages):
  its hand-made 20 % wash is the one dark; nothing behind works or scrolls; a tap on the dark closes.
- **"A scene of your own"** (the template picker opened from a part's ＋): the dark is put under the picker's own
  close button and the page behind goes out of reach. The picker's file — in the Maker's first load — is untouched.
- **The Apply sheet**: its backdrop wears the one dark from the STYLESHEET (`div:has(> [data-apply-pro-sheet])` in
  each rule of `.sn-popup-dark`), so its first-load file gains not one byte of script.

Requests: none added or removed. First load: the Maker's first-load file set is unchanged (562 files, walked).

The one gap: behind the Apply sheet the page is not made `inert` (its full-screen backdrop takes every tap and its
modal hook holds the keyboard, but `inertBehind` is script, and that file rides the Maker's first load, which has
0.1 KB of room). It waits for room there.

Guard: `lib/every-stages-popup-follows-the-rule.test.ts` (10 sabotages, each seen red).

SPEC IMPACT: None.

## 2026-10-09 · feat(maker): the Stages panel wears the approved templates — C · the switch, the slider, the ⓘ

- **The slider, built once**: `app/_components/slider.tsx` + `.sn-slider` (kind 17) — the line fills in the accent up
  to the knob, the knob dips, fills and rings while held and springs back at the family's speed, nothing under reduce
  motion, 44 px to the finger, the value beside it in figures that do not jump. The panel's four ranges use it
  (Duration, Delay, Text size, Opacity ×2 shapes of the Background row); the panel's private `.sp-range` look and the
  ink `accent-ink` range are gone.
- **The switch**: the panel's `PanelSwitch` is the app's one drawing (`SwitchTrack`, 50 × 30; it was its own
  54 × 32). `every-switch-wears-the-one-look` now watches the Maker file by file — the Stages panel is swept; six
  Maker files are named with why. `app/admin/hub-music/hub-music-manager.tsx` (a green hand-made switch that came in
  with main) wears the one switch too.
- **The ⓘ**: the panel's `About` and the ＋ sheet's "why is this waiting" are the explanation template (`Explain` —
  a centred pop-up with "Got it" on a phone, a note by the ⓘ on a computer), not the older hover note.
- **"How close"** (a photo background's three zooms) is one dropdown, not a row of segments.
- `every-studio-colour-opens-the-one-picker` G: its PAINTS list brought up to what is drawn — `background-colour-wells`
  (the Look's two circles, triggers of the one picker) and `background-effects` (the dot beside each Colour ▾ choice,
  the sample's veil) added; `buttons-look-row` removed (its Colour ▾ went with "Buttons is Shape only").

Requests: none added or removed. First load: unchanged (none of the touched files is in it).

Guards: `lib/the-slider-is-one-drawing.test.ts`, `lib/the-stages-panel-wears-the-templates.test.ts` (15 sabotages,
each seen red).

SPEC IMPACT: None.

## 2026-10-09 · fix(maker): a tool with nothing to set on the picked part is grey and says so — D

Tapped on the Maker lab (Invitation, 375 × 812): on E-Gifts and on What to wear a tap on Text slid the pill to Text
while the panel still showed Style's cards — Animate the same; on the Reveal the two were greyed and a tap said
nothing. A pill over the wrong panel is a failure drawn as success; a silent tap is a dead one.

- `makerPartToolWorks(part, tool)` (`lib/maker-parts.ts`): Style always; Text and Animate only where the work area
  has a save — a part with words of its own, or a scene. It mirrors the work area's own two branches, and a guard
  fails if the work area gains a third.
- A tool with nothing to set is grey and `aria-disabled` (never `disabled`), is never the pressed one, and a tap
  says one line through the app's toast: "Nothing to change here — edit it in Studio." for a part whose content is
  Studio's, "Text has nothing to change on this part." otherwise. The Reveal, the Camera, the pass and the RSVP
  pages answer the same way.
- Picking such a part opens Style; the tool last used is remembered and returns on the next part that has it.
- `PeekToast` gains a third look, `note` (white, a hairline, ink words, an ⓘ): something to know that is neither a
  result nor a fault. The approved gallery draws the two results only — this look awaits the owner.

Requests: none. First load: unchanged.

Guard: `lib/a-tool-with-nothing-to-do-says-so.test.ts` (12 sabotages, each seen red).

SPEC IMPACT: None.

## 2026-10-09 · feat(maker): the Reveal's own page wears the switch, the slider and the action button

On the Invitation's Welcome page the Reveal part (`RevealStagePart`) was already all templates once A–C landed (look
cards ringed from the token, `PanelSwitch`, dropdowns). The rest of `maker-reveal.tsx` — the shipped Maker's Reveal
page — still drew four things by hand:

- **Effects** (Butterflies / Falling petals): a track whose "on" was the gold `terracotta-700` → the one switch.
- **Where it plays**: three ink pills with a tick, said as switches → each a pill with its stage's name and the one
  switch (grey off, the accent on).
- **Fine-tune**: native ranges tinted gold → the app's slider; `Slider` gains `onCommit` (told when the knob is let
  go), so a knob still saves on release, never on every step.
- **Play the opening** and **Reset** → the app's action button (second / quiet).

`every-switch-wears-the-one-look` no longer exempts `maker-reveal.tsx`.

Left as they are, said plainly: the page's three ⓘ are still the older hover note (`InfoTip` prints its own label,
the explanation template has none — moving them redraws three rows of the shipped page, pinned by
`the-reveal-fine-tunes-and-says-less`); the "Fine-tune ▸" fold is its own, not the shared Fold; "In your draft" /
error lines keep their `terracotta-700` ink.

Requests: none added or removed (the same saves on the same events).

SPEC IMPACT: None.
