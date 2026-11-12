/**
 * 🍽 "NOT COUNTED FOR ▾" — a guest who comes but is left out of ONE booked service's headcount (owner 2026-11-02,
 * DECISION_LOG "NOT COUNTED FOR ▾"). Owner, verbatim: *"what if there are guests that accepted are not counted for for
 * head count for specific services. so a dropdown above passed away or a place to set this. it will list all booked
 * services to pick if they are not counted?"* → *"yes. just to prevent caterers counting attendees not counted"*.
 *
 * The couple ticks booked services on the guest card (`guest_not_counted_for`, migration 20271302857885); the default —
 * nothing ticked — is counted for all. Each ticked service's supplier headcount leaves the guest out (the three SQL
 * readers); every other service still counts them. The supplier sees the number only, never who or why.
 *
 * The same shape as Passed away ("listed, not counted" — `a-guest-who-passed-away-is-listed-not-counted.test.ts`): the
 * guest stays on the list, and the list's row says so quietly — "Not counted for Catering".
 *
 * PURE — no reads, no labels table: the card and the list are handed the words by the server
 * (`guest-not-counted.server.ts`), so nothing here weighs on a client bundle.
 * 🔒 lib/a-guest-not-counted-for-a-service.test.ts · tests/db/a-guest-not-counted-for-a-service.db.test.ts
 */

/** The card's posted value: the ticked bookings (`event_vendors.vendor_id`), comma-joined in the list's order. */
export const NOT_COUNTED_FIELD = 'not_counted_for';
/**
 * Posted with the dropdown, ALWAYS — a multi-choice with nothing ticked posts nothing, so without it "the host unticked
 * every service" and "this form has no such row" (a stale tab, the Maker's card) would be the same absence, and the
 * second would count a guest the couple left out. No marker → nothing is changed (the `groups_posted` rule).
 */
export const NOT_COUNTED_POSTED = 'not_counted_posted';

/**
 * 🧮 WHICH SERVICES ARE LISTED (owner 2026-11-04): every supplier on the event — considering, quoted or booked — whose
 * service card is priced PER HEAD (*"not counted for will be for service cards with pax only"*). A tick on one not yet
 * booked applies the moment it is booked; the supplier readers only ever count booked ones. The list, its words and
 * each service's count come from ONE read (`get_event_service_counts`, `lib/supplier-count.ts`).
 */
export type { CountedService as BookedService } from '@/lib/supplier-count';

/** The dropdown's button while nothing is ticked — the default. */
export const COUNTED_FOR_ALL = 'Counted for all';

/** The row's ⓘ — the title and the button stay visible; this is the rest (house rule: detail lives in the ⓘ). */
export const NOT_COUNTED_ABOUT =
  'Tick a service that should not count this guest, like a toddler who doesn’t eat from the buffet. That supplier’s headcount leaves them out, and every other service still counts them. Only services priced per head are listed. The supplier sees the number only, never who.';

/** "Not counted for Catering" · "Not counted for Catering, Photo Booth" — null when nothing is ticked. */
export function notCountedWords(labels: readonly string[]): string | null {
  const named = labels.map((l) => l.trim()).filter(Boolean);
  return named.length > 0 ? `Not counted for ${named.join(', ')}` : null;
}

/** The posted value → the booking ids it names (blank and repeated ones dropped). */
export function parseNotCounted(raw: string): string[] {
  return [...new Set(raw.split(',').map((v) => v.trim()).filter(Boolean))];
}

/**
 * The bookings to leave this guest out of after a save, as a DIFF from what the card started from (two hosts never
 * overwrite each other — `lib/guest-card-merge.ts`): a tick another screen added and this one never saw stays; a tick
 * this card took off goes; a tick this card added joins. Without a base (an older form): exactly what was posted.
 * Only this event's listed (per-head) services are ever kept (`booked`).
 */
export function notCountedAfterSave(
  have: readonly string[],
  picked: readonly string[],
  booked: ReadonlySet<string>,
  base?: readonly string[],
): { add: string[]; drop: string[] } {
  const ours = new Set(have.filter((id) => booked.has(id)));
  const want = new Set<string>();
  if (base) {
    const was = new Set(base);
    const now = new Set(picked);
    for (const id of ours) if (!(was.has(id) && !now.has(id))) want.add(id);
    for (const id of now) if (!was.has(id) && booked.has(id)) want.add(id);
  } else {
    for (const id of picked) if (booked.has(id)) want.add(id);
  }
  return {
    add: [...want].filter((id) => !ours.has(id)),
    drop: [...ours].filter((id) => !want.has(id)),
  };
}

/**
 * 🍽 A KIDS MEAL SUGGESTS "NOT COUNTED" (owner 2026-11-12, DECISION_LOG "THE QUOTE FOLLOWS EACH SERVICE'S OWN COUNT · KIDS
 * MEAL SUGGESTS 'NOT COUNTED'"). Owner chose *"Suggest it, couple taps"*: a guest whose meal is `kids` gets a one-tap
 * suggestion on their card per BOOKED per-head service they are still counted for — never automatic (some caterers charge
 * kids' plates). Since the quote now follows each service's own count (`quote_follow_guest_count`), the tick is money.
 *
 * Pure: which services to suggest. Nothing here ticks anything — the card ticks only when the couple taps.
 */
export const KIDS_MEAL = 'kids';

export function kidsCountSuggestions<S extends { id: string; booked: boolean }>(
  meal: string | null | undefined,
  services: readonly S[],
  picked: readonly string[],
  dismissed: readonly string[] = [],
): S[] {
  if (meal !== KIDS_MEAL) return [];
  return services.filter((s) => s.booked && !picked.includes(s.id) && !dismissed.includes(s.id));
}

/** "Leave out of Catering’s count?" */
export function kidsSuggestionWords(label: string): string {
  return `Leave out of ${label.trim()}’s count?`;
}
