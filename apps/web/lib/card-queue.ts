/**
 * lib/card-queue.ts — ➕ "MAKE N CARDS" (ruling 5820, the ONE Add-a-service picker).
 *
 * The dashboard's Add a service lets a supplier pick several services, then press "Make N cards". That opens the
 * SHIPPED Card Maker for the first one (`/vendor-dashboard/services/new/<service>`, the kind fixed by the address) with
 * the rest on the address (`?then=a,b`). The maker posts them back (`card_queue`); a successful CREATE goes straight on
 * to the next service's maker, and the last one lands where a card always lands. A refusal stays on the same card with
 * the queue kept. Nothing is written for a card the supplier has not made — no draft rows, no invented prices.
 *
 * 🔒 Every key is shape-checked (the same `[a-z0-9_]` shape the maker's `return_to` allowlist accepts), de-duplicated
 * and capped — never an open redirect, never a path segment someone typed. PURE. 🔒 lib/card-queue.test.ts
 */

/** The query key the maker is opened with: the services still to make after this one. */
export const CARD_QUEUE_PARAM = 'then';
/** The hidden field the maker posts it in. */
export const CARD_QUEUE_FIELD = 'card_queue';
/** Most cards one press queues — more than any plan's per-press need, small enough that the address stays short. */
export const CARD_QUEUE_MAX = 12;

const KEY = /^[a-z0-9_]{1,64}$/;

/** The queue on an address or in a form — only well-shaped service keys, in order, once each, at most `CARD_QUEUE_MAX`. */
export function parseCardQueue(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 1200) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const k = part.trim();
    if (KEY.test(k) && !out.includes(k)) out.push(k);
    if (out.length === CARD_QUEUE_MAX) break;
  }
  return out;
}

/** The Card Maker for the first of `keys`, the rest queued behind it — null when there is nothing to make. */
export function cardMakerQueueHref(keys: readonly string[]): string | null {
  const clean = parseCardQueue(keys.join(','));
  const [first, ...rest] = clean;
  if (!first) return null;
  const base = `/vendor-dashboard/services/new/${first}`;
  return rest.length > 0 ? `${base}?${CARD_QUEUE_PARAM}=${rest.join(',')}` : base;
}

/** The words over a queued maker: "2 more after this: Lights, Sound" — null when nothing waits. */
export function cardQueueLine(rest: readonly string[], labelOf: (key: string) => string): string | null {
  if (rest.length === 0) return null;
  return `${rest.length} more after this: ${rest.map(labelOf).join(', ')}`;
}
