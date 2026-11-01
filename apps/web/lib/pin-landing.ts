/**
 * pin-landing.ts — 📌 AN OPENED CATEGORY NEVER COVERS ITS OWN FIRST CARD (owner 2026-10-29, live, the event's
 * Suppliers › Find on a phone: *"when i tapped a category, this is how it pinned on top. it made the service card not
 * placed properly"* — the opened row's head sat over the top of its first card: the supplier's name line cut off, the
 * thumbnail half under the head).
 *
 * ── WHY IT HAPPENED ─────────────────────────────────────────────────────────────────────────────────────────────────
 * The landing scrolls the opened row to its `scroll-margin-top`, which is `--stick-h` — the app's top bar plus the
 * pinned Find · Build · Booked row, MEASURED (`services-takeover.tsx`). But on a phone the top bar answers the scroll
 * direction (`useHideOnScroll`): a landing that scrolls UP brings the bar back, so `--stick-h` grows by the bar's
 * height a moment AFTER the scroll aimed at the old line. The head then pins at the new, lower line while the row's
 * body rests where the old line put it — the head covers the first card by (bar − gap): measured 36 px at 375 on
 * `/dev/suppliers-lab` (Photo & Video, opened after Reception: the row above folds, the landing scrolls up).
 * A landing that scrolls DOWN hides the bar and left the head a bar's height BELOW the pinned row instead (65 px).
 *
 * ── THE FIX ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 * 1 · THE PAGE'S OWN SCROLL DOES NOT MOVE THE BAR. While a landing holds (from the open until the person's next wheel,
 *     touch, pointer or key), `<html>` carries `data-pin-landing` and `useHideOnScroll` leaves the bar where the person
 *     last put it. The bar answers the PERSON's scroll direction, which a landing is not — so the line the landing
 *     aims at is the line it lands on. (Before this the walk was a coin toss in WebKit: a clamp at the page's end
 *     scrolled up, the bar came back, the room the page had made was now short, and the head covered the card by 49 px.)
 * 2 · IT STILL HOLDS ITS LINE. Any change of `--stick-h` while it holds (the pinned row's height changing) lands the
 *     row again on the line as it now is; and when the page settles under it at rest (a row folding above it — WebKit
 *     has no scroll anchoring — or the room it was short of), it lands again if the row is off its line.
 *
 * 🔒 Held by `lib/an-opened-category-never-covers-its-card.test.ts` (and, laid out in a browser,
 * `tests/e2e/an-opened-category-never-covers-its-card.spec.ts` on the lab).
 */

/** The custom property the takeover writes: the top bar (while it shows) plus the pinned row, in px. */
export const STICK_LINE_VAR = '--stick-h';
/** The custom property each OPEN category carries: its own head's measured height, in px. */
export const CAT_HEAD_VAR = '--cat-head-h';

/** The person took the scroll — the page stops steering it. */
const HANDS_ON = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** Re-landings of each kind one hold may make — a page that keeps moving under it is not followed forever. */
export const MAX_RELANDS = 4;

/**
 * Whether the line moved enough to land again (pure). A sub-pixel wobble of a measured height is not a move.
 */
export function stickLineMoved(before: number, now: number): boolean {
  return Math.abs(now - before) >= 1;
}

/** Whether an anchored row rests off its own `scroll-margin-top` line by more than a pixel (pure). */
export function offTheLine(rowTop: number, line: number): boolean {
  return Math.abs(rowTop - line) > 1;
}

/** The attribute on `<html>` while a landing holds — `useHideOnScroll` reads it (`PIN_LANDING_ATTR`). */
export const PIN_LANDING_ATTR = 'data-pin-landing';

/** Whether the page itself is steering the scroll right now (a landing holds) — the bar then stays put. */
export function pageIsLanding(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute(PIN_LANDING_ATTR);
}

/**
 * Hold a landing until the person scrolls themselves (or each kind of re-landing has spent `MAX_RELANDS`):
 *   · `<html>` carries `data-pin-landing`, so the top bar does not answer the landing's own scroll;
 *   · a change of `root`'s `--stick-h` lands the row again;
 *   · with a `row` and the `holder` it lives in, a resize of the holder that leaves the row off its line, judged once
 *     the page is at rest, lands it again.
 * Returns the release.
 */
export function holdLandingLine(
  root: HTMLElement | null,
  land: () => void,
  settle?: { row: HTMLElement | null; holder: HTMLElement | null },
): () => void {
  if (!root || typeof window === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  const html = document.documentElement;
  html.setAttribute(PIN_LANDING_ATTR, '');
  const read = () => parseFloat(root.style.getPropertyValue(STICK_LINE_VAR)) || 0;
  let line = read();
  let lineRelands = 0;
  let settleRelands = 0;
  let frame = 0;
  let held = true;
  const mo = new MutationObserver(() => {
    const now = read();
    if (!stickLineMoved(line, now) || lineRelands >= MAX_RELANDS) return;
    line = now;
    lineRelands += 1;
    land();
  });
  const row = settle?.row ?? null;
  const ro =
    row && settle?.holder && typeof ResizeObserver !== 'undefined' && typeof requestAnimationFrame === 'function'
      ? new ResizeObserver(() => {
          if (frame || settleRelands >= MAX_RELANDS) return;
          // Only a page AT REST is judged: mid-scroll (the landing's own smooth scroll) the row is on its way to the
          // line, not off it. Two frames with the same scrollY say the scroll has stopped; until then, look again
          // next frame (a scroll always ends, and the person's own touch releases the hold first).
          let y = window.scrollY;
          const judge = () => {
            if (!held) return;
            if (window.scrollY !== y) {
              y = window.scrollY;
              frame = requestAnimationFrame(judge);
              return;
            }
            frame = 0;
            const margin = parseFloat(getComputedStyle(row).scrollMarginTop) || 0;
            if (offTheLine(row.getBoundingClientRect().top, margin)) {
              settleRelands += 1;
              land();
            }
          };
          frame = requestAnimationFrame(judge);
        })
      : null;
  const release = () => {
    if (!held) return;
    held = false;
    mo.disconnect();
    ro?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    html.removeAttribute(PIN_LANDING_ATTR);
    for (const t of HANDS_ON) window.removeEventListener(t, release, true);
  };
  mo.observe(root, { attributes: true, attributeFilter: ['style'] });
  if (ro && settle?.holder) ro.observe(settle.holder);
  for (const t of HANDS_ON) window.addEventListener(t, release, { capture: true, passive: true });
  return release;
}

/**
 * Write each open category's own head height on it (`--cat-head-h`), so its cards' `scroll-margin-top` is the pinned
 * row PLUS that head — measured, never assumed (a head wraps to two lines on a phone: "Photo & / Video · 1 yours").
 * Returns the release.
 */
export function measureOpenHeads(holder: HTMLElement | null, openRow: string, head: string): () => void {
  if (!holder) return () => {};
  const rows = [...holder.querySelectorAll<HTMLElement>(openRow)];
  const write = (row: HTMLElement) => {
    const h = row.querySelector<HTMLElement>(head);
    if (h) row.style.setProperty(CAT_HEAD_VAR, `${h.offsetHeight}px`);
  };
  rows.forEach(write);
  if (typeof ResizeObserver === 'undefined') return () => {};
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const row = (e.target as HTMLElement).parentElement;
      if (row) write(row);
    }
  });
  for (const row of rows) {
    const h = row.querySelector<HTMLElement>(head);
    if (h) ro.observe(h);
  }
  return () => ro.disconnect();
}
