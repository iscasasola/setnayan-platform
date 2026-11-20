import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readEventSupplierFiles } from '@/lib/supplier-files.server';
import { readEventTagBoard } from '@/lib/inspiration-tags.server';
import type { GuestReviewsRead } from '@/lib/guest-reviews';
import type { WrapUpFacts, WrapUpPart } from '@/lib/today-wrap-up';

/**
 * lib/today-wrap-up.server.ts — THE READS ONE WRAP-UP CARD NEEDS (Today v3 part 3), each the shipped reader:
 *   · the event's filed photos — `readEventSupplierFiles` (the Files board's own read, signed URLs);
 *   · the inspirations its cards offer — `readEventTagBoard`;
 *   · its guest reviews — the shop's `readGuestReviewsForVendor` rows, filtered to this event (read once per page);
 *   · the plan (Supplier Ultra = `tier_state 'enterprise'`) and the owner's silence days.
 *
 * 🔑 `null` = SOMETHING COULD NOT BE READ. The caller then keeps v2's quick "I delivered this service" row — never a
 * wrap-up card that says "no photos" for an event whose photos simply did not load.
 */
export async function readWrapUpFacts(args: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  vendorProfileId: string;
  card: { eventId: string; eventName: string; eventDate: string | null };
  guestReviews: GuestReviewsRead;
  ultra: boolean | null;
  silenceDays: number | null;
}): Promise<WrapUpFacts | null> {
  const { supabase, admin, vendorProfileId, card } = args;
  if (args.guestReviews.state === 'refused' || args.ultra === null) return null;
  const files = await readEventSupplierFiles(supabase, { eventId: card.eventId, vendorProfileId, eventDate: card.eventDate });
  if (files.status !== 'ok') return null;
  const photoFiles = files.files.filter((f) => f.kind === 'photo' && typeof f.url === 'string');
  const board = photoFiles.length
    ? await readEventTagBoard(admin, { eventId: card.eventId, shop: vendorProfileId, files: files.files, quotedIds: files.quoted.map((q) => q.id) }).catch(() => null)
    : { tags: [], offered: {} };
  if (!board) return null;
  const parts = new Map<string, WrapUpPart>();
  for (const list of Object.values(board.offered)) for (const p of list) parts.set(p.slotKey, { slotKey: p.slotKey, label: p.label });
  const reviews = args.guestReviews.state === 'rows' ? args.guestReviews.rows.filter((r) => r.event_id === card.eventId) : [];
  return {
    eventId: card.eventId,
    eventName: card.eventName,
    eventDate: card.eventDate,
    photos: photoFiles.map((f) => ({ fileId: f.fileId, url: f.url!, serviceTitle: f.serviceId ? (files.serviceTitles[f.serviceId] ?? null) : null })),
    reviews: reviews.map((r) => ({ reviewId: r.review_id, name: r.shown_name, rating: r.rating_overall, line: r.line, replied: Boolean(r.vendor_reply) })),
    parts: [...parts.values()],
    ultra: args.ultra,
    silenceDays: args.silenceDays,
  };
}

export { readStorySilenceDays } from '@/lib/story-silence.server';
