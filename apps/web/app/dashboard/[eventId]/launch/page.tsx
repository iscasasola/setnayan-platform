import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MonitorPlay, Radio, Camera, ArrowRight, Plus, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { eventPapicSeatsActive } from '@/lib/papic-seats';
import { eventSkuActive } from '@/lib/entitlements';
import { resolveAddOnState } from '@/lib/add-on-state';

export const metadata = { title: 'Launch your services' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Day-of Services LAUNCH hub — the "Services" tab of the Day-of menu (Event
 * Lifecycle Menu, PR2). One place to START every owned live service on the
 * wedding day: Panood "Go live", Live Wall "Open the wall", Papic "Hand out
 * seats". The individual launch surfaces already exist (`/studio/panood/
 * broadcast`, `/live`, `/studio/papic/crew`); this gathers them with their
 * day-of verb and an upsell for anything not yet owned, so the Day-of Services
 * tab points at a real hub instead of one bare console.
 *
 * Ownership is read with the canonical per-service checks (reuse, not reinvent):
 * Live Wall = `eventOwnsSku('LIVE_WALL')` (orders-backed + bundle-aware — the
 * /live page's own gate after the PR4 dead-unlock repair), Papic
 * = `eventOwnsPapicSeats()`, Panood = `resolveAddOnState().state === 'launch'`.
 * Couple OR delegated coordinator (mirrors /live + /guests/checkin).
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
  const [ownsLiveWall, panoodState, ownsPapic] = await Promise.all([
    eventSkuActive(supabase, eventId, 'LIVE_WALL'),
    resolveAddOnState(supabase, eventId, 'panood', 'couple'),
    eventPapicSeatsActive(supabase, eventId),
  ]);

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
      name: 'Panood — livestream',
      blurb: 'Bring everyone who could not make it into the room.',
      owned: panoodState.state === 'launch',
      launchLabel: 'Go live',
      launchHref: `${base}/studio/panood/broadcast`,
      addHref: `${base}/studio/panood`,
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
      blurb: 'Hand shooter seats to friends so the day is caught from every angle.',
      owned: ownsPapic,
      launchLabel: 'Hand out seats',
      launchHref: `${base}/studio/papic/crew`,
      addHref: `${base}/studio/papic`,
      Icon: Camera,
    },
  ];
  const ownedCount = services.filter((s) => s.owned).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="space-y-1">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <Rocket aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Day-of
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Launch your services</h1>
        <p className="text-sm text-ink/60">
          {ownedCount > 0
            ? 'Start each of your live services as the day unfolds.'
            : 'Your live services will start from here on the day. Add one to light it up.'}
        </p>
      </header>

      <div className="mt-6 space-y-3">
        {services.map((s) => {
          const Icon = s.Icon;
          return (
            <article
              key={s.key}
              className={`flex items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 ${
                s.owned ? 'border-ink/10 bg-white shadow-sm' : 'border-dashed border-ink/15 bg-ink/[0.02]'
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
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
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
    </div>
  );
}
