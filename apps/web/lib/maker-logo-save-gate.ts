/**
 * 🛑 THE LOGO NEVER SAVES ON OPEN (owner, 2026-09-27, measured on his own event).
 *
 * Opening the Maker's Logo page mounted the studio on its sample letters and the
 * draft got that design seconds later without him touching anything — then the
 * Hero preview wore it. The autosave's only test was "is the canvas different
 * from the LAST THING I SAVED", and on open nothing had been saved yet, so ANY
 * canvas counted as a change: leaving the page, hiding the tab, or a tap that
 * edited nothing all wrote the untouched default into the draft.
 *
 * The rule now: the canvas as it stood the moment the couple FIRST reached for
 * it is the baseline, and only a canvas that differs from it is saved.
 *
 *   · `touch(svg)` — called on the couple’s own first pointer, key or typing inside
 *     the studio, BEFORE the edit lands (capture phase). The first call that
 *     sees a drawn canvas records it; later calls do nothing.
 *   · `shouldSave(svg)` — false until touched, and false while the canvas still
 *     equals the baseline (a tap that changed nothing, a tab switch).
 *   · `saved(svg)` — the new baseline once the draft holds it.
 *
 * Mounting, the typeface arriving, the first layout and the default styles all
 * happen before any touch, so none of them can reach the draft.
 * `lib/the-logo-never-saves-on-open.test.ts` holds it.
 */
export type LogoSaveGate = {
  touch: (currentSvg: string | null | undefined) => void;
  shouldSave: (svg: string | null | undefined) => boolean;
  saved: (svg: string) => void;
  /** Whether the couple has reached for the studio yet (for the tests). */
  touched: () => boolean;
};

export function createLogoSaveGate(): LogoSaveGate {
  /* undefined = the couple has not touched the studio (or it was still loading
     when they did — nothing on it could be edited yet). */
  let baseline: string | undefined;
  return {
    touch(currentSvg) {
      if (baseline === undefined && typeof currentSvg === 'string' && currentSvg) baseline = currentSvg;
    },
    shouldSave(svg) {
      return baseline !== undefined && typeof svg === 'string' && svg.length > 0 && svg !== baseline;
    },
    saved(svg) {
      baseline = svg;
    },
    touched() {
      return baseline !== undefined;
    },
  };
}
