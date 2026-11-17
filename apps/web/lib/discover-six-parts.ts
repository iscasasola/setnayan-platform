/**
 * discover-six-parts.ts — the pure rules of Discover in six parts (owner 16 Nov, DECISION_LOG "Discover in six parts";
 * approved 41057aae · 45fd9c21 · 448fd3c1 · a85b0260; drawing `prototypes/discover_six_parts_2026-11-16/`).
 *
 *   1 People to follow · 2 Suppliers (verified only) · 3 Service cards · 4 Event stories · 5 Articles · 6 Inspiration
 *
 * after the viewer's own events and the upcoming shelves, which stay first. Two "See all" views open on `/` itself,
 * like the supplier view (`lib/discover-suppliers.ts`), each on keys the supplier view does NOT read, so opening one
 * never opens the other:
 *   · `?stories=1&occasion=<event type>&order=newest` — every published post-event story; Event type ▾ · Sort ▾.
 *   · `?inspiration=1&part=<part>` — inspiration from verified shops; Parts ▾.
 *
 * 🔒 SIGNED OUT, `/` IS THE PROMOTIONAL FRONT DOOR ONLY (ruling 41057aae · 448fd3c1). A search, the supplier view or
 * either "See all" view asks the visitor to sign in and comes back to the same address — never a dead control, never
 * the feed. Exact links stay open (a shop, its QR, an event page, a story) — those are other routes and are untouched.
 *
 * 🔒 app/_components/frontdoor/discover-in-six-parts.test.ts
 */
import { opensSupplierView } from '@/lib/discover-suppliers';
import { signInBackHereHref } from '@/lib/sign-in-back-here';

type ParamBag = Record<string, string | string[] | undefined>;

function firstOf(v: string | string[] | undefined): string {
  const one = Array.isArray(v) ? v[0] : v;
  return typeof one === 'string' ? one.trim() : '';
}

/**
 * Event stories' "See all" — Sort ▾. NEWEST ONLY, on purpose: the drawing also has "Most read", but no read count
 * ships for an event story — Event stories are editorials, and an editorial's `viewCount` is `null` BY DESIGN (a
 * couple's write-up never carries a public counter; `FrontDoorStory.viewCount`). Inventing one is an owner call.
 */
export const STORY_ORDERS = [{ value: 'newest', label: 'Newest' }] as const;
export type StoryOrder = (typeof STORY_ORDERS)[number]['value'];

export type DiscoverView =
  | { kind: 'feed' }
  | { kind: 'stories'; occasion: string | null; order: StoryOrder }
  | { kind: 'inspiration'; part: string | null };

/** Which of Discover's own views the address asks for. The supplier view is decided by `opensSupplierView`. */
export function discoverViewOf(params: ParamBag): DiscoverView {
  if (firstOf(params.stories) === '1') {
    const order = STORY_ORDERS.find((o) => o.value === firstOf(params.order))?.value ?? 'newest';
    return { kind: 'stories', occasion: firstOf(params.occasion) || null, order };
  }
  if (firstOf(params.inspiration) === '1') return { kind: 'inspiration', part: firstOf(params.part) || null };
  return { kind: 'feed' };
}

export const STORIES_SEE_ALL_HREF = '/?stories=1';
export const INSPIRATION_SEE_ALL_HREF = '/?inspiration=1';
/** Service cards' "See all" — the supplier view on `/`, which leads with service cards (`isLandingView`). */
export const SERVICE_CARDS_SEE_ALL_HREF = '/?browse=1';

/**
 * Signed out, the address `/` would otherwise answer with something other than the front door → where to send the
 * visitor instead (sign in, then back here). `null` = draw the front door.
 */
export function signedOutRedirect(params: ParamBag): string | null {
  const asks =
    firstOf(params.q).length > 0 || opensSupplierView(params) || discoverViewOf(params).kind !== 'feed';
  if (!asks) return null;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const one = firstOf(v);
    if (one) qs.set(k, one);
  }
  const query = qs.toString();
  return signInBackHereHref(query ? `/?${query}` : '/');
}

/**
 * What the Event stories shelf is handed: the stories when the read ANSWERED, `null` when it did not. An error is not
 * empty — `null` draws "Stories couldn't load", `[]` draws "The first event stories will land right here". The same
 * rule as `fetchGuestsByEventMeasured` (`lib/guests.ts`): the rows of a refused read are not the truth.
 */
export function eventStoriesShelfInput<S>(stories: S[], measured: boolean): S[] | null {
  return measured ? stories : null;
}
