/**
 * pin-room.ts — 📌 AN OPENED ROW CAN ALWAYS REACH THE TOP (owner 2026-10-25, live, the event's Suppliers page: *"when i
 * tapped food trucks it should expand and pin foodtrucks on the top"*; *"we already used to have these both working"*).
 *
 * The bench's landing (`shortlist-categories.tsx` → `scrollBenchAnchor`, since c45748a2c2 on 2026-10-08) scrolls an
 * opened category's row to the top, under the pinned block — and it still runs, unchanged. What fails is the PAGE: a
 * browser cannot scroll past the document's end, so a category low in the list (Food Truck, HMUA — the last rows) with
 * a short body stops wherever the page ends, low on screen, its "To compare" and "Not needed · Remove" under the thumb
 * row. Walked 2026-10-25 on /dev/suppliers-lab at 1280: the last row opened with its head 394 px below the pin line and
 * `scrollY === scrollHeight − innerHeight` — the scroll ran and was clamped. (The lab's own `pb-28` hid most of this;
 * the real column ends ~100 px sooner, and from #6858 the computer's thumb row ate what was left.)
 *
 * The fix is room, not a different scroll: before the landing scrolls, the holder gets exactly the padding the page
 * is short of (`--pin-room`), so the row's top can rest on its own `scroll-margin-top` line. It is measured again when
 * the unfold has finished (the body's real height), and dropped when nothing is open.
 *
 * 🔒 Held by `lib/an-opened-row-reaches-the-top.test.ts`.
 */

/** The custom property on the holder whose padding-bottom is the room. */
export const PIN_ROOM_VAR = '--pin-room';

/**
 * How much page is missing for `targetTop` (document px) to rest `margin` px under the top of a `viewport`-tall screen,
 * given `content` px of document without any pin room (pure). 0 when the page is already long enough.
 */
export function pinRoomPx(m: { targetTop: number; margin: number; viewport: number; content: number }): number {
  const need = m.targetTop - m.margin + m.viewport - m.content;
  return need > 0 ? Math.ceil(need) : 0;
}

/** How far the page still cannot reach for `targetTop` to rest on its `margin` line (pure). 0 when it can. */
export function pinRoomShortfall(m: { targetTop: number; margin: number; maxScroll: number }): number {
  const missing = m.targetTop - m.margin - m.maxScroll;
  return missing > 0.5 ? Math.ceil(missing) : 0;
}

/** Give `holder` the room `target` needs to be scrolled to its `scroll-margin-top` line. Returns the room in px. */
export function makeRoomToPin(target: HTMLElement, holder: HTMLElement): number {
  if (typeof window === 'undefined') return 0;
  const current = parseFloat(holder.style.getPropertyValue(PIN_ROOM_VAR)) || 0;
  const targetTop = target.getBoundingClientRect().top + window.scrollY;
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  let px = pinRoomPx({
    targetTop,
    margin,
    viewport: window.innerHeight,
    content: document.documentElement.scrollHeight - current,
  });
  if (px > 0) holder.style.setProperty(PIN_ROOM_VAR, `${px}px`);
  else holder.style.removeProperty(PIN_ROOM_VAR);
  // 🪤 A PAGE SHORTER THAN THE SCREEN HIDES HOW SHORT IT IS (2026-10-29, a new event's Find at 768): the column is
  // `min-h-screen`, so `scrollHeight` reads the SCREEN, not the content, and the room above came out short by exactly
  // the difference — the opened row stopped 21 px under the pinned row. Read the page's real reach once the room is
  // in, and add what is still missing (`pinRoomShortfall`).
  for (let pass = 0; pass < 2; pass += 1) {
    const missing = pinRoomShortfall({
      targetTop,
      margin,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    });
    if (missing <= 0) break;
    px += missing;
    holder.style.setProperty(PIN_ROOM_VAR, `${px}px`);
  }
  return px;
}

/** Nothing is open any more — the page goes back to its own length. */
export function dropPinRoom(holder: HTMLElement | null): void {
  holder?.style.removeProperty(PIN_ROOM_VAR);
}
