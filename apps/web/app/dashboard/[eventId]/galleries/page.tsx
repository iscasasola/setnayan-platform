import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, Radio, Image as ImageIcon, ArrowRight, Images } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { eventOwnsPapicSeats } from '@/lib/papic-seats';
import { countEventGuestCaptures } from '@/lib/papic-guest';
import { resolveAddOnState } from '@/lib/add-on-state';

export const metadata = { title: 'Galleries · Setnayan' };

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
 * hub): Papic = `eventOwnsPapicSeats()`, Panood = `resolveAddOnState() ===
 * 'launch'`. Couple OR delegated coordinator. The couple's own uploaded photos
 * (`events.our_photos`) are always shown — they're self-curated, not gated.
 */
export default async function GalleriesHubPage({ params }: Props) {
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

  const [ownsPapic, panoodState, papicPhotoCount, guestCaptureCount, eventRow] = await Promise.all([
    eventOwnsPapicSeats(supabase, eventId),
    resolveAddOnState(supabase, eventId, 'panood', 'couple'),
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

  if (ownsPapic) {
    const ready = papicCount > 0;
    sources.push({
      key: 'papic',
      name: 'Papic — candid photos',
      blurb: ready
        ? 'Every shot your friends caught, ready to view and download.'
        : "We're gathering the photos your crew and guests captured.",
      state: ready ? 'ready' : 'collecting',
      count: ready ? papicCount : null,
      viewLabel: ready ? 'View & download' : 'Open Papic',
      viewHref: ready ? `${base}/add-ons/papic/recap` : `${base}/add-ons/papic`,
      Icon: Camera,
    });
  }

  if (ownsPanood) {
    // The livestream recording lands on the broadcast archive after the event.
    sources.push({
      key: 'panood',
      name: 'Panood — livestream',
      blurb: 'Re-watch the day and share the recording with everyone who tuned in.',
      state: 'ready',
      count: null,
      viewLabel: 'Watch the recording',
      viewHref: `${base}/add-ons/panood/broadcast`,
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
        ? 'The photos you chose for your website.'
        : 'Add your own photos to your wedding website.',
      state: ready ? 'ready' : 'collecting',
      count: ready ? ourPhotos.length : null,
      viewLabel: ready ? 'View & manage' : 'Add photos',
      viewHref: `${base}/website/our-photos`,
      Icon: ImageIcon,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="space-y-1">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <Images aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> After the wedding
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Galleries</h1>
        <p className="text-sm text-ink/60">
          Everything you collected, in one place. Deliveries land over the days
          after the wedding — galleries fill in as they arrive.
        </p>
      </header>

      <div className="mt-6 space-y-3">
        {sources.map((s) => {
          const Icon = s.Icon;
          const ready = s.state === 'ready';
          return (
            <article
              key={s.key}
              className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-ink">{s.name}</h2>
                    {ready ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Ready{s.count != null ? ` · ${s.count}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
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
      </div>
    </div>
  );
}
