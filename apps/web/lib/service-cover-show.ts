/**
 * service-cover-show.ts — THE PHOTOS ON A SERVICE CARD'S COVER, and the rules of the touch that flips them.
 *
 * ⚖ Owner, 12 Nov 2026: *"on service cards the photos will slideshow play so even if there is a bundle created, it
 * will also show the slideshow of all the services it includes."* · *"can we swipe it to go the the next photo?"* ·
 * *"incorporating this properly. check our events>suppliers>find page"* — then, on the one Suppliers prototype that
 * carries it: *"Yes, build it"* (DECISION_LOG 12 Nov "SERVICE CARD PHOTOS PLAY AS A SLIDESHOW"; corpus
 * `prototypes/service_card_slideshow_2026-11-12/`).
 *
 * Pure — no React, no DOM — so the face (a server component) can build the list and the tests can hold the gesture.
 * The drawing is `app/_components/service-face-cover-show.tsx`.
 *
 *   · THE LIST — the card's cover first, then its showcase photos (≤5), duplicates dropped, at most six in all.
 *   · A BUNDLE — one photo from each of its services in turn, each named by its service.
 *   · THE BEAT — the front door hero's: a new photo every 5 s (`front-door-hero.tsx` `LOOP_MS`), a 0.9 s fade.
 *   · THE SWIPE — `swipe-to-delete.tsx`'s rule: the direction is decided on the first 8 px; sideways 28 px flips one.
 */

/** One photo on the cover. `caption` names whose photo it is — only a bundle has one. */
export type CoverPhoto = { url: string; caption: string | null };

/** The cover plus up to five showcase photos (the grown card's own cap). The dots fit six at 80 px. */
export const MAX_COVER_PHOTOS = 6;

/** The front door hero's beat (`front-door-hero.tsx` `LOOP_MS`) — one photo every five seconds. */
export const COVER_BEAT_MS = 5000;

/** The first real movement decides the axis — the same 8 px as `swipe-to-delete.tsx` and Find's long-press slop. */
export const COVER_AXIS_PX = 8;

/** How far sideways a finger travels before the photo turns. One swipe = one photo. */
export const COVER_FLIP_PX = 28;

function clean(url: string | null | undefined): string | null {
  const u = typeof url === 'string' ? url.trim() : '';
  return u.length > 0 ? u : null;
}

/**
 * The photos a card's cover cycles through: the cover first (so a card with one photo looks exactly as it did), then
 * the rest, each once, at most six. Fewer than two → the caller draws the still cover it always drew.
 */
export function coverPhotoList(
  cover: string | null | undefined,
  photos: ReadonlyArray<string | CoverPhoto | null | undefined> | null | undefined,
  max: number = MAX_COVER_PHOTOS,
): CoverPhoto[] {
  const out: CoverPhoto[] = [];
  const seen = new Set<string>();
  const add = (url: string | null, caption: string | null) => {
    if (!url || seen.has(url) || out.length >= max) return;
    seen.add(url);
    out.push({ url, caption });
  };
  add(clean(cover), null);
  for (const p of photos ?? []) {
    if (p == null) continue;
    if (typeof p === 'string') add(clean(p), null);
    else add(clean(p.url), p.caption ?? null);
  }
  return out;
}

/**
 * A BUNDLE'S COVER — one photo from each of its services in turn ("Mobile bar → Photo booth → Lights → Mobile bar …"),
 * so a couple meets every service in the first beats. Each photo carries its service's name.
 */
export function interleaveServicePhotos(
  services: ReadonlyArray<{ name: string; urls: ReadonlyArray<string | null | undefined> }>,
  max: number = MAX_COVER_PHOTOS,
): CoverPhoto[] {
  const lists = services.map((s) => ({
    name: s.name,
    urls: s.urls.map(clean).filter((u): u is string => u != null),
  }));
  const ordered: CoverPhoto[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.urls.length));
  for (let round = 0; round < longest; round++) {
    for (const l of lists) {
      const url = l.urls[round];
      if (url) ordered.push({ url, caption: l.name });
    }
  }
  return coverPhotoList(null, ordered, max);
}

/** One finger's progress across the cover. */
export type CoverDrag = { x: number; y: number; axis: 'x' | 'y' | null; flipped: boolean };

/**
 * One move of a finger that went down on the cover. Returns the drag as it now stands, and the step to take
 * (+1 next, −1 back) when this move is the one that turns the photo.
 *
 *   · under 8 px either way → nothing is decided yet (a still finger is a tap — or Find's long-press, untouched);
 *   · decided UP/DOWN → the page scrolls, the photo never turns;
 *   · decided SIDEWAYS → at 28 px the photo turns once; the rest of that swipe does nothing more.
 */
export function coverDragMove(d: CoverDrag, x: number, y: number): { drag: CoverDrag; step: 1 | -1 | 0 } {
  const dx = x - d.x;
  const dy = y - d.y;
  let axis = d.axis;
  if (axis === null) {
    if (Math.abs(dx) < COVER_AXIS_PX && Math.abs(dy) < COVER_AXIS_PX) return { drag: d, step: 0 };
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  }
  if (axis === 'y' || d.flipped || Math.abs(dx) < COVER_FLIP_PX) return { drag: { ...d, axis }, step: 0 };
  return { drag: { ...d, axis, flipped: true }, step: dx < 0 ? 1 : -1 };
}

/** The photo after a step, wrapping both ways. */
export function coverStep(index: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + step) % count) + count) % count;
}
