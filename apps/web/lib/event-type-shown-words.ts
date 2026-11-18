/**
 * 🗣 THE WORD SHOWN FOR AN EVENT TYPE — "event", never "celebration" (the owner's standing word rule, DECISION_LOG
 * "ONE WORD: EVENT"; walk 13 Nov 2026, F-W1-06; walk W4/W5 18 Nov 2026, R7).
 *
 * The admin roster (`event_type_vocab`) labels its generic row `celebration` → "Celebration". Wherever that roster is
 * offered as a choice, only the WORD changes: the key stays `celebration`, so `?event_type=celebration` and every
 * stored row keep working. One rule, used by:
 *   · the supplier door's "Events you serve" (`app/open-shop/_components/event-tiles.tsx` → `supplierEventWords`);
 *   · Discover's Occasion filter (`front-door.tsx` → the shared filter drawer) and its Event stories "Event type" pick.
 *
 * A plain module (no 'use client'): a server page can call it before the roster crosses to the client.
 * 🔒 lib/event-type-shown-words.test.ts
 */

/** The generic event type's KEY in `event_type_vocab` — data, never drawn. */
export const GENERIC_EVENT_TYPE_KEY = 'celebration';

/** What the generic type is called wherever the roster is a list of choices. */
export const GENERIC_EVENT_TYPE_WORD = 'Other events';

/** The roster with the house words — the same rows, the same keys, only the generic row's label changed. */
export function eventTypeShownWords<T extends { key: string; label: string }>(options: readonly T[]): T[] {
  return options.map((e) => (e.key === GENERIC_EVENT_TYPE_KEY ? { ...e, label: GENERIC_EVENT_TYPE_WORD } : e));
}
