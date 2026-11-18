## 2026-11-18 · feat(motion): the motion standard, Phase 2 — app core in the shared parts

Owner, 18 Nov: *"build it now. align it to all our designs and upcoming designs"*. Phase 2 of
`MOTION_STANDARD_2026-11-18.md` (§ 11), on top of Phase 1 (`changelog.d/motion-grow.md`). Every motion is in the SHARED
part, so each screen — today's and the next — inherits it; no screen was edited one by one. Transform / opacity only,
`@starting-style` entrances, fill `backwards`, no `var()` in a keyframe, the standard's tokens (`--sn-m-*`,
`lib/motion-table.ts`) — no new raw time or curve (`scripts/motion-raw.baseline.json` shrinks).

- **Press** (`press-feel.tsx`): verified on the Phase 1 retime (Tap 100 in, Release 280 out) — no change.
- **Stack** (`sheet.tsx`): a sheet with no fresh press behind it used to simply appear; it now slides in from its own
  edge — up from the foot on a phone (Move on Spring), in from the right as a drawer (Move on Settle), a centred form
  page rises 24 px — and leaves the same way at 80 % on Settle; tapped again mid-move it turns around from where it is.
  The **half ↔ max snap no longer animates `max-height`**: the panel takes its height at once and a transform plays
  the move (`playSheetSnap`). The panel's small `.sn-rise` class is gone. Reduced: 120 ms cross-fade.
- **Scrim**: the dark fades in Quick on Settle everywhere (`.sn-popup-dark.sn-fade`); the one stray (`sn-addman-veil`
  180 ms ease) reads the tokens. `--sn-scrim-fade` keeps its 200 ms.
- **Toast — ONE pill from the BOTTOM** (`toast/peek-toast.tsx`, `toast/toast-provider.tsx`,
  `admin/categories/_components/map-toast.tsx`): the top slide (`PEEK_TOAST_SLIDE`, the place under the top bar) is
  retired. The pill rises from the foot (Move on Spring, `@starting-style`), sits above the thumb row or the bottom nav
  (`.sn-m-toast-place` → `--sn-thumb-clear`; a plain foot from 1024), and sinks back in Quick on Settle. The app-wide
  provider is the same pill, tones and motion (was a bordered row on `sn-rise 320ms`); Undo / Try again stay on it.
  The update notice keeps the TOP of the notification layer (`PEEK_TOAST_LAYER`).
- **Rows** (`lib/rows-move.ts`, new; `swipe-to-delete.tsx`): **Leave** — a row whose Delete was pressed slides out
  (Quick on Settle) and the rows under it close the gap by transform (Move on Settle); never a height, never a cut.
  **Enter** — a row mounting into a list already drawn arrives 8 px up (Move on Settle) with a wash that fades over
  Rise; only the first 6 of a batch cascade, 60 ms apart; a list's first drawing never plays.
- **Busy → Done** (`submit-button.tsx`): the label gives way to the spinner in Tap and the button keeps the width it
  had when pressed. The `sd-loader` veil stays over Busy; `overlay={false}` stays for quick inline saves. `done` shows
  "✓ Saved" for 1 s — only when the form's owner says the save landed (never inferred from "no longer pending").
- **Shake**: ONE shake (`sn-m-shake`, three swings, Move, once). `sn-row-shake` (450 ms) and `sn-slider-shake` (a 2.9 s
  loop) are retired; the form row and the slider hint wear it.
- **Row field** (`form-row.tsx` · globals.css): opens Move on Spring, folds back Quick on Settle, name and pill back
  Move on Spring (were shares of the 700 ms pill speed).
- **Search grows into the row** (`app/_components/search-grows.ts`, new — the ONE shared part): the field grows across
  its row (Move on Spring) and folds back (Quick on Settle), the buttons fading back. Adopted in `components/thumb-row.tsx`,
  the one row every list's search sits in (Guests, Clients, Suppliers and the rest). ⚠ Not built: the icon-only resting
  state in a top bar — no named list has a top-bar search (they search in the thumb row, 22 Oct ruling "ONE THUMB ROW",
  field ≥ 60 %), and Bookings has no search. Owner call.
- **Open / Unfold** (`fold.tsx`): the fold's height is no longer animated on `grid-template-rows` — the body takes its
  place at once, the panel settles in (Move on Settle) and everything below slides as one piece by transform. `.sn-acc`
  likewise.
- **Pop** (`pick-menu.tsx`, so `link-pick-menu.tsx` too; `explain.tsx`'s popup): menus grow from their button in Quick,
  the size on Spring, the fade on Settle (`scale`, never `transform`).
- **Tick** (`count-up.tsx`, `components/count.tsx`): a change ticks from the number on screen in Quick — it no longer
  restarts from 0. The load count is unchanged (Phase 4).
- **Status change** (`badge.tsx`): a status chip's colours cross-fade in Quick on Settle (CSS only).
- **Guards:** new `lib/the-motion-core-moves-by-transform.test.ts` · new `lib/search-grows-is-one-shared-part.test.ts` ·
  `lib/the-toast-peeks-from-the-top.test.ts` → `lib/the-toast-rises-from-the-bottom.test.ts` (the 18 Nov ruling
  supersedes 8 Oct's "peek from the top") · re-anchored `the-form-row`, `the-update-notice-is-on-top`. Each new guard
  was sabotaged once and went red.
- **Not changed:** the couple's Event Hub motion (`.sn-editorial`, `lib/motion.ts`), Phase 3's parts (rise screen,
  bottom nav, templates, Tuck, the supplier thumb row's host, the inspector).

SPEC IMPACT: None
