import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, PencilLine, Users, LayoutGrid, Palette, Store, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { fetchTables, fetchAssignments, fetchFloorPlan, fetchBooths } from '@/lib/seating';
import { boothIsBranded, type BoothVendor } from '@/lib/seating-3d';
import {
  resolvePlan3dStanding,
  resolvePlan3dFacts,
  resolvePlan3dNextStep,
  resolvePlan3dSources,
  PHOTO_VISIBILITY_LABEL,
  shortDate,
  type Plan3dEventRead,
  type Plan3dPlanRead,
  type Plan3dGuestRead,
} from '@/lib/plan3d-control';
import { Plan3dStage, type StageMiniature } from './_components/plan3d-stage';
import { publishFromControlCentre, unpublishFromControlCentre } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: '3D Plan' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * THE 3D PLAN CONTROL CENTRE — the couple's control room for the room their
 * guests will walk (owner 2026-09-05; Fable spec + prototype of the same day;
 * the seven-slot pattern of `SERVICE_CONTROL_CENTERS_DESIGN_2026-08-28.md`,
 * shipped first as the Event Hub controller at ../launch).
 *
 *   S1 the stage (the room, live, as a miniature) · S2 the four facts ·
 *   the switch strip (Draft ↔ Live — the ONE gate, `publishSeating` /
 *   `unpublishSeating`) · S3 one next step · S4 built from (three doors, never
 *   editors) · S5 set once (the only settings that live nowhere else) ·
 *   S7 the boundary. No S6: the 3D Plan is FREE for couples (#5185) — there is
 *   no money card, and nothing to sell a couple here.
 *
 * ── 🔑 UNREAD IS NOT EMPTY, AND THE MEASUREMENT REACHES THE RENDER ─────────
 * Three reads carry their own `measured`: the event row, the floor plan's
 * `published_at`, and the guest counts. `fetchFloorPlan` graceful-degrades to
 * defaults on refusal and so cannot say "I was refused" — which is why the
 * published gate is read AGAIN here with error awareness: a refused read must
 * not render "Draft — only you can see this" to a couple whose room is live.
 * `the-control-centre-wires-what-it-measured.test.ts` pins that each
 * `measured` is the read's own verdict, never a typed-in `true`.
 *
 * Couple OR delegated coordinator, asked through `isHostMemberType` — the one
 * definition of "host", the way ../launch asks it.
 */
export default async function Plan3dControlCentrePage({ params }: Props) {
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
    logQueryError('Plan3dControlCentre.membership', membershipError, { event_id: eventId }, 'graceful_degrade');
  }
  if (!isHostMemberType((membership as { member_type?: string | null } | null)?.member_type)) {
    redirect(`/dashboard/${eventId}`);
  }

  /*
    🔒 MAY THIS VIEWER SEE THE GUESTS AT ALL? A delegate the host never shared
    the guest list with reads ZERO guest rows — an RLS refusal and an empty
    event are the same value — so without this the facts would tell a
    coordinator that nobody is seated. That is a third state, and it is NOT the
    refused-read state (`event-viewer.ts`). The gated reads get their OWN
    statement, the ../launch shape, so a source guard can see the condition.
  */
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  const mayReadGuestList = !isDelegateWithoutArea(viewer, 'guest_list');
  const guestCountsPromise = mayReadGuestList
    ? Promise.all([
        supabase.from('guests').select('guest_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase
          .from('guests')
          .select('guest_id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .not('avatar_config', 'is', null),
      ])
    : Promise.resolve(null);

  const base = `/dashboard/${eventId}`;
  const [eventRes, gateRes, floorPlan, tables, assignments, booths, guestCounts] =
    await Promise.all([
      supabase
        .from('events')
        .select('slug, event_date, timezone, guest_list_edit_deadline, guest_count_locked_at')
        .eq('event_id', eventId)
        .maybeSingle(),
      // THE GATE, READ WITH ERROR AWARENESS (see the docblock).
      supabase.from('event_floor_plan').select('published_at').eq('event_id', eventId).maybeSingle(),
      fetchFloorPlan(supabase, eventId),
      fetchTables(supabase, eventId),
      fetchAssignments(supabase, eventId),
      // brandedReader: the per-event branding RPC is service_role-only (#5189).
      fetchBooths(supabase, eventId, { brandedReader: createAdminClient() }),
      guestCountsPromise,
    ]);
  const guestCountRes = guestCounts?.[0] ?? null;
  const avatarCountRes = guestCounts?.[1] ?? null;

  if (eventRes.error) logQueryError('Plan3dControlCentre.event', eventRes.error, { event_id: eventId }, 'graceful_degrade');
  if (gateRes.error) logQueryError('Plan3dControlCentre.gate', gateRes.error, { event_id: eventId }, 'graceful_degrade');
  if (guestCountRes?.error) logQueryError('Plan3dControlCentre.guests', guestCountRes.error, { event_id: eventId }, 'graceful_degrade');

  const eventRow = eventRes.data as {
    slug?: string | null;
    event_date?: string | null;
    timezone?: string | null;
    guest_list_edit_deadline?: string | null;
    guest_count_locked_at?: string | null;
  } | null;
  const eventRead: Plan3dEventRead = {
    measured: !eventRes.error,
    slug: eventRow?.slug ?? null,
    eventDate: eventRow?.event_date ?? null,
    timezone: eventRow?.timezone ?? null,
    guestListEditDeadline: eventRow?.guest_list_edit_deadline ?? null,
    guestListLockedAt: eventRow?.guest_count_locked_at ?? null,
  };
  // The SAME branding gate the room renders with — never a re-typed predicate.
  const asBoothVendor = (b: (typeof booths)[number]): BoothVendor | null =>
    b.vendor
      ? { name: b.vendor.vendor_name, category: b.vendor.category, logoUrl: null, tier: b.vendor.tier, boothAddonActive: b.vendor.boothAddonActive }
      : null;
  const publishedAt = (gateRes.data as { published_at?: string | null } | null)?.published_at ?? null;
  const planRead: Plan3dPlanRead = {
    measured: !gateRes.error,
    published: publishedAt != null,
    publishedAt,
    tables: tables.length,
    seated: new Set(assignments.map((a) => a.guest_id)).size,
    boothCount: booths.length,
    brandedBooths: booths.filter((b) => boothIsBranded(asBoothVendor(b))).length,
    photoVisibility: floorPlan.venue_photo_visibility,
  };
  const guestRead: Plan3dGuestRead = {
    shared: mayReadGuestList,
    measured: mayReadGuestList && !guestCountRes?.error && !avatarCountRes?.error,
    total: guestCountRes?.count ?? 0,
    withAvatar: avatarCountRes?.count ?? 0,
  };

  const now = Date.now();
  const standing = resolvePlan3dStanding(eventRead, planRead, now);
  const facts = resolvePlan3dFacts(eventRead, planRead, guestRead, now);
  const nextStep = resolvePlan3dNextStep(eventRead, planRead, guestRead, base, now);
  const sources = resolvePlan3dSources(eventRead, planRead, guestRead, base, now);

  const lede =
    !standing.measured
      ? { strong: 'We could not read your room just now.', rest: 'So we are not going to guess what your guests would see. Nothing has been lost.' }
      : standing.state === 'draft'
        ? { strong: 'Only you can see this.', rest: 'Publish when the seats are settled — your guests will always open the latest version.' }
        : standing.state === 'after'
          ? { strong: 'Your day has passed.', rest: 'Your guests can still walk the room — it stays up until you take it down.' }
          : { strong: `Live${planRead.publishedAt ? ` since ${shortDate(planRead.publishedAt)}` : ''}.`, rest: 'Anyone with the address can walk your reception and find their seat in it.' };

  const miniature: StageMiniature = {
    tables: tables.map((t) => ({ x: t.x_pos ?? 50, y: t.y_pos ?? 50, kind: t.table_type })),
    stage: { x: floorPlan.stage_x, y: floorPlan.stage_y, w: floorPlan.stage_w, h: floorPlan.stage_h },
    dance: { enabled: floorPlan.dance_enabled, x: floorPlan.dance_x, y: floorPlan.dance_y, w: floorPlan.dance_w, h: floorPlan.dance_h },
    entrance: { enabled: floorPlan.entrance_enabled, x: floorPlan.entrance_x, y: floorPlan.entrance_y },
    booths: booths.map((b) => ({
      x: b.x_pos,
      y: b.y_pos,
      branded: boothIsBranded(asBoothVendor(b)),
    })),
  };

  const live = standing.state === 'live' || standing.state === 'after';
  const ICON = { guests: Users, seatplan: LayoutGrid, moodboard: Palette } as const;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <header className="pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">3D Plan</h1>
        <p className="mt-1 text-sm text-ink/60">The room your guests walk — built from your seat plan, your guest list and your mood board.</p>
      </header>

      <Plan3dStage
        slug={eventRead.slug}
        standing={standing}
        facts={facts}
        lede={lede}
        miniature={planRead.measured ? miniature : null}
        tableCount={planRead.measured ? tables.length : null}
        editHref={`${base}/seating/lab`}
        walkHref={`${base}/seating/lab?mode=play`}
        publicHref={live && eventRead.slug ? `/${eventRead.slug}/venue` : null}
      />

      {/* THE SWITCH — the one gate, named for what it does. Same two actions the
          lab panel posts; this strip only adds the sentence. */}
      <section aria-label="Publish switch" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${!standing.measured ? 'bg-ink/30' : live ? 'bg-emerald-500' : 'bg-ink/30'}`} />
          <span className="font-medium text-ink">
            {!standing.measured ? 'We couldn’t read whether the room is up' : live ? 'Live — guests can walk your reception' : 'Draft — only you can see this'}
          </span>
        </div>
        {!standing.measured ? null : live ? (
          <form action={unpublishFromControlCentre} className="flex items-center gap-3">
            <input type="hidden" name="event_id" value={eventId} />
            <span className="text-xs text-ink/50">Taking it down hides the 3D walk. Printed table signs keep working.</span>
            <button type="submit" className="h-9 rounded-md border border-ink/15 px-3 text-sm font-semibold text-ink hover:bg-ink/5">Take it down</button>
          </form>
        ) : planRead.tables === 0 ? (
          <span className="text-xs text-ink/50">Place your first table and the room draws itself.</span>
        ) : (
          <form action={publishFromControlCentre} className="flex items-center gap-3">
            <input type="hidden" name="event_id" value={eventId} />
            <span className="text-xs text-ink/50">Opens the moment you publish. Stays up until you take it down.</span>
            <button type="submit" className="h-9 rounded-md bg-mulberry px-3 text-sm font-semibold text-cream hover:bg-mulberry-600">Publish</button>
          </form>
        )}
      </section>

      {/* S3 · ONE NEXT STEP */}
      <section className={`mt-6 rounded-xl p-5 sm:p-6 ${nextStep.tone === 'failed' ? 'border border-ink/15 bg-ink/[0.03]' : nextStep.tone === 'quiet' ? 'border border-ink/10' : 'border border-terracotta/40 bg-terracotta/[0.04]'}`}>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-terracotta-700">Next step</p>
        <p className="mt-1 text-base font-semibold tracking-tight text-ink">{nextStep.headline}</p>
        <p className="mt-1 max-w-prose text-sm text-ink/60">{nextStep.blurb}</p>
        {nextStep.href && nextStep.cta ? (
          <Link href={nextStep.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-terracotta-700 underline-offset-2 hover:underline">
            {nextStep.cta} <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        ) : null}
      </section>

      {/* S4 · BUILT FROM — doors, never editors */}
      <section className="mt-10">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/50">Built from</p>
        <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">Three things you already made</h2>
        <ul className="mt-4 divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white">
          {sources.map((s) => {
            const Icon = ICON[s.key];
            return (
              <li key={s.key}>
                <Link href={s.href} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]">
                  <Icon aria-hidden className="h-4 w-4 text-ink/50" strokeWidth={2} />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink">{s.label}</span>
                    <span className={`block text-xs ${s.known ? 'text-ink/55' : 'text-ink/40'}`}>{s.known && s.value ? s.value : 'Couldn’t read it just now'}</span>
                  </span>
                  <ArrowRight aria-hidden className="h-4 w-4 text-ink/30" strokeWidth={2} />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink/50">↻ Change any of these and the room follows. Your guests always open the latest version — you never republish.</p>
      </section>

      {/* S5 · SET ONCE — only what lives nowhere else */}
      <section className="mt-10">
        <p className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/50">
          <PencilLine aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Set once
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">Only in the 3D Plan</h2>
        <ul className="mt-4 divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white">
          <li className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">How guests appear</span>
              <span className="block text-xs text-ink/55">Chibi · their own if they made one. Guests together see the nearest 8 move.</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink/60"><Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> In production</span>
          </li>
          <li>
            <Link href={`${base}/seating`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]">
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">Guest photos in the 3D walk</span>
                <span className="block text-xs text-ink/55">{PHOTO_VISIBILITY_LABEL[planRead.photoVisibility]} · set in the seating chart’s menu</span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 text-ink/30" strokeWidth={2} />
            </Link>
          </li>
          <li>
            <Link href={`${base}/details`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]">
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">Who can open the address</span>
                <span className="block text-xs text-ink/55">Your celebration’s own visibility setting decides — the room follows it</span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 text-ink/30" strokeWidth={2} />
            </Link>
          </li>
        </ul>
      </section>

      {/* S7 · THE BOUNDARY */}
      <p className="mt-8 rounded-xl border border-dashed border-ink/15 p-4 text-xs text-ink/50">
        <Store aria-hidden className="mr-1 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={2} />
        Decor lives in the room’s <Link href={`${base}/seating/lab`} className="underline underline-offset-2">Design panel</Link>; table signs in the{' '}
        <Link href={`${base}/seating/print`} className="underline underline-offset-2">print pack</Link>. Find-your-table is free without any of this. Supplier booths are placed in the seat plan, and their branding is the supplier’s own add-on — not yours to buy, and not yours to pay for.
      </p>
    </div>
  );
}
