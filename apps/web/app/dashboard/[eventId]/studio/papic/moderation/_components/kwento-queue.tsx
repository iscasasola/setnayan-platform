import { MessageCircleHeart } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { KwentoQueueControls, type KwentoRow } from './kwento-queue-controls';

/**
 * Kwento review queue (0012 § Kwento · P2) — the couple sees EVERY message
 * immediately (pending/flagged first); `pending` gates only public surfaces.
 * One-tap "Show on wall" is the owner-locked gate to the projector
 * (wall_approve_caption RPC; flagged is never wall-eligible — DB CHECK).
 * Rendered ONLY after the page's couple gate (this component trusts it).
 */
export async function KwentoQueue({ eventId }: { eventId: string }) {
  const admin = createAdminClient();

  const { data: messages } = await admin
    .from('photo_messages')
    .select(
      'message_id, source_table, source_id, guest_id, body_text, status, moderation_state, moderation_labels, wall_eligible, hide_from_wall, submitted_at, edited_at',
    )
    .eq('event_id', eventId)
    .is('hard_deleted_at', null)
    .is('user_deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(60);

  const rows = messages ?? [];
  if (rows.length === 0) return null;

  // Author names.
  const guestIds = [...new Set(rows.map((r) => r.guest_id as string))];
  const { data: guests } = await admin
    .from('guests')
    .select('guest_id, first_name, last_name, display_name')
    .in('guest_id', guestIds);
  const nameOf = new Map(
    (guests ?? []).map((g) => [
      g.guest_id as string,
      (g.display_name as string) || `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() || 'A guest',
    ]),
  );

  // Anchor thumbnails (both capture tables).
  const guestCapIds = rows
    .filter((r) => r.source_table === 'papic_guest_captures')
    .map((r) => r.source_id as string);
  const seatIds = rows
    .filter((r) => r.source_table === 'papic_photos')
    .map((r) => r.source_id as string);
  const [{ data: caps }, { data: seats }] = await Promise.all([
    guestCapIds.length
      ? admin.from('papic_guest_captures').select('capture_id, r2_object_key').in('capture_id', guestCapIds)
      : Promise.resolve({ data: [] as { capture_id: string; r2_object_key: string | null }[] }),
    seatIds.length
      ? admin.from('papic_photos').select('photo_id, r2_object_key').in('photo_id', seatIds)
      : Promise.resolve({ data: [] as { photo_id: string; r2_object_key: string | null }[] }),
  ]);
  const refOf = new Map<string, string | null>([
    ...(caps ?? []).map((c) => [c.capture_id as string, c.r2_object_key as string | null] as const),
    ...(seats ?? []).map((p) => [p.photo_id as string, p.r2_object_key as string | null] as const),
  ]);

  const enriched: KwentoRow[] = await Promise.all(
    rows.map(async (r) => ({
      messageId: r.message_id as string,
      body: r.body_text as string,
      author: nameOf.get(r.guest_id as string) ?? 'A guest',
      guestId: r.guest_id as string,
      status: r.status as KwentoRow['status'],
      moderation: r.moderation_state as KwentoRow['moderation'],
      labels: ((r.moderation_labels as { labels?: string[] } | null)?.labels ?? []) as string[],
      onWall: Boolean(r.wall_eligible) && !r.hide_from_wall,
      edited: Boolean(r.edited_at),
      thumbUrl: await displayUrlForStoredAsset(refOf.get(r.source_id as string) ?? null, {
        ttlSeconds: 60 * 30,
      }),
    })),
  );

  // Pending + flagged first — the review queue ordering.
  enriched.sort((a, b) => {
    const weight = (x: KwentoRow) =>
      x.status === 'pending' ? (x.moderation === 'flagged' ? 0 : 1) : 2;
    return weight(a) - weight(b);
  });

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <MessageCircleHeart aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
        Kwento — stories from your guests
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Messages your guests wrote on their photos. Approve to publish; one tap
        sends a sweet one to the venue wall. Flagged messages stay hidden until
        you decide.
      </p>
      <KwentoQueueControls eventId={eventId} rows={enriched} />
    </section>
  );
}
