import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MonitorPlay, Radio, Camera, ArrowRight, Plus, Globe, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { eventPapicActive } from '@/lib/papic-seats';
import { eventSkuActive } from '@/lib/entitlements';
import { resolveAddOnState } from '@/lib/add-on-state';
import { liveStudioControllerHref } from '@/lib/live-studio-control';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import { PUBLIC_SITE_PAGES } from '@/lib/public-site-pages';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'Launch your services' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Day-of Services LAUNCH hub — the "Services" tab of the Day-of menu (Event
 * Lifecycle Menu, PR2). One place to START every owned live service on the
 * wedding day: Panood "Go live", Live Wall "Open the wall", Papic "Hand out
 * cameras". The individual launch surfaces already exist (`/studio/panood/
 * broadcast`, `/live`, `/studio/papic/crew`); this gathers them with their
 * day-of verb and an upsell for anything not yet owned, so the Day-of Services
 * tab points at a real hub instead of one bare console.
 *
 * Ownership is read with the canonical per-service checks (reuse, not reinvent):
 * Live Wall = `eventOwnsSku('LIVE_WALL')` (orders-backed + bundle-aware — the
 * /live page's own gate after the PR4 dead-unlock repair), Papic
 * = `eventPapicActive()`, Panood = `resolveAddOnState().state === 'launch'`.
 * Couple OR delegated coordinator (mirrors /live + /guests/checkin).
 *
 * ⚠ PAPIC'S GATE WAS `eventPapicSeatsActive()` AND THAT CARD COULD NEVER LIGHT UP
 * (fixed 2026-07-30). `PAPIC_SEATS` — the ₱2,999 five-seat pass — is
 * `is_active = false` in prod with ZERO orders ever placed, and the 2026-07-29
 * two-type lock retired the product outright. So on the one page that exists to
 * say "start this now, it's your wedding day", Papic was permanently stuck on the
 * upsell branch for EVERY couple — including couples whose event already holds a
 * free shot pool and a free camera. Now gated on `eventPapicActive()`, the
 * canonical "is Papic going for this event" predicate (lib/papic-seats.ts): any
 * live `paparazzi_seats` row OR an active Papic-inclusive SKU. Both free
 * allowances are armed at event creation (`ensureFreePapicPoolGrantAdmin` +
 * `ensureFreePapicOneCameraAdmin` in create-event/actions.ts), and the free camera
 * IS a seat row — so in practice this reads true for every event, which is the
 * truth of the two-type model rather than a hardcoded `true`.
 */
export default async function LaunchHubPage({ params }: Props) {
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
  const [ownsLiveWall, panoodState, hasPapic, eventRes] = await Promise.all([
    eventSkuActive(supabase, eventId, 'LIVE_WALL'),
    // ⭐ 2026-07-27 — 'live-studio-roam', NOT 'panood'. ADD_ON_SKU_MAP (lib/add-on-stats.ts)
    // maps `panood` → the two RETIRED Cast SKUs and `live-studio-roam` → the live
    // `LIVE_STUDIO` ₱2,999. SKU_OWNERSHIP_ALIASES does NOT expand at this layer, so
    // keying on `panood` means the first couple who actually PAYS resolves to
    // not-owned — an "Add" button on the day of their wedding instead of "Go live".
    resolveAddOnState(supabase, eventId, 'live-studio-roam', 'couple'),
    eventPapicActive(supabase, eventId),
    // Slug + date drive the public-site preview cards below — the ONLY new read
    // this page needs (owner R5 Option A). Slug builds the `/[slug]?phase=` link;
    // event_date feeds the SAME getLifecyclePhase the public engine uses so we can
    // mark which named page the live QR resolves to right now.
    supabase.from('events').select('slug, event_date').eq('event_id', eventId).maybeSingle(),
  ]);
  const eventSlug = (eventRes.data as { slug?: string | null } | null)?.slug ?? null;
  const eventDate = (eventRes.data as { event_date?: string | null } | null)?.event_date ?? null;
  const activePhase = getLifecyclePhase(eventDate);

  type Service = {
    key: string;
    name: string;
    blurb: string;
    owned: boolean;
    launchLabel: string;
    launchHref: string;
    addHref: string;
    Icon: LucideIcon;
  };

  const services: Service[] = [
    {
      key: 'panood',
      name: 'Live Studio — livestream',
      blurb: 'Bring everyone who could not make it into the room.',
      owned: panoodState.state === 'launch',
      launchLabel: 'Go live',
      // ONE CONTROLLER (Wave 6): the day-of "Go live" button follows the flag —
      // unified controller when it's on, legacy Cast control room until then.
      // This is the highest-stakes doorway in the app (it is pressed once, at the
      // wedding), so it must never be the one left pointing at the retired room.
      launchHref: liveStudioControllerHref(eventId),
      // The BUY doorway follows the same unification: `/studio/panood` is the Cast
      // detail page for a retired SKU and offers no buy control.
      addHref: `${base}/studio/live-studio-control`,
      Icon: Radio,
    },
    {
      key: 'livewall',
      name: 'Live Photo Wall',
      blurb: 'Project guest photos at the venue in real time.',
      owned: ownsLiveWall,
      launchLabel: 'Open the wall',
      launchHref: `${base}/live`,
      addHref: `${base}/studio`,
      Icon: MonitorPlay,
    },
    {
      key: 'papic',
      name: 'Papic — candid capture',
      // ⚠ "share these 5 seat links" / "Share the 5 links" / "shooter seats" was
      // the retired five-seat pass talking (owner naming lock 2026-07-30: the two
      // products are Papic Pool and Papic One — there is no seat pass and no
      // "seat link"). It also stated a COUNT the app cannot honour: Papic One has
      // no seat cap, and Pool cameras are unlimited by construction — any phone
      // that scans the event QR shoots from the shared pool. No number here: the
      // crew page derives what this event actually holds.
      blurb: hasPapic
        ? 'Your cameras are ready — hand them out and the day gets caught from every angle.'
        : 'Hand a camera to anyone you trust and the day gets caught from every angle.',
      owned: hasPapic,
      launchLabel: 'Hand out cameras',
      launchHref: `${base}/studio/papic/crew`,
      addHref: `${base}/studio/papic`,
      Icon: Camera,
    },
  ];
  const ownedCount = services.filter((s) => s.owned).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <PageMasthead
        title="Launch your services"
      />

      <div className="mt-6 space-y-3">
        {services.map((s) => {
          const Icon = s.Icon;
          return (
            <article
              key={s.key}
              className={`sn-row flex items-center justify-between gap-4 p-4 sm:p-5 ${
                s.owned ? '' : 'border-dashed'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    s.owned ? 'bg-terracotta/10 text-terracotta' : 'bg-ink/5 text-ink/40'
                  }`}
                >
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h2 className={`text-sm font-semibold ${s.owned ? 'text-ink' : 'text-ink/70'}`}>{s.name}</h2>
                  <p className="text-xs text-ink/55">{s.blurb}</p>
                </div>
              </div>
              {s.owned ? (
                <Link
                  href={s.launchHref}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-800"
                >
                  {s.launchLabel}
                  <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
                </Link>
              ) : (
                <Link
                  href={s.addHref}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Add
                </Link>
              )}
            </article>
          );
        })}
      </div>

      {/* Your public site, named as four pages (owner R5 · Option A). One engine,
          one URL — `/[slug]` already renders each of these per lifecycle phase.
          These cards just NAME + PREVIEW them; the live QR keeps resolving to the
          active page below with no change. */}
      <section className="mt-10">
        <header className="space-y-1">
          <p className="sn-eye">
            <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Your public site
          </p>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Four pages, one link</h2>
          <p className="text-sm text-ink/60">
            Your site changes with the day. Preview each page below — the page marked{' '}
            <span className="font-medium text-ink/80">Active now</span> is what your QR opens today.
          </p>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PUBLIC_SITE_PAGES.map((page) => {
            const Icon = page.Icon;
            const isActive = page.phaseParam === activePhase;
            const previewHref = eventSlug ? `/${eventSlug}?phase=${page.phaseParam}` : null;
            return (
              <article
                key={page.key}
                className={`sn-row flex flex-col gap-3 p-4 sm:p-5 ${
                  isActive ? 'border-terracotta/40 bg-terracotta/[0.03]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      isActive ? 'bg-terracotta/10 text-terracotta' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{page.name}</h3>
                      {isActive && (
                        <span className="inline-flex items-center rounded-full bg-terracotta-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cream">
                          Active now
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink/55">{page.blurb}</p>
                  </div>
                </div>
                {previewHref ? (
                  <Link
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    Preview
                    <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                ) : (
                  <span className="text-xs text-ink/40">Preview available once your site link is set.</span>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
