/**
 * 📌 ONE FIGURE ON A SUPPLIER PAGE'S PINNED ROW — the data half of `PinFigures`
 * (`app/vendor-dashboard/_components/pin-figures.tsx`). A plain module so a pure figure-maker in `lib/` can build the
 * row without reaching into `app/`.
 *
 * HONEST: `value: null` = not read — drawn "—" with "couldn't load", never 0 (`reads-are-honest.test.ts`).
 */
export type PinFigure = {
  key: string;
  /** Already worded ("3", "₱53K", "4.9"), or null = not read — drawn "—", never 0. */
  value: string | null;
  word: string;
  /** 📈 The change against the window before ("+12" · "−16" · "same") — its own line under the word (`PinDoor change`). */
  change?: string;
  /** The word on the FOLDED line when the full one cannot fit at 390 px. Absent → the full word. */
  short?: string;
  /** The brand colour — the figure that waits on the shop. */
  hot?: boolean;
  /** Where the figure's rows are — a figure is a door, never a dead number. */
  href: string;
  /**
   * The figure as a NUMBER, when it should COUNT (Analytics, owner-approved 6 Nov 2026: the headline numbers count in
   * the pinned row — 0 → value on load, old → new on a window change; `Count`, keyed `pin:<key>`). Absent → `value` is
   * drawn as it always was. Ignored while `value` is null (an unread figure never counts).
   */
  count?: number;
};
