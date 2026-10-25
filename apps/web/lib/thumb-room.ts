/**
 * thumb-room.ts — ⬇ A PAGE WITH A FLOATING THUMB ROW LEAVES ROOM FOR IT (owner 2026-10-25, live, the event's Suppliers
 * page on his computer: *"the suppliers page does not scroll up anymore so i can add more categories. what happened?"* —
 * the last line, "Need something else? ＋ Add to your event", stayed under ⇕ · Search suppliers · ＋ however far he
 * scrolled; and *"we already used to have these both working"*).
 *
 * WHY IT BROKE. The page's room for its thumb row was a per-page number: Find's body carried `max-tab:pb-16`, i.e. room
 * on a PHONE only; from 701 px the event column reserves nothing (`[data-shell-main]` → 0 — "the dock is gone"). That
 * held while the computer's row was a 720-px box parked at the RIGHT edge (`lg:right-7 lg:w-[720px]`), so the list's
 * left half — "Need something else?" and its dropdown — sat beside it, not under it. `a7a91422e2` (2026-10-23, "Home,
 * Guests and Suppliers fill the body column from 1024", PR #6858) stretched the row across the whole body column
 * (`--sup-col-left/-right/-w`), and from then the row covered the full width of the last ~80 px of the page, with no
 * room under it to scroll into.
 *
 * THE ROOT FIX — ONE MEASURED TOKEN, NOT A NUMBER PER PAGE. Every floating thumb row (the shared `<ThumbRow>` mounts
 * this itself; a bar that is not a ThumbRow — Build's — calls `useThumbRoom`) measures how much of the screen's foot it
 * covers and publishes the largest on `<html>` as `--sn-thumb-room` (that height + `THUMB_ROOM_BREATH`; unset when no
 * row floats). Every page column that clears the bottom chrome pads by `max(its dock clearance, --sn-thumb-room)`
 * (globals.css `[data-shell-main]`, the account / launcher / supplier `<main>`s), so the last element can always scroll
 * above the row — on a phone (where the row stands on the dock and the measurement includes it) and from 701 (where the
 * dock is gone and the row sits on the page's foot) alike, and whatever the row's width.
 *
 * What counts as floating: the row's nearest `position: fixed` ancestor (or itself) anchored by its `bottom`. A row in
 * the page's flow needs no room. A host marked `data-on="false"` has slid away (Find while Build shows) and counts 0.
 * While the keyboard is up (`html[data-keyboard="open"]`) the reading is held — the riding band reserves its own room
 * (`html[data-ride-reserve]`), and the row's lift onto the keyboard must not grow the page too.
 *
 * 🔒 Held by `lib/a-thumb-row-leaves-room.test.ts` (the arithmetic, the CSS consumers, the mount in ThumbRow).
 */
import { useEffect, type RefObject } from 'react';

/** The `<html>` custom property every page column reads. */
export const THUMB_ROOM_VAR = '--sn-thumb-room';
/** Space kept between the last element and the row's top. */
export const THUMB_ROOM_BREATH = 16;

/**
 * Room a fixed, bottom-anchored row needs (pure): its host's `bottom` offset, plus everything from the row's top to the
 * host's foot (the row and the host's own bottom padding), plus the breath. Transforms move host and row together, so
 * the difference is the layout distance whether or not the row is mid-slide.
 */
export function thumbRoomPx(m: { cssBottom: number; hostBottom: number; rowTop: number }): number {
  const covered = m.cssBottom + (m.hostBottom - m.rowTop);
  if (!Number.isFinite(covered) || covered <= 0) return 0;
  return Math.ceil(covered) + THUMB_ROOM_BREATH;
}

const rooms = new Map<object, number>();

function publish(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let max = 0;
  for (const v of rooms.values()) max = Math.max(max, v);
  const next = max > 0 ? `${max}px` : '';
  if (root.style.getPropertyValue(THUMB_ROOM_VAR) === next) return;
  if (next) root.style.setProperty(THUMB_ROOM_VAR, next);
  else root.style.removeProperty(THUMB_ROOM_VAR);
}

/** The row's nearest fixed ancestor (or itself), when it is anchored by its `bottom`. */
function fixedHost(el: HTMLElement): HTMLElement | null {
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.position !== 'fixed') continue;
    return Number.isFinite(parseFloat(cs.bottom)) ? n : null;
  }
  return null;
}

/** Measure one row now: 0 when it is not floating, not drawn, or slid away. */
export function measureThumbRoom(row: HTMLElement): number {
  const host = fixedHost(row);
  if (!host || host.getAttribute('data-on') === 'false') return 0;
  const r = row.getBoundingClientRect();
  if (r.height <= 0 || r.width <= 0) return 0;
  return thumbRoomPx({
    cssBottom: parseFloat(getComputedStyle(host).bottom),
    hostBottom: host.getBoundingClientRect().bottom,
    rowTop: r.top,
  });
}

/**
 * ⬇ Publish this row's room for as long as it is mounted. `ThumbRow` calls it for every row; a floating bar drawn
 * without ThumbRow (Build's) calls it on its own row element.
 */
export function useThumbRoom(rowRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof window === 'undefined') return;
    const key = {};
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (root.getAttribute('data-keyboard') === 'open') return; // held while typing
      const px = measureThumbRoom(row);
      if (px > 0) rooms.set(key, px);
      else rooms.delete(key);
      publish();
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(later) : null;
    ro?.observe(row);
    const host = fixedHost(row);
    if (host && host !== row) ro?.observe(host);
    // The dock's height (`--sn-bottomdock-h`, on <html>) moves a phone row; the host slides by `data-on`.
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(later) : null;
    mo?.observe(root, { attributes: true, attributeFilter: ['style', 'class', 'data-keyboard'] });
    if (host) mo?.observe(host, { attributes: true, attributeFilter: ['data-on', 'class'] });
    window.addEventListener('resize', later);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', later);
      rooms.delete(key);
      publish();
    };
  }, [rowRef]);
}
