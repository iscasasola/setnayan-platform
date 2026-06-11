import { MonitorPlay } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { LiveWallControls, type WallScreenRow, type WallTileRow } from './live-wall-controls';

/**
 * Salamisim Live Photo Wall — the couple's control card on the Papic add-on
 * page (P1). Server component: renders ONLY when the event owns the
 * LIVE_WALL SKU; fetches screen codes + the latest wall tiles under the
 * couple's own RLS session (P0 policies), then hands interactivity to the
 * client controls (generate/revoke codes · hide/unhide tiles).
 */
export async function LiveWallCard({ eventId }: { eventId: string }) {
  const supabase = await createClient();

  const { data: activation } = await supabase
    .from('event_software_activations_v2')
    .select('service_code')
    .eq('event_id', eventId)
    .eq('service_code', 'LIVE_WALL')
    .maybeSingle();
  if (!activation) return null;

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
