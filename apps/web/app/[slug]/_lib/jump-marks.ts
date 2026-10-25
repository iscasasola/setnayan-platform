/**
 * 📜 WHICH JUMP MARK IS LIT (owner 2026-10-15, DECISION_LOG "THE INVITATION AND SAVE THE DATE BECOME ONE PAGE";
 * approved prototype `event_hub_one_page_and_desktop_2026-10-15_fable.html` §1b: *"the lit item is
 * `aria-current="true"` on an in-page link, set by a scroll-spy (`IntersectionObserver` on the three anchors)"* and
 * *"scroll-spy: the last anchor crossed is lit"*).
 *
 * A mark is "crossed" once its top has risen into the top `LIT_LINE` of the screen (a quarter). The lit mark is the LAST one
 * crossed, in page order — and at the page's END (`atEnd`, nothing below can rise further) the lowest mark on screen;
 * before any is crossed (the guest is still on the cover), and while Home's own mark is not yet above the screen's
 * top (the guest has not scrolled past where Home lands), the first mark — Home — is lit,
 * which is also what the bar shows when it slides up on the first swipe.
 *
 * Pure: the bar (`site-menu-bar.tsx`) hands it each mark's measured top; no DOM here.
 */

/** How far down the screen a section's mark must rise before that section is the one being read — the top quarter.
 *  (Walked 2026-10-15: at 40 % a Save the Date's Story card, just under the countdown, lit Story while the countdown
 *  was the first thing on screen; the prototype's §1c frame has Home lit there.) The bar's observer uses the same
 *  line (`site-menu-bar.tsx`, `rootMargin` bottom = 1 − LIT_LINE). */
export const LIT_LINE = 0.25;

/** Home counts as scrolled past only once its mark has risen this far ABOVE the top of the screen — the same quarter
 *  as `LIT_LINE`. Walked 2026-10-16 at 375 × 667: a Save the Date (762 px) scrolls only 95 px, so the first swipe
 *  takes it to its end with Home's mark at −47 and the countdown still the first thing on screen — Home must be lit
 *  there (the prototype's §1c frame 2). On the Invitation Home's section is far longer than a quarter screen, so this
 *  never holds Home past the moment Details crosses its line. */
export const HOME_PASSED = LIT_LINE;

export function litJumpMark(marks: ReadonlyArray<{ key: string; top: number }>, viewportHeight: number, atEnd = false): string | null {
  if (marks.length === 0) return null;
  /* 🏠 HOME IS LIT UNTIL THE GUEST SCROLLS PAST IT (Batch 9 walk W1, 2026-10-16). The first mark is Home. Until its
     mark has risen a quarter screen above the top the guest has not scrolled past Home, so Home is lit —
     even on a page so short (a Save the Date: 860–981 px) that Story's mark sits inside the top quarter, or the page's
     end is on screen, from the first screen. The prototype's §1c frame 2 has Home lit on the countdown. */
  const home = marks[0]!;
  if (Number.isFinite(home.top) && home.top > -Math.max(1, viewportHeight) * HOME_PASSED) return home.key;
  /* At the page's end the last sections can rise no further: the lowest mark on screen is the one being read. */
  const line = Math.max(1, viewportHeight) * (atEnd ? 1 : LIT_LINE);
  let lit: string | null = null;
  let litTop = Number.NEGATIVE_INFINITY;
  for (const m of marks) {
    /* The last crossed = the crossed mark lowest on the page (nearest the line), whatever order they were handed in. */
    if (Number.isFinite(m.top) && m.top <= line && m.top >= litTop) {
      lit = m.key;
      litTop = m.top;
    }
  }
  return lit ?? marks[0]!.key;
}
