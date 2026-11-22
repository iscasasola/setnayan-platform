/**
 * lib/today-wrap-up.ts — ✓ AN EVENT FINISHED: CHECK, CONFIRM, SHARE (Today v3 part 3 · pure, no I/O, no clock).
 *
 * Owner, 19 Nov 2026, on the drawing `Today, tap opens a card` v3.5 (V3 · 1): *"we check all the photos to be added to
 * that event and inspiration. and see all the reviews you received. then when supplier confirms, send the photos to
 * share with the clients event story. if the client do not respond, it means they accepted the photos. nothing will be
 * removed."* · *"All shares but only Ultra shows."* · on a hidden photo: *"only on couple's"*.
 *
 *   · ONE Today row per finished event; tapped, its card holds three steps — Photos · Reviews · Confirm.
 *   · It REPLACES v2's quick "I delivered this service" only when the event has photos or reviews; an event with
 *     neither keeps the quick row as it is (the drawing's small call).
 *   · Photos: every photo the supplier filed for the event, ALL ticked (zero taps for the common case — "nothing will
 *     be removed"); ★ Inspiration: NONE starred (shown to every couple, Setnayan checks each one).
 *   · Confirm does it all in one tap: delivered · the ticked photos to the couple's story (kept on every plan, shown
 *     only on Supplier Ultra) · the starred ones to Inspiration.
 *   · Silence = accepted, after the owner's number of days (Admin › Settings). Not set → nothing is accepted by silence.
 *
 * 🔒 lib/today-wrap-up.test.ts · app/vendor-dashboard/_components/today-wrap-up-is-one-card.test.ts
 */

export type WrapUpPhoto = { fileId: string; url: string; serviceTitle: string | null };
export type WrapUpReview = { reviewId: string; name: string; rating: number; line: string | null; replied: boolean };
export type WrapUpPart = { slotKey: string; label: string };

export type WrapUpFacts = {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  photos: WrapUpPhoto[];
  reviews: WrapUpReview[];
  /** The inspirations this event's cards offer (`readEventTagBoard`) — where a ★ photo can sit. */
  parts: WrapUpPart[];
  /** The shop is on Supplier Ultra now — its shared photos show in the story. */
  ultra: boolean;
  /** `platform_settings.story_photo_silence_days`; null = not set (the Confirm line about it is not drawn). */
  silenceDays: number | null;
};

/** Does this finished event get the wrap-up card? Only with photos or reviews to check. */
export function wrapUpApplies(f: Pick<WrapUpFacts, 'photos' | 'reviews'> | null | undefined): boolean {
  return Boolean(f && (f.photos.length > 0 || f.reviews.length > 0));
}

export const WRAP_UP_STEPS = ['Photos', 'Reviews', 'Confirm'] as const;

/** "8 for this event · 2 also to Inspiration" (V3 · 1 frame 2). */
export function wrapUpCountLine(ticked: number, starred: number): string {
  const one = `${ticked} for this event`;
  return starred > 0 ? `${one} · ${starred} also to Inspiration` : one;
}

/**
 * A shared photo's state in the couple's story. `approved` (Approve all) and silence past the owner's number count as
 * accepted; `hidden` leaves THEIR story only. No number set → a waiting photo waits (never accepted on a guess).
 */
export function storyShareState(
  row: { couple_decision: string; shared_at: string },
  nowMs: number,
  silenceDays: number | null,
): 'accepted' | 'waiting' | 'hidden' {
  if (row.couple_decision === 'hidden') return 'hidden';
  if (row.couple_decision === 'approved') return 'accepted';
  if (silenceDays === null || !Number.isFinite(silenceDays) || silenceDays <= 0) return 'waiting';
  const at = new Date(row.shared_at).getTime();
  if (!Number.isFinite(at)) return 'waiting';
  return nowMs - at >= silenceDays * 86_400_000 ? 'accepted' : 'waiting';
}

/** The ticked photos that may go out: this event's own files only, deduplicated, capped. */
export function wrapUpSelection(all: readonly string[], ticked: readonly string[], max = 200): string[] {
  const mine = new Set(all);
  return [...new Set(ticked)].filter((id) => mine.has(id)).slice(0, max);
}
