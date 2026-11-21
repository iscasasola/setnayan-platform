/**
 * 👀↩ BACK FROM "VIEW SHOP" RETURNS TO THE SCREEN BEFORE IT (owner 21 Nov 2026, verbatim: *"pressing back from the view
 * shop. returned to user profile page. it should have be from their last page which would probably be from supplier
 * dashboard> shop"* · *"back should go back to their last screen before they viewed it"*).
 *
 * WHAT WAS BROKEN (measured live, www.setnayan.com/vendor-dashboard/shop → View shop): the Shop tab shows the shop's own
 * public page inside a full-screen frame (`ViewShopScreen`, shop-cover.tsx). That framed page had no arrival, so its
 * Back pill read "Home" → `/dashboard?hub=1`, and a press either drew Home inside the frame or — through the frame's
 * share of the tab's history — stepped the whole tab back past Shop.
 *
 * THE RULE:
 *   · The frame and "Open in browser" open the page WITH its arrival: `?src=page&from=/vendor-dashboard/shop`
 *     (`VIEW_SHOP_FROM`, the shipped `withShopArrival` / `SHOP_ARRIVAL_SRC.page`) — so a new tab's Back goes to Shop.
 *   · Inside the frame, Back does not navigate at all: it tells the frame to close (`VIEW_SHOP_CLOSE`), and the person
 *     is on Shop exactly as they left it — the screen before they viewed it.
 *
 * 🔒 lib/back-from-view-shop-returns-to-shop.test.ts
 */
import { SHOP_ARRIVAL_SRC, withShopArrival } from './shop-back';

/** Where View shop is opened from — the supplier's Shop tab. */
export const VIEW_SHOP_FROM = '/vendor-dashboard/shop';

/** The marker on the frame element (`data-view-shop-frame`) the framed page looks for before it closes anything. */
export const VIEW_SHOP_FRAME_ATTR = 'data-view-shop-frame';

/** The event the framed page fires on its own frame element; `ViewShopScreen` closes on it. */
export const VIEW_SHOP_CLOSE = 'sn-view-shop-close';

/** The shop's public path, carrying "came from Shop" so its Back names and reaches Shop. */
export function viewShopSrc(path: string): string {
  return withShopArrival(path, { src: SHOP_ARRIVAL_SRC.page, from: VIEW_SHOP_FROM });
}

/**
 * The frame this page is shown in, when it is OUR View shop frame (same origin, marked). Null anywhere else — a normal
 * tab, a foreign frame (cross-origin `frameElement` is null), or a frame we did not mark.
 */
export function viewShopFrame(win: Window): Element | null {
  try {
    if (win.self === win.top) return null;
    const el = win.frameElement;
    return el && el.hasAttribute(VIEW_SHOP_FRAME_ATTR) ? el : null;
  } catch {
    return null;
  }
}
