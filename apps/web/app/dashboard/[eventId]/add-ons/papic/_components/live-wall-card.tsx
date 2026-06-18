import { MonitorPlay } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';
import { PaymentUnderReview } from '@/app/dashboard/[eventId]/_components/payment-under-review';
import { LiveWallControls, type WallScreenRow, type WallTileRow } from './live-wall-controls';

/**
 * Salamisim Live Photo Wall — the couple's control card on the Papic add-on
 * page (P1). Server component: renders ONLY when the event owns the
 * LIVE_WALL SKU; fetches screen codes + the latest wall tiles under the
 * couple's own RLS session (P0 policies), then hands interactivity to the
 * client controls (generate/revoke codes · hide/unhide tiles).
 *
 * Ownership reads off orders.status via eventOwnsSku() (PR4 dead-unlock
 * repair, 2026-06-15) — the SAME mechanism every other couple SKU uses, and
 * bundle-aware so a Media Pack buyer (whose order is keyed MEDIA_PACK, not
 * LIVE_WALL) also unlocks the wall. The old event_software_activations_v2 read
 * had no payment-path writer (its only writer, the DB fn
 * verify_and_activate_manual_payment, has zero callers), so paying never lit
 * this card.
 */
export async function LiveWallCard({ eventId }: { eventId: string }) {
  const supabase = await createClient();

  const owns = await eventOwnsSku(supabase, eventId, 'LIVE_WALL');
  if (!owns) return null;

  // Payment handshake (2026-06-18): owning the SKU now counts a still-pending
  // ('submitted') order, so gate the live feature on admin approval. Owned but
  // not-yet-active → show the "payment under review" card instead of the live
  // controls (and skip the wall reads — nothing to manage until it's live).
  const active = owns ? await eventSkuActive(supabase, eventId, 'LIVE_WALL') : false;
  if (!active) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <MonitorPlay aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
          Live Photo Wall
        </h2>
        <div className="mt-3">
          <PaymentUnderReview feature="live photo wall" />
        </div>
      </section>
    );
  }

  const [{ data: sessions }, { data: feed }] = await Promise.all([
    supabase
      .from('wall_display_sessions')
      .select('session_id, display_code, claimed_at, revoked_at, expires_at, created_at')
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('wall_feed')
      .select('feed_id, source_table, source_id, wall_safe_r2_key, wall_hidden_at, sort_at')
      .eq('event_id', eventId)
      .order('sort_at', { ascending: false })
      .limit(12),
  ]);

  const tiles: WallTileRow[] = await Promise.all(
    (feed ?? []).map(async (row) => ({
      feedId: row.feed_id as string,
      sourceTable: row.source_table as 'papic_photos' | 'papic_guest_captures',
      sourceId: row.source_id as string,
      hidden: Boolean(row.wall_hidden_at),
      thumbUrl: await displayUrlForStoredAsset(row.wall_safe_r2_key as string, {
        ttlSeconds: 60 * 30,
      }),
    })),
  );

  const screens: WallScreenRow[] = (sessions ?? []).map((s) => ({
    sessionId: s.session_id as string,
    code: s.display_code as string,
    claimed: Boolean(s.claimed_at),
    expiresAt: s.expires_at as string,
  }));

  const wallUrl = `/wall/${eventId}`;

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <MonitorPlay aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
            Live Photo Wall
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Project the day&rsquo;s photos at the venue as they&rsquo;re shot. Open{' '}
            <span className="font-mono text-[13px] text-ink/80">{wallUrl}</span> on any
            screen&rsquo;s browser and enter a screen code.
          </p>
        </div>
      </div>
      <LiveWallControls eventId={eventId} screens={screens} tiles={tiles} />
    </section>
  );
}
