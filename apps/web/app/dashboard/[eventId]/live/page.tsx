import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  MonitorPlay,
  Image as ImageIcon,
  EyeOff,
  Tv,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { eventSkuActive } from '@/lib/entitlements';
import { resolveWallMode, type WallMode } from '@/lib/live-wall-logic';
import {
  LiveWallControls,
  type WallScreenRow,
  type WallTileRow,
} from '../add-ons/papic/_components/live-wall-controls';
import { KwentoQueue } from '../add-ons/papic/moderation/_components/kwento-queue';
import { WallModeControl } from './_components/mode-control';

export const metadata = { title: 'Live Wall · Setnayan' };
export const dynamic = 'force-dynamic';

/**
 * /dashboard/[eventId]/live — the Salamisim day-of console (P3).
 *
 * One screen for whoever runs the wall at the venue (couple OR coordinator —
 * the same authority every wall RPC already checks): lifecycle mode with the
 * manual override, screen codes, the live tile strip with the one-tap kill
 * switch, the FaceBlock posture, and the Kwento approval queue. Composes the
 * shipped P1 controls + Kwento queue — no forked logic.
 */
export default async function LiveWallConsolePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['couple', 'coordinator'].includes(membership.member_type as string)) {
    redirect(`/dashboard/${eventId}`);
  }

  // Ownership reads off orders.status via eventOwnsSku() (PR4 dead-unlock
  // repair, 2026-06-15) — bundle-aware, so a Media Pack buyer reaches the
  // console too. Replaces the event_software_activations_v2 read whose only
  // writer (verify_and_activate_manual_payment) had zero app callers.
  const owns = await eventSkuActive(supabase, eventId, 'LIVE_WALL');

  if (!owns) {
    // Not purchased — a quiet doorway to the add-on, not a dead end. Price
    // copy intentionally absent (read at purchase surfaces from the catalog).
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-ink/10 bg-surface p-8 text-center">
          <MonitorPlay aria-hidden className="mx-auto h-8 w-8 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-lg font-semibold text-ink">Live Photo Wall</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
            Project your guests&rsquo; photos at the venue in real time — a collage that
            fills itself as the night unfolds. The Live Wall is a Papic add-on.
          </p>
          <Link
            href={`/dashboard/${eventId}/add-ons`}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2} />
            See it in Add-ons
          </Link>
        </div>
      </div>
    );
  }

  // The console reads ride the couple/coordinator RLS where policies exist
  // (sessions, feed); counts that need cross-table visibility use the admin
  // client AFTER the membership gate above — same trust model as KwentoQueue.
  const admin = createAdminClient();
  const [
    { data: event },
    { data: sessions },
    { data: feed },
    { count: visibleCount },
    { count: hiddenCount },
    { count: faceblockGuests },
  ] = await Promise.all([
    admin
      .from('events')
      .select('event_date, live_mode_override')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('wall_display_sessions')
      .select('session_id, display_code, claimed_at, revoked_at, expires_at, created_at')
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('wall_feed')
      .select('feed_id, source_table, source_id, wall_safe_r2_key, wall_hidden_at, sort_at')
      .eq('event_id', eventId)
      .order('sort_at', { ascending: false })
      .limit(60),
    admin
      .from('wall_feed')
      .select('feed_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('wall_hidden_at', null),
    admin
      .from('wall_feed')
      .select('feed_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('wall_hidden_at', 'is', null),
    admin
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('faceblock_enabled', true)
      .is('deleted_at', null),
  ]);

  const override = (event?.live_mode_override ?? null) as WallMode | null;
  const resolved = resolveWallMode(
    override,
    getDayOfPhase((event?.event_date as string) ?? ''),
  );

  // FaceBlock posture: when active, every wall photo must carry a baked blur
  // derivative (P2). Surface coverage so "why is the wall thin?" is
  // answerable at a glance.
  let bakedCount = 0;
  if ((faceblockGuests ?? 0) > 0 && (feed?.length ?? 0) > 0) {
    const photoIds = (feed ?? [])
      .filter((r) => r.source_table === 'papic_photos')
      .map((r) => r.source_id as string);
    const capIds = (feed ?? [])
      .filter((r) => r.source_table === 'papic_guest_captures')
      .map((r) => r.source_id as string);
    const [{ count: bakedPhotos }, { count: bakedCaps }] = await Promise.all([
      photoIds.length
        ? admin
            .from('papic_photos')
            .select('photo_id', { count: 'exact', head: true })
            .in('photo_id', photoIds)
            .not('faceblock_baked_at', 'is', null)
        : Promise.resolve({ count: 0 }),
      capIds.length
        ? admin
            .from('papic_guest_captures')
            .select('capture_id', { count: 'exact', head: true })
            .in('capture_id', capIds)
            .not('faceblock_baked_at', 'is', null)
        : Promise.resolve({ count: 0 }),
    ]);
    bakedCount = (bakedPhotos ?? 0) + (bakedCaps ?? 0);
  }

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
  const claimedScreens = screens.filter((s) => s.claimed).length;

  const stats: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    {
      icon: <ImageIcon aria-hidden className="h-4 w-4" strokeWidth={2} />,
      label: 'on the wall',
      value: String(visibleCount ?? 0),
    },
    {
      icon: <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />,
      label: 'hidden',
      value: String(hiddenCount ?? 0),
    },
    {
      icon: <Tv aria-hidden className="h-4 w-4" strokeWidth={2} />,
      label: claimedScreens === 1 ? 'screen connected' : 'screens connected',
      value: String(claimedScreens),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <MonitorPlay aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={2} />
          Live Wall
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          The day-of console — what&rsquo;s on the venue screen, who&rsquo;s connected, and
          the one-tap controls that keep it yours.
        </p>
      </header>

      <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <WallModeControl eventId={eventId} override={override} resolved={resolved} />
          <dl className="flex items-center gap-5">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-lg font-semibold text-ink">{s.value}</dd>
                <dd className="flex items-center gap-1 text-[11px] text-ink/50">
                  {s.icon}
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {(faceblockGuests ?? 0) > 0 ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-ink/[0.04] px-3 py-2.5 text-sm text-ink/75">
            <ShieldCheck
              aria-hidden
              className="mt-0.5 h-4 w-4 flex-none text-terracotta"
              strokeWidth={2}
            />
            <span>
              <span className="font-medium text-ink">
                FaceBlock is on for {faceblockGuests}{' '}
                {faceblockGuests === 1 ? 'guest' : 'guests'}.
              </span>{' '}
              Every photo is projected with faces blurred; photos still waiting for
              their blurred copy stay off the wall automatically.{' '}
              {bakedCount}/{feed?.length ?? 0} recent tiles are blur-ready.
            </span>
          </p>
        ) : null}

        <LiveWallControls eventId={eventId} screens={screens} tiles={tiles} />
        <p className="mt-3 text-xs text-ink/50">
          Projector URL:{' '}
          <span className="font-mono text-[12px] text-ink/70">/wall/{eventId}</span> — open
          it on any TV or projector browser and enter a screen code.
        </p>
      </section>

      <KwentoQueue eventId={eventId} />
    </div>
  );
}
