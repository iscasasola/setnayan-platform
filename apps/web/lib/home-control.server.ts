import 'server-only';

/**
 * lib/home-control.server.ts — WHAT HOME'S CONTROL ROW READS BEYOND WHAT THE PAGE ALREADY HOLDS (owner-approved
 * 2026-10-24, `prototypes/home_control_center_2026-10-24_fable.html`). Three widgets need a fact the first screen did
 * not read before; each is read through the SHIPPED reader of that fact, never a second derivation:
 *
 *   ③ Event Hub — which page guests see now (`resolveHubStage`, the Event Hub control's own answer), the public link
 *                 (`publicEventPath`, the owner's segment from `resolveEventOwnerSlug`) and who can view it
 *                 (`whoCanViewLabel`, the Maker's words).
 *   ④ Suppliers — the dashboard's own "N of M booked" (`countUnlockedCategories` over THIS type's plan groups,
 *                 `planGroupsForEventType`), the quotes waiting on the couple (`SupplierStanding.needsYou`) and who
 *                 replied (`standingRollUp`) — both from `buildBenchStandings`, the Suppliers bench's own derivation.
 *   ⑥ To do     — Planning Stage's To do filter, read through THE ONE LIST (`fetchPreparationAgenda`, `only: 'todo'`)
 *                 and counted by its one rule (`planningProgress`) — so the tile and the list cannot disagree (owner
 *                 2026-11-01, "Checklist merges into Planning Stage"; `lib/the-plan-is-one-list.test.ts`).
 *
 * 🔒 HONEST READS — each answers `'unread'` when its read was refused (Supabase RESOLVES with `{ error }`, it does not
 * throw), so the widget says "Couldn't load", never 0. Held by `home-control-reads-honestly.test.ts`.
 *
 * Replaces, on the plan Home, the whole `EventDashboard only="whatsnext"` mount (its ~15 reads) — Home now asks only
 * for what its widgets draw.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveHubStage } from '@/lib/event-hub-control';
import { manualLaunchPhase } from '@/lib/invitation-widgets';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { whoCanViewLabel } from '@/lib/event-visibility';
import { siteUrl } from '@/lib/social/urls';
import { fetchPlanGroupScope, planGroupsForEventType } from '@/lib/plan-groups-by-event-type';
import { countUnlockedCategories } from '@/lib/todays-one-thing';
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';
import { BOOKED_BY_PAYMENT_EMBED, withEmbeddedPayments } from '@/lib/booked-by-payment';
import { buildBenchStandings } from '@/lib/conversation-list';
import { standingRollUp } from '@/lib/supplier-standing';
import type { VendorCategory } from '@/lib/vendors';
import { fetchPreparationAgenda, planningProgress, planningRowId } from '@/lib/preparation';
import type { HomeChecklistFacts, HomeHubFacts, HomeSuppliersFacts } from '@/app/dashboard/[eventId]/_components/home-control-faces';
import { shortDay } from '@/app/dashboard/[eventId]/_components/home-control-faces';

/** The slice of the event-type profile these reads ask about (`resolveProfile`). */
type ProfileSlice = { marketplaceEnabled: boolean; enabledSurfaces: readonly string[] };

/** The event row's columns the Event Hub widget reads — all carried by the page's one row (`DASHBOARD_ROW_CARRIES`). */
export type HomeHubEventRow = {
  slug: string | null;
  landing_page_visibility: string | null;
  event_date: string | null;
  event_end_date: string | null;
  cleared_at: string | null;
  timezone: string | null;
  std_invitation_launch_date: string | null;
  /** The couple's pin (`setLaunchPhase`) — absent/auto = the date decides. */
  launch_mode?: string | null;
  manual_phase?: string | null;
};

/** ③ THE EVENT HUB — null for a type with no Event Hub. Reads only the owner's link segment; the row is the page's. */
export async function readHomeHub(
  eventId: string,
  ev: HomeHubEventRow,
  /** `app` — the iPhone app (the store shell / Apple's gate): the link is named without its web address. */
  opts: { website: boolean; guide: HomeHubFacts['guide']; app: boolean },
): Promise<HomeHubFacts | 'unread' | null> {
  if (!opts.website) return null;
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId).catch((): null => null);
  // A PINNED stage wins — it is the page guests open on (`manualLaunchPhase(mode, pin) ?? …`, the composition every
  // site that picks the page's face uses). Owner 2026-10-25: "Pick what shows" pins it from this very tile.
  const stage = manualLaunchPhase(ev.launch_mode, ev.manual_phase) ?? resolveHubStage({
    measured: true,
    eventDate: ev.event_date,
    eventEndDate: ev.event_end_date,
    clearedAt: ev.cleared_at,
    timezone: ev.timezone,
    slug: ev.slug,
    invitationLaunchDate: ev.std_invitation_launch_date,
  });
  const origin = siteUrl().replace(/\/$/, '');
  const path = ev.slug ? publicEventPath(ev.slug, ownerSlug) : null;
  const open = ev.landing_page_visibility === 'public' || ev.landing_page_visibility === 'unlisted';
  return {
    stage,
    publicUrl: path && open ? `${origin}${path}` : null,
    where: opts.app
      ? whoCanViewLabel(ev.landing_page_visibility)
      : `${path ? `${origin.replace(/^https?:\/\//, '')}${path}` : 'No link yet'} · ${whoCanViewLabel(ev.landing_page_visibility)}`,
    dayShort: shortDay(ev.event_date),
    guide: opts.guide,
  };
}

/** ④ SUPPLIERS — null for a type that books no suppliers (`marketplaceEnabled` false, or the need is off). */
export async function readHomeSuppliers(
  supabase: SupabaseClient,
  eventId: string,
  opts: { show: boolean; eventType: string | null },
): Promise<HomeSuppliersFacts | 'unread' | null> {
  if (!opts.show) return null;
  const [vendorsRes, threadsRes, scope] = await Promise.all([
    supabase
      .from('event_vendors')
      .select(`vendor_id, vendor_name, category, status, lock_request_state, marketplace_vendor_id, manual_vendor_id, ${BOOKED_BY_PAYMENT_EMBED}`)
      .eq('event_id', eventId)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
    supabase.from('chat_threads').select('thread_id, vendor_profile_id, inquiry_status').eq('event_id', eventId),
    fetchPlanGroupScope(supabase),
  ]);
  if (vendorsRes.error || threadsRes.error) {
    logQueryError('HomeControl.suppliers', (vendorsRes.error ?? threadsRes.error)!, { event_id: eventId }, 'graceful_degrade');
    return 'unread';
  }
  const vendors = withEmbeddedPayments(
    (vendorsRes.data ?? []) as Array<{
      vendor_id: string;
      vendor_name: string;
      category: VendorCategory;
      status: string | null;
      lock_request_state: string | null;
      marketplace_vendor_id: string | null;
      manual_vendor_id: string | null;
      vendor_payments?: Array<{ payment_refused_at: string | null }> | null;
    }>,
  );
  const groups = planGroupsForEventType(opts.eventType, scope);
  const of = groups.filter((g) => g.countsTowardLockable !== false).length;
  const booked = Math.max(0, of - countUnlockedCategories(vendors as ReadonlyArray<EventVendorRowInput>, groups));

  // Where each supplier stands — the bench's own derivation, for the suppliers the couple has written to.
  const threadByProfile = new Map<string, { thread_id: string; inquiry_status: string | null }>();
  for (const t of (threadsRes.data ?? []) as Array<{ thread_id: string; vendor_profile_id: string; inquiry_status: string | null }>) {
    if (!threadByProfile.has(t.vendor_profile_id)) threadByProfile.set(t.vendor_profile_id, t);
  }
  const contactable = vendors.filter((v) => v.marketplace_vendor_id && threadByProfile.has(v.marketplace_vendor_id));
  let toDecide: HomeSuppliersFacts['toDecide'] = [];
  let replied = 0;
  if (contactable.length > 0) {
    const standings = await buildBenchStandings({
      supabase,
      eventId,
      nowMs: Date.now(),
      vendors: contactable.map((v) => {
        const t = threadByProfile.get(v.marketplace_vendor_id!)!;
        return { key: v.vendor_id, vendorProfileId: v.marketplace_vendor_id!, threadId: t.thread_id, inquiryStatus: t.inquiry_status };
      }),
    }).catch((e: unknown) => {
      logQueryError('HomeControl.standings', e instanceof Error ? e : new Error(String(e)), { event_id: eventId }, 'graceful_degrade');
      return null;
    });
    if (!standings) return 'unread';
    toDecide = contactable
      .filter((v) => standings.get(v.vendor_id)?.needsYou === true)
      .map((v) => ({ name: v.vendor_name, vendorId: v.vendor_id }));
    replied = standingRollUp(contactable.map((v) => ({ name: v.vendor_name, standing: standings.get(v.vendor_id) ?? null })))?.count ?? 0;
  }
  return { booked, of, toDecide, replied };
}

/** ⑥ TO DO — Planning Stage's To do filter, counted. Null when the plan has nothing to tick yet (no percentage exists). */
export async function readHomeChecklist(
  supabase: SupabaseClient,
  eventId: string,
  opts: {
    profile: ProfileSlice;
    event: {
      event_type: string | null;
      event_date: string | null;
      date_candidates?: string[] | null;
      date_window_start?: string | null;
      created_at: string | null;
    };
  },
): Promise<HomeChecklistFacts | 'unread' | null> {
  const agenda = await fetchPreparationAgenda({
    supabase,
    eventId,
    eventDate: opts.event.event_date,
    ceremonyType: null,
    now: new Date(),
    event: opts.event,
    profile: opts.profile,
    only: 'todo',
  }).catch(() => null);
  if (agenda === null || agenda.unread.length > 0) return 'unread';
  // Four: Home's To do shows three, and the fourth fills in when Now holds one of them (round 3, Now never repeats).
  const p = planningProgress(agenda.items, 4);
  if (p.total === 0) return null;
  // ✅ The row each To do line ticks (`PlanningTick`) — a task's checklist row or a hand-added step, the same rule as
  // `preparation-agenda.tsx`'s tickId; null = a computed step with no row (Home opens it instead). Worked out HERE, on
  // the server, so the shared `lib/preparation.ts` (in the Maker's first load) carries not one byte more.
  const next = p.next.map((n) => {
    const item = agenda.items.find((t) => (planningRowId(t) ?? t.id) === n.id);
    const tick =
      item?.source === 'task' && item.taskItemId
        ? { kind: 'task' as const, id: item.taskItemId }
        : item?.source === 'manual' && item.itemId
          ? { kind: 'manual' as const, id: item.itemId }
          : null;
    return { ...n, tick };
  });
  return { done: p.done, total: p.total, open: p.open, next, dueThisWeek: p.dueThisWeek };
}
