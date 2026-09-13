/**
 * lib/reveal-once-per-visit.ts — a guest meets the reveal ONCE on the way in.
 *
 * Owner, 2026-09-11 (Q6 = B, DECISION_LOG "the seven invite-theme questions"):
 * *"A guest who has just come through the invite doors does not meet the Event
 * Hub's reveal again on that visit; later visits play it as usual."*
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 * Since #5410 a Pro invite theme opens on the couple's cinematic reveal. Door 03
 * then hands the guest into the Event Hub — which opens on the SAME reveal, from
 * the same event, under the same rule. So the veil a guest had just lifted came
 * straight back down on the next page. Both halves were right on their own; it
 * is their sequence that is wrong, and nothing in either half could see it.
 *
 * ── SESSION, NOT LOCAL, AND THAT IS THE RULING ──────────────────────────────
 * `sessionStorage` is per-tab and dies with it, which is exactly "on that
 * visit". `localStorage` would mean a couple's reveal plays for a given guest
 * once, ever — that is a different and much bigger decision, and not the one the
 * owner made.
 *
 * ── KEYED PER EVENT ─────────────────────────────────────────────────────────
 * A guest can hold two invitations in one tab. Remembering "a reveal was seen"
 * without remembering WHOSE would silence the second couple's opening on the
 * strength of the first couple's.
 *
 * ── PURE, AND THE STORE IS AN ARGUMENT ──────────────────────────────────────
 * No React, no `window`. `Storage` access THROWS outright in some contexts —
 * Safari private browsing, a browser set to block site data, an embedded
 * preview — so every call is wrapped, and a store that cannot answer is read as
 * "not seen": the reveal playing twice is a small annoyance, and suppressing a
 * paid opening on a false negative is not.
 */

/** The one storage-key shape. Written once, never re-typed at a call site. */
export const REVEAL_SEEN_PREFIX = 'sn-reveal-seen:' as const;

/** The narrow slice of `Storage` this needs — so a test can hand it a fake. */
export type RevealSeenStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function revealSeenKey(eventId: string): string {
  return `${REVEAL_SEEN_PREFIX}${eventId}`;
}

/**
 * Has this tab already played THIS event's reveal?
 *
 * False for a missing store, a missing event id, or a store that throws. Both
 * "no" answers are deliberate: an unmeasured state must not silence an opening
 * the couple paid for.
 */
export function revealAlreadySeen(
  store: RevealSeenStore | null | undefined,
  eventId: string | null | undefined,
): boolean {
  if (!store || !eventId) return false;
  try {
    return store.getItem(revealSeenKey(eventId)) === '1';
  } catch {
    return false;
  }
}

/** Remember that this tab has now played this event's reveal. Never throws. */
export function markRevealSeen(
  store: RevealSeenStore | null | undefined,
  eventId: string | null | undefined,
): void {
  if (!store || !eventId) return;
  try {
    store.setItem(revealSeenKey(eventId), '1');
  } catch {
    /* a store that refuses to remember simply plays the reveal again */
  }
}
