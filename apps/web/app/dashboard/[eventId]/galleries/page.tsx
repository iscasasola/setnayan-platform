import Link from 'next/link';
import { PageMasthead } from '@/app/_components/page-masthead';
import { redirect } from 'next/navigation';
import { Camera, Radio, Image as ImageIcon, ArrowRight, Images } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { eventPapicActive } from '@/lib/papic-seats';
import { countEventGuestCaptures } from '@/lib/papic-guest';
import { resolveAddOnState } from '@/lib/add-on-state';
import { liveStudioControllerHref } from '@/lib/live-studio-control';
import { RevealList } from '@/app/_components/reveal-list';

export const metadata = { title: 'Galleries' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * After-phase Galleries hub — the "Galleries" tab of the After menu (Event
 * Lifecycle Menu §6, 2026-06-16). Once the wedding is closed out, this is where
 * the couple finds every collected gallery to view + download. It does NOT
 * re-implement photo grids — it gathers the owned media sources, each with a
 * **"collecting → ready"** state (deliveries land over days, not all at once),
 * and links to the existing per-source surface (Papic recap, Panood broadcast,
 * the couple's own photos).
 *
 * ⚠ Defined PER-PAPIC-SOURCE, not per-vendor (spec §6 / §9.6): `papic_photos`
 * links to a Papic *seat*, not a vendor, and 0009 photo-delivery is event-level,
 * so there's no photo→vendor join yet. Per-vendor galleries (release on the
 * completion handshake) wait on that attribution — until then the source is the
 * service, not the vendor.
 *
 * Ownership reuses the canonical per-service checks (same as the Day-of launch
 * hub): Papic = `eventPapicActive()`, Panood = `resolveAddOnState() ===
 * 'launch'`. Couple OR delegated coordinator. The couple's own uploaded photos
 * (`events.our_photos`) are always shown — they're self-curated, not gated.
 *
 * ⚠ THE PAPIC CARD USED TO GATE ON `eventPapicSeatsActive()` AND SO COULD NEVER
 * APPEAR (fixed 2026-07-30). `PAPIC_SEATS` (the ₱2,999 five-seat pass) is
 * `is_active = false` in prod with zero orders ever, and the 2026-07-29 two-type
 * lock retired it. The consequence was worse here than a missing upsell: photos
 * ALREADY IN `papic_photos` / `papic_guest_captures` — shot from the free pool or a
 * free camera — had no card on the couple's own gallery hub, so real captured media
 * was unreachable from the surface built to reach it. `eventPapicActive()` is the
 * canonical predicate (any live seat row OR an active Papic-inclusive SKU), and both
 * free allowances arm at event creation, so the card now renders for every event —
 * 'collecting' until the first shot lands, then 'ready' with the live count.
 */
export default async function GalleriesHubPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipError) {
    logQueryError(
      'GalleriesPage.membership',
      membershipError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  if (!membership || !['couple', 'coordinator'].includes(membership.member_type as string)) {
    redirect(`/dashboard/${eventId}`);
  }

  const base = `/dashboard/${eventId}`;

  // Papic media count = pro/crew captures (papic_photos) + guest captures
  // (papic_guest_captures), both keyed by event_id. Graceful-degrade to 0 on a
  // legacy/missing table so the hub never crashes — "collecting" is the safe
  // default before the first delivery lands.
  const countPapicPhotos = async (): Promise<number> => {
    const { count, error } = await supabase
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    return error ? 0 : count ?? 0;
  };

  const [hasPapic, panoodState, papicPhotoCount, guestCaptureCount, eventRow] = await Promise.all([
    eventPapicActive(supabase, eventId),
    // ⭐ 2026-07-27 — 'live-studio-roam', NOT 'panood'. ADD_ON_SKU_MAP (lib/add-on-stats.ts)
    // maps `panood` → the two RETIRED Cast SKUs and `live-studio-roam` → the live
    // `LIVE_STUDIO` ₱2,999. SKU_OWNERSHIP_ALIASES does NOT expand at this layer, so
    // keying on `panood` means the first couple who actually PAYS resolves to
    // not-owned — an no "Watch the recording" card after their wedding.
    resolveAddOnState(supabase, eventId, 'live-studio-roam', 'couple'),
    countPapicPhotos(),
    countEventGuestCaptures(supabase, eventId),
    supabase.from('events').select('our_photos').eq('event_id', eventId).maybeSingle(),
  ]);

  const papicCount = papicPhotoCount + guestCaptureCount;
  const ownsPanood = panoodState.state === 'launch';
  const ourPhotos = Array.isArray((eventRow.data as { our_photos?: unknown } | null)?.our_photos)
    ? ((eventRow.data as { our_photos: unknown[] }).our_photos as unknown[])
    : [];

  type GalleryState = 'ready' | 'collecting';
  type Source = {
    key: string;
    name: string;
    blurb: string;
    state: GalleryState;
    count: number | null;
    viewLabel: string;
    viewHref: string;
    Icon: LucideIcon;
  };

  const sources: Source[] = [];

  if (hasPapic) {
    const ready = papicCount > 0;
    sources.push({
      key: 'papic',
      name: 'Papic — candid photos',
      blurb: ready
        ? 'Every shot your friends caught, ready to view and download.'
        : "As your guests and cameras shoot, every photo gathers here.",
      state: ready ? 'ready' : 'collecting',
      count: ready ? papicCount : null,
      viewLabel: ready ? 'View & download' : 'Open Papic',
      viewHref: ready ? `${base}/studio/papic/recap` : `${base}/studio/papic`,
      Icon: Camera,
    });
  }

  if (ownsPanood) {
    // The livestream recording lands on the broadcast archive after the event.
    sources.push({
      key: 'panood',
      name: 'Live Studio — livestream',
      blurb: 'Re-watch the day and share the recording with everyone who tuned in.',
      state: 'ready',
      count: null,
      viewLabel: 'Watch the recording',
      // ONE CONTROLLER (Wave 6): resolves to the unified Live Studio controller
      // once the flag is on, the legacy Cast control room until then. Never a
      // hardcoded path — see lib/live-studio-control.ts.
      viewHref: liveStudioControllerHref(eventId),
      Icon: Radio,
    });
  }

  // The couple's own curated photos — always available, never gated.
  {
    const ready = ourPhotos.length > 0;
    sources.push({
      key: 'our-photos',
      name: 'Your photos',
      blurb: ready
        ? 'The photos you chose for your Event Hub.'
        : 'Add your own photos to your Event Hub.',
      state: ready ? 'ready' : 'collecting',
      count: ready ? ourPhotos.length : null,
      viewLabel: ready ? 'View & manage' : 'Add photos',
      viewHref: `${base}/website/our-photos`,
      Icon: ImageIcon,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <PageMasthead title="Galleries" />

      <RevealList as="div" className="mt-6 space-y-3">
        {sources.map((s) => {
          const Icon = s.Icon;
          const ready = s.state === 'ready';
          return (
            <article
              key={s.key}
              data-reveal-item
              className="sn-row flex items-center justify-between gap-4 p-4 sm:p-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-ink">{s.name}</h2>
                    {ready ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700">
                        Ready{s.count != null ? ` · ${s.count}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-medium text-warn-700">
                        Collecting…
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink/55">{s.blurb}</p>
                </div>
              </div>
              <Link
                href={s.viewHref}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  ready
                    ? 'bg-terracotta text-white hover:bg-terracotta-600'
                    : 'border border-ink/15 text-ink/60 hover:bg-ink/5 hover:text-ink'
                }`}
              >
                {s.viewLabel}
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
            </article>
          );
        })}
      </RevealList>
    </div>
  );
}
