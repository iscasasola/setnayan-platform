import type { ReactNode } from 'react';

/*
 * The TYPES of `PickMenu` (pick-menu.tsx) and its design notes — in a
 * type-only module on purpose, so all of it is erased from the bundle.
 *
 * 🪤 WHY THEY LIVE HERE (Fix E, 2026-09-30, measured). Webpack splits a module
 * shared by many route chunks into a chunk of its own once its TRANSFORMED
 * size crosses `splitChunks.minSize` (20,000 bytes) — and comments count.
 * `pick-menu.tsx` grew past that line, became its own lazily-loaded chunk, and
 * that one chunk added an entry to the webpack runtime EVERY page downloads:
 * +14 bytes gzipped on a shared bundle with none to spare (202KB ceiling).
 * Moving only the types was NOT enough (still split); with every note moved
 * here too it inlined again. Types and notes cost nothing here, so this is
 * where they grow; keep pick-menu.tsx to behaviour, comment-free. Guard:
 * `pick-menu-stays-inline.test.ts`.
 *
 * ── HOW pick-menu.tsx BEHAVES (its inline notes, kept here for the same reason) ──
 * · The list's FULL height — `scrollHeight` ignores the maxHeight cap, so a re-measure never feeds the cap back into itself.
 * · Placed BEFORE paint, twice: first from the button alone (the list is not mounted yet), then with the list's real height, which may flip it above the button. `place` keeps the same object when nothing moved, so this settles after one extra pass. …and focus moves into the list the first time it is actually mounted (on a first open the list only exists after the placement pass, so a focus call in the `[open]` effect below found nothing — measured in the browser).
 * · The CURRENT option first — a selector list would return whichever comes first in the document, i.e. always the top option.
 * · A FONT ROW (`fontFamily`) is `content-visibility: auto`: a face is fetched when text is laid out in it, and that skips laying out a row that is off the list's screen — so a font row's face downloads only once it scrolls into view.
 * · A labelled GROUP (owner 2026-09-27, the compact Maker bar: "combine them in 1 dropdown" — Stages and Pages in one list). The heading is not an option: no button, so the arrow keys and the first-focus query pass over it; the group is announced by its aria-label, the visible word is aria-hidden.
 */

/**
 * PickMenu — ONE COMPACT PICKER — "Home ▾", "● Invitation ▾", "Pages ▾".
 *
 * Owner, 2026-09-27, on the navigator's tab row (it wrapped to 140px tall in a
 * 168px column): *"this should be a tap to show option to pick or a drop
 * down."* And on the toolbar's stage row (clipped at laptop widths): *"we can
 * also convert this to a drop down/tap to show options for smaller screens?"*
 *
 * A button showing the current choice; a tap lists the options; picking one
 * calls `onPick` — the SAME action the full row's buttons run, so the two can
 * never mean different things. The list is placed against the VIEWPORT (the
 * toolbar and the navigator both scroll, and an overflow container would clip
 * a list that hangs below it — `ComingNext`'s rule). Esc and a tap outside
 * close it; arrow keys move through the options.
 *
 * 🪤 THE LIST IS PORTALLED TO `document.body` (measured live 2026-09-27): the
 * element sheet is `.sn-glass-bare`, and an ancestor with `backdrop-filter`
 * (or `transform` / `filter`) becomes the containing block for `position:
 * fixed` — the Font list was drawn at the viewport top PLUS the sheet's own
 * top, wholly below a phone screen. From `body` no ancestor can do that. Where
 * it opens (below, or above when there is no room) is `placePickList`,
 * executed by `pick-menu-place.test.ts`. The faces still resolve: every
 * `--font-*` variable is declared on `<html>` (app/layout.tsx). `z-[95]`
 * clears the Maker overlay (`fixed inset-0 z-[80]`) and its scene picker
 * (z-[90]/z-[91]), and stays under toasts (z-[100]).
 */
export type PickOption = {
  key: string;
  label: string;
  /** The terracotta "live today" dot, beside the label. */
  dot?: boolean;
  /** The words beside the dot in the open list. Default "live today" (the
   *  Maker's stages); the People picker says "waiting on you" for Requests. */
  dotNote?: string;
  /** Listed but not pickable, with its reason (a tab that opens its own page). */
  disabledNote?: string;
  /** Draw the option IN a face (the font dropdown — each font in its own face). */
  fontFamily?: string;
  /** A labelled group heading ("Stages", "Pages"); consecutive options with the
   *  same group share one heading. Omitted = no heading (every other picker). */
  group?: string;
  /** A short mark at the row's end — the guided flow's ✓ / ○ beside each step. */
  trail?: { text: string; tone: 'ok' | 'left' | 'muted'; label?: string };
  /** A small picture of the choice, drawn before its label (the pass card's
   *  three looks — the couple sees each while picking). Decorative. */
  thumb?: string;
  /** The choice's own icon, drawn before its label on the button and in the
   *  list (the Maker's Page ▾ — each page with the guest bar's icon). Decorative. */
  icon?: ReactNode;
  /**
   * 🎨 One line under the label — what the choice looks like (a scene's Style
   * dropdown: "One figure leads; the rest step down"). Omitted = one line.
   */
  hint?: string;
  /** 🎨 A small live picture of the choice, left of the label (a Style's mini preview). */
  preview?: ReactNode;
};

export type PickMenuProps = {
  /** What the control is, for a screen reader ("This stage's menu"). */
  label: string;
  /** The option shown on the button. */
  value: string | null;
  options: readonly PickOption[];
  onPick: (key: string) => void;
  /** A data-attribute name stamped on the button, for tests and the tour. */
  dataAttr?: string;
  className?: string;
  /** Words on the button instead of the current option's label ("Round 1 · 3 of 7"). */
  buttonText?: string;
  /**
   * ✓ A DROPDOWN WITH CHECKMARKS (owner 2026-09-30, the guest card's "Also
   * serves as" and Groups): the SAME list, a ✓ beside each option that is on.
   * A tap ticks or unticks it (`onPick` with that key) and the list stays open
   * until "Done ✓". Omitted = the ordinary one-choice list.
   */
  picked?: readonly string[];
  /** A chip-sized button (the guest list's phone row, one line of small chips)
   *  — the list it opens is the same. Default: the Maker bar's 40px button. */
  compact?: boolean;
  /** A long list (the font dropdown's shelves): each group heading stays in view while its options scroll. */
  stickyGroups?: boolean;
  /**
   * ⬚ A 3×3 GRID OF ICON CELLS instead of a list (owner 2026-10-04, Move ▾:
   * *"drop down shows the 3x3 grid?"* → yes). The SAME dropdown — same button,
   * same open / close, outside tap and Esc — whose open body lays its nine
   * options out row by row, each a 44 px cell showing its `icon` with its
   * `label` as the accessible name. Picking one closes it; ↑/↓ step through
   * the cells. Options are given in grid order.
   * 🪤 THE GRID IS CSS, NOT CODE: `pick-menu.tsx` only stamps `data-pick-grid`
   * on the list and `globals.css` ("PICKMENU GRID") lays it out — that file
   * sits at its inline-size line (`pick-menu-stays-inline.test.ts`), and a
   * second render path there would split it into its own chunk.
   */
  grid?: boolean;
};
