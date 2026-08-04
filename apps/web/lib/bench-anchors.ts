/**
 * bench-anchors.ts — the ONE place the shortlist bench's scroll targets are
 * NAMED, and the ONE place a programmatic scroll to one is performed.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * The bench (`_components/shortlist-categories.tsx`) rendered exactly one
 * anchor — `#slfold-<folderSlug>`, the FOLDER card. The leaf category row had
 * none. So every "jump me to that category" doorway could only ever land on the
 * folder head, with the actual category sitting expanded somewhere below it:
 * the owner's "still needs your decision doesn't jump to the exact accordion
 * cell". The exact cell was not merely mis-targeted — it was unreachable,
 * because it had no target.
 *
 * Two ids, derived in one place, so a caller can never hand-roll a string that
 * drifts from the JSX that renders it (`bench-deep-link-anchor.test.ts` asserts
 * both directions).
 *
 * ── WHY THE SCROLL LIVES HERE TOO ────────────────────────────────────────────
 * `prefers-reduced-motion` is honoured by `globals.css` and by the bench's own
 * stylesheet for everything CSS owns — but a PROGRAMMATIC `scrollIntoView` is
 * not a CSS transition, so no stylesheet can reach it. The media query has to be
 * read in JS, and reading it in one place is the only way two call sites can't
 * disagree.
 *
 * The landing OFFSET is deliberately NOT here: it is `scroll-margin-top` on the
 * anchors themselves, in the bench's stylesheet, where the sticky chrome it has
 * to clear is already described.
 */

/**
 * `#slfold-<folderSlug>` — a folder card on the bench. The SHIPPED anchor; this
 * only gives it a name. Used as the fallback landing for plan groups that have
 * no catalogue tile (`PLAN_GROUPS` → no `catalogTile`: attire ·
 * music_entertainment · logistics), which therefore have no leaf row to aim at.
 */
export function benchFolderAnchorId(folderSlug: string): string {
  return `slfold-${folderSlug}`;
}

/**
 * `#sltile-<tile>` — the LEAF category row ("Reception venue", "Catering").
 *
 * Safe as a DOM id because wedding tiles are globally unique: every tile belongs
 * to exactly one parent folder in `WEDDING_TILES_BY_PARENT` (69 tiles, 0
 * duplicates), and the bench renders each in-plan tile as exactly one row. The
 * `sltile-` prefix also cannot collide with `slfold-`.
 */
export function benchTileAnchorId(tile: string): string {
  return `sltile-${tile}`;
}

/**
 * `'auto'` (an instant jump) when the reader asked for reduced motion, else
 * `'smooth'`. Defensive about `matchMedia` so a non-DOM environment (SSR, the
 * unit runner) can call it without a guard at every site.
 */
export function benchScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'smooth';
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  } catch {
    // matchMedia present but unusable (very old WebViews) — motion is the
    // shipped default, so fall back to it rather than to nothing.
    return 'smooth';
  }
}

/**
 * Scroll one of the bench's own anchors into view.
 *
 * `block: 'start'` + the anchor's `scroll-margin-top` (see `SLCAT_CSS`) is the
 * pair that puts the row BELOW the sticky chrome instead of underneath it.
 *
 * A missing element is a silent no-op by design — the bench legitimately does
 * not render a row for a tile the couple removed from their plan, and a doorway
 * should not throw over that. Callers that need to know whether the target
 * exists should check first; this returns whether it scrolled so they can.
 */
export function scrollBenchAnchor(id: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: benchScrollBehavior(), block: 'start' });
  return true;
}
