/**
 * maker-section-find.ts — which element on the canvas a Maker navigator key
 * points at.
 *
 * 📦 WHY THIS IS ITS OWN MODULE (2026-09-30, #6187). The Maker needs only this
 * lookup (`buffered-canvas-frame.tsx`, `scene-snapshot.ts`), but it used to
 * import it from `editor-bridge.tsx` — the guest page's whole ~32KB editing
 * bridge. Imported from both the Maker and the guest page, the bridge became a
 * chunk of its own, and every async chunk costs an entry in webpack's runtime,
 * which ships on EVERY page under the shared-bundle ceiling
 * (`scripts/check-bundle-size.mjs`). The Maker now imports this file; the
 * bridge imports and re-exports it.
 */

/** Legacy row keys → the DOM ids the site already renders. */
const SECTION_IDS: Record<string, string> = {
  home: 'site-home',
  hero: 'site-home',
  details: 'site-details',
  // On the day the Event Bar's "Schedule" tab lands on the day's details.
  schedule: 'site-details',
  story: 'site-story',
  gallery: 'site-gallery',
  me: 'site-me',
  'f:entourage': 'site-entourage',
  'f:story': 'site-story',
};

/** 🎨 A section's picture laid over the page's own (`scene-look-lay.ts`), and the page's own section it hides. */
export const SCENE_LOOK_COPY_ATTR = 'data-maker-look-copy';
export const SCENE_LOOK_HIDDEN_ATTR = 'data-maker-look-hidden';

/** The section a marker stands in front of: its next element that is not a marker — or, while a style pick's
 *  picture is laid over it (`scene-look-lay.ts`), that picture: what the page SHOWS, where the next pick draws. */
export function sectionAfter(marker: Element): HTMLElement | null {
  const next = marker.nextElementSibling;
  if (!next || next.hasAttribute('data-maker-section')) return null;
  if (next.hasAttribute(SCENE_LOOK_HIDDEN_ATTR)) {
    const laid = next.nextElementSibling;
    if (laid && laid.getAttribute(SCENE_LOOK_COPY_ATTR) === marker.getAttribute('data-maker-section')) return laid as HTMLElement;
  }
  return next as HTMLElement;
}

/** The element a navigator key points at, or null when this stage draws none. */
export function findMakerSection(doc: Document, key: string): HTMLElement | null {
  const marker = doc.querySelector(`[data-maker-section="${CSS.escape(key)}"]`);
  if (marker) return sectionAfter(marker);
  const id = SECTION_IDS[key];
  if (!id) return null;
  const anchor = doc.getElementById(id);
  if (!anchor) return null;
  // A zero-height anchor marks a region; the region is its nearest section-ish ancestor.
  if (anchor.offsetHeight > 0) return anchor;
  return (anchor.closest('section, article, div[id]') as HTMLElement | null) ?? anchor;
}

/**
 * 📍 THE SECTION THE COUPLE IS LOOKING AT — the first section whose bottom is
 * below `line` (px from the top of the canvas viewport). Owner, live phone test
 * 2026-10-02: after Apply the canvas reloaded onto the RSVP page while Page ▾
 * still said "Invitation › Welcome". The Maker now keeps THIS section in place
 * across a reload (`carryScroll`) and names its page in Page ▾ as the canvas
 * scrolls (`editor-shell.tsx`). Null when the page draws no marked section.
 */
export function makerSectionInView(doc: Document, line = 0): string | null {
  for (const marker of Array.from(doc.querySelectorAll('[data-maker-section]'))) {
    const section = sectionAfter(marker);
    if (!section) continue;
    const r = section.getBoundingClientRect();
    if (r.height > 0 && r.bottom > line) return marker.getAttribute('data-maker-section');
  }
  return null;
}

/** ✋ Fired on the canvas's own document the moment an in-place redraw is about to commit (the bridge's
 *  `BeforeRedrawCommits`) — what the Maker laid on the page ahead of a save is taken off right then
 *  (the Maker's drag engine). Here, not in the bridge, because the Maker never imports the bridge. */
export const CANVAS_REDRAW_COMMITS_EVENT = 'setnayan:canvas-redraw-commits';
