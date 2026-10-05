import { Sk, SkLine } from '@/components/skeletons';

/**
 * ⏳ THE SLOT A LAZY DETAILS PIECE HOLDS WHILE ITS CODE ARRIVES
 * (`details-lazy.tsx` · `mood-board-lazy.tsx` · `schedule-lazy.tsx`).
 *
 * Each Details piece's editor or picture loads the first time its item is
 * opened (owner 2026-09-29: "the Maker must never be slow" — its first-load
 * JavaScript has a ceiling, `scripts/check-maker-js-budget.mjs`). Until it has
 * arrived, the piece's slot shows one of these — at once, in the slot's own
 * shape, so nothing below it jumps when the real piece lands:
 *
 *   · `SlotFill`   — a picture that fills its column (a gallery, a studio, a page);
 *   · `SlotRows`   — an editor's fields (a line, a field, a line);
 *   · `SlotButton` — one button's footprint in a row of controls;
 *   · `SlotNone`   — nothing: a navigator piece or a tip that only adds to a row.
 *
 * Every block is decorative; the wrapper carries `aria-busy` so assistive tech
 * hears one "loading", not a dozen. It is almost never seen: the Maker warms
 * every piece once it is idle (`maker-tools.tsx`), so a tap draws the real
 * piece at once; it shows only before that (or with Save-Data on).
 */
export function SlotFill() {
  return (
    <div aria-busy="true" data-lazy-slot="fill" className="flex min-h-[240px] flex-1 flex-col gap-3 p-4">
      <span className="sr-only">Opening…</span>
      <Sk className="min-h-[200px] w-full flex-1 rounded-md" />
    </div>
  );
}

export function SlotRows() {
  return (
    <div aria-busy="true" data-lazy-slot="rows" className="flex flex-col gap-2 py-1">
      <span className="sr-only">Opening…</span>
      <SkLine w="w-2/3" />
      <Sk className="h-11 w-full rounded-md" />
      <SkLine w="w-1/2" />
    </div>
  );
}

export function SlotButton() {
  return (
    <span aria-busy="true" data-lazy-slot="button" className="inline-flex">
      <Sk className="h-11 w-32 rounded-md" />
    </span>
  );
}

export function SlotNone() {
  return null;
}
