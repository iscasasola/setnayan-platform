/**
 * 👁 HOLD ▶ — THE WHOLE PAGE AS A GUEST — PLAYS EACH SCENE'S ARRIVAL AS A GUEST GETS IT (the 2026-10-15 walk, F6).
 *
 * 🔴 Hold ▶ only switched the same canvas document into guest mode. Every "On arrival" scene had arrived long before
 * (the page's observer marks a scene `.pahina-in` once, as it nears the screen, and the Maker had shown them all), so
 * scrolling a scene in during the preview moved nothing.
 *
 * ✅ On entering the preview, as a guest landing here would see it:
 *   · what is ON SCREEN plays its arrival now (`replay` — the scene's own and its parts', `replaySceneIn`);
 *   · everything BELOW the screen is put back to "not reached" — its `.pahina-in` taken off — and watched as the page's
 *     own observer watches (32 px before it enters), so it arrives as the couple scrolls to it, rows one by one
 *     (`--hub-row-at`, as the observer writes it).
 * On leaving, every mark is put back, so the Maker's canvas is exactly as it was (a scene never reached in the preview
 * rests as drawn). Reduced motion: nothing is touched. Guard: `lib/hold-play-arrives-as-a-guest.test.ts`.
 */
export const ARRIVING_SEL = '.hub-canvas, .hub-canvas [data-hub-rows] > *';

export function startGuestArrivals(
  doc: Document,
  win: Window,
  replay: (frame: HTMLElement) => void,
  /** A hero part with a Build in of its own (`[data-el-motion]`, outside any scene frame) on screen: replayed too. */
  replayPart: (part: HTMLElement) => void = () => {},
): () => void {
  if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof win.IntersectionObserver !== 'function') return () => {};
  const h = win.innerHeight || doc.documentElement.clientHeight || 0;
  const rearmed: HTMLElement[] = [];
  const io = new win.IntersectionObserver(
    (es: IntersectionObserverEntry[]) => {
      let k = 0;
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const t = e.target as HTMLElement;
        if (t.parentElement?.hasAttribute('data-hub-rows')) {
          k = Math.min(k + 1, 8);
          t.style.setProperty('--hub-row-at', String(k));
        }
        t.classList.add('pahina-in');
        io.unobserve(t);
      }
    },
    { rootMargin: '0px 0px 32px 0px', threshold: 0 },
  );
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>(ARRIVING_SEL))) {
    if (!el.getClientRects().length) continue;
    const top = el.getBoundingClientRect().top;
    if (top >= h) {
      if (el.classList.contains('pahina-in')) {
        el.classList.remove('pahina-in');
        rearmed.push(el);
      }
      io.observe(el);
    } else if (el.matches('.hub-canvas') && el.getBoundingClientRect().bottom > 0) {
      replay(el);
    }
  }
  for (const part of Array.from(doc.querySelectorAll<HTMLElement>('[data-el-motion]'))) {
    if (part.closest('.hub-canvas') || !part.getClientRects().length) continue;
    const r = part.getBoundingClientRect();
    if (r.top < h && r.bottom > 0) replayPart(part);
  }
  return () => {
    io.disconnect();
    for (const el of rearmed) el.classList.add('pahina-in');
  };
}
