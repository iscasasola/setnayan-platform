/**
 * 📜 WHICH JUMP MARK IS LIT (owner 2026-10-15, DECISION_LOG "THE INVITATION AND SAVE THE DATE BECOME ONE PAGE";
 * approved prototype `event_hub_one_page_and_desktop_2026-10-15_fable.html` §1b: *"the lit item is
 * `aria-current="true"` on an in-page link, set by a scroll-spy (`IntersectionObserver` on the three anchors)"* and
 * *"scroll-spy: the last anchor crossed is lit"*).
 *
 * A mark is "crossed" once its top has risen into the top `LIT_LINE` of the screen. The lit mark is the LAST one
 * crossed, in page order; before any is crossed (the guest is still on the cover) the first mark — Home — is lit,
 * which is also what the bar shows when it slides up on the first swipe.
 *
 * Pure: the bar (`site-menu-bar.tsx`) hands it each mark's measured top; no DOM here.
 */

/** How far down the screen a section's mark must rise before that section is the one being read. */
export const LIT_LINE = 0.4;

export function litJumpMark(marks: ReadonlyArray<{ key: string; top: number }>, viewportHeight: number): string | null {
  if (marks.length === 0) return null;
  const line = Math.max(1, viewportHeight) * LIT_LINE;
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
