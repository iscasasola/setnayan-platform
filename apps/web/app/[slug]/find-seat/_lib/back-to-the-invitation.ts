import { SITE_MENU_ANCHORS } from '../../_lib/site-menu';

/**
 * ⬅ "BACK TO THE INVITATION" LANDS ON THE INVITATION, NOT ITS FRONT COVER.
 *
 * Owner 2026-09-28, verbatim, on the round back button of Find your seat:
 * *"pressing this lead be back to invitation but the actual invitation with
 * event bar."*
 *
 * ── WHAT IT DID ─────────────────────────────────────────────────────────────
 * The button was a bare `/${slug}`. That address is the Event Hub's FRONT
 * DOOR: it opens on the hero scene, and on a Pro theme the couple's opening
 * (seal · envelope · veil) plays over it — `RevealOverlay` with
 * `oncePerVisit="defer"`, which the hub itself never records, so it plays
 * AGAIN on every bare load. A guest who stepped out to check their table was
 * sent back through the front cover instead of to the page they left.
 *
 * ── WHAT IT DOES ────────────────────────────────────────────────────────────
 * It lands on the Details scene (`#site-details`) — where "Your seat · Table N
 * →" / "Find your seat →" lives (`SeatDoorLine`), i.e. where they came from —
 * on the same stage, with the Event Bar pinned under it:
 *
 *   · the HASH is what stands the opening down: `landedOnTheFirstPage`
 *     (`lib/reveal-stages.ts`) answers "no" for any hash, so a first-page-only
 *     opening (every stage but the Save the Date) does not replay;
 *   · the stage and the key TRAVEL: whichever of the invitation's own view
 *     params this page was opened with (`phase` — a host's or demo stage
 *     preview; `as`; `invite` — the guest's key) are carried back, so the page
 *     they return to is the stage they were looking at. The server still
 *     re-checks every one of them; carrying a param grants nothing.
 *
 * ── AND NEVER OUT OF THE MAKER'S CANVAS ─────────────────────────────────────
 * Inside the Maker the page is an iframe whose `src` is the canvas address
 * (`/slug?editor=1&phase=…`). A bare `/${slug}` navigated that frame to the
 * plain GUEST page — no editor bridge, no draft — which the Maker then showed
 * as if it were the canvas. `canvasReturnHref` sends the frame back to its own
 * `src` instead; `SeatBackLink` reads it on the client.
 */

/** The invitation's own view params — the only ones worth carrying back. */
export const INVITATION_VIEW_PARAMS = ['phase', 'as', 'invite'] as const;

/** The scene the seat door sits in — the page the guest left. */
export const FIND_SEAT_RETURN_ANCHOR = SITE_MENU_ANCHORS.details;

type SearchLike = Record<string, string | string[] | undefined> | URLSearchParams | null | undefined;

function readParam(search: SearchLike, key: string): string | null {
  if (!search) return null;
  if (search instanceof URLSearchParams) return search.get(key);
  const v = search[key];
  const one = Array.isArray(v) ? v[0] : v;
  return typeof one === 'string' ? one : null;
}

/** Where a GUEST lands: the invitation, same stage, past the front cover. */
export function findSeatBackHref(slug: string, search?: SearchLike): string {
  const qs = new URLSearchParams();
  for (const key of INVITATION_VIEW_PARAMS) {
    const v = readParam(search, key)?.trim();
    if (v) qs.set(key, v);
  }
  const q = qs.toString();
  return `/${encodeURIComponent(slug)}${q ? `?${q}` : ''}#${FIND_SEAT_RETURN_ANCHOR}`;
}

/**
 * Where the MAKER'S CANVAS goes back to: the frame's own `src`, when it is this
 * event's page on this origin. Null — keep the guest address — for anything
 * else (not framed, a cross-origin frame, a frame pointed somewhere else).
 */
export function canvasReturnHref(frameSrc: string | null | undefined, slug: string, origin: string): string | null {
  if (!frameSrc) return null;
  let url: URL;
  try {
    url = new URL(frameSrc, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const last = url.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  let lastDecoded = last;
  try {
    lastDecoded = decodeURIComponent(last);
  } catch {
    /* a malformed segment simply will not match */
  }
  if (lastDecoded !== slug) return null;
  return `${url.pathname}${url.search}`;
}
