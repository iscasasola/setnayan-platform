/**
 * 👁 THE WHOLE PAGE AS A GUEST, INSIDE THE MAKER'S CANVAS (`editor-bridge.tsx` `guest`) — the one decision that can be
 * executed without a browser: does this link LEAVE the page?
 *
 * The canvas is the couple's page in a frame, with `?editor=1` in its address. A link that goes anywhere else — another
 * site, another route, the same route without the canvas's own query, a new tab or the top window — would walk the
 * frame (or the Maker) away, so the preview refuses it. A link to a place ON this page (`#rsvp`) is followed: that
 * is the page working.
 */
export function guestLinkLeaves(href: string, target: string | null | undefined, here: string): boolean {
  let to: URL;
  let from: URL;
  try {
    from = new URL(here);
    to = new URL(href, from);
  } catch {
    return true;
  }
  if (target && target !== '_self') return true;
  if (to.protocol !== from.protocol || to.host !== from.host) return true;
  return to.pathname !== from.pathname || to.search !== from.search;
}
