import { SlidersHorizontal } from 'lucide-react';

/**
 * sort-face.tsx — THE ONE SHOW-AND-SORT BUTTON'S FACE (owner 19 Nov 2026, verbatim: *"just one: show and sort"*; its
 * look is his final pick of the same day).
 *
 * A list's thumb row is: the search (🔍 → ＋ where the list can add) on the left, and ONE button on the right that
 * opens the list's own Show and Sort choices. This is that button's face, the same on every list that wears it:
 *   · ICON ONLY, no word — lucide `SlidersHorizontal`, the icon the app already uses (not the funnel `Filter`, not
 *     `ArrowUpWideNarrow`, not ≡ `ListFilter`, and no hand-drawn sort icon);
 *   · in a 44 px circle exactly like the search's — the thumb row's own round seat draws the border, the size and the
 *     colour (`thumb-row.module.css` `.round`), so this adds none of its own;
 *   · a small mulberry dot at the circle's top-right ONLY while Show or Sort is not the default (`on` — each list's
 *     own shipped measure);
 *   · its name is "Show and sort", and "Show and sort · changed" while the dot shows (`sortLabel`) — the host's
 *     control carries it.
 * The dot sits just inside the circle's top-right edge (its centre 17 px from the middle, so the round's clip never
 * cuts it). No CSS file of its own: plain utility classes, so a guard that imports a host needs no CSS loader.
 * It is a face, not a button: the host's own control (a `PickMenu` trigger, or the sheet's opener) carries the press.
 * 🔒 lib/show-and-sort-is-one-button.test.ts
 */
export function SortFace({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="relative grid h-11 w-11 place-items-center text-ink" data-sort-face={on ? 'on' : 'off'}>
      <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.9} />
      {on ? <i className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-mulberry" data-sort-dot="" /> : null}
    </span>
  );
}

/** The button's name — and it says so when something is not the default. */
export const sortLabel = (on: boolean): string => (on ? 'Show and sort · changed' : 'Show and sort');
