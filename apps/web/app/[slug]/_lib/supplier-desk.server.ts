import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { fetchDayOfOverride } from '@/lib/vendor-dayof-config';
import { resolveModules } from '@/lib/vendor-dayof-modules';
import { eventTilesForBooking } from '@/lib/vendor-event-roles';
import {
  countdownLine,
  daysToGo,
  deskTools,
  supplierDeskStage,
  type DeskTool,
  type DeskWhen,
  type SupplierDeskStage,
} from '@/lib/supplier-desk-rule';
import { calendarDayInZone } from '@/lib/day-of-mode';
import { formatEventDate } from '@/lib/events';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import type { VendorCapability } from './site-identity';

/**
 * THE SUPPLIER'S DESK — everything on it, read under the SUPPLIER'S OWN SESSION.
 *
 * ── THE ONE RULE THIS FILE EXISTS TO HOLD ───────────────────────────────────
 * 🔒 `/{slug}` renders with the SERVICE ROLE. Every loader on that page takes an
 * admin client, and one is already in scope where this is called. That means
 * every permission rule keeping a supplier out of the guest list, the organiser's
 * private cues and the coordinator's own lines is INERT there — using it would
 * be one line, would work immediately, and would permanently remove the
 * database's opinion about who may read this celebration.
 *
 * So: **authorization may be answered with the service role, scoped by an id the
 * session proved. EVENT CONTENT NEVER IS.** `resolveVendorCapability` already
 * answered the authorization question the admin way and handed back nothing but
 * an id and a trading name. Everything below is content, so everything below
 * goes through `createClient()` — the caller's own cookie session — and is
 * subject to the same policies their own dashboard is.
 *
 * There is no `createAdminClient` import in this file, and a guard asserts that
 * it never gains one.
 *
 * ── WHY THE RUNNING ORDER IS NOT TAKEN FROM THE BRIEF ───────────────────────
 * `get_vendor_event_brief` returns a `timeline`, and it would have been one
 * fewer round trip. It is NOT used, because that function is SECURITY DEFINER
 * and its timeline select carries **no visibility filter at all** — it includes
 * `visibility = 'coordinator_only'` lines, which the booked-supplier RLS policy
 * deliberately excludes. Reading the blocks through the supplier's own session
 * gets the narrower, correct set, and carries `run_state` besides, which the
 * brief's copy does not.
 *
 * ── WHY A REFUSED BRIEF FALLS BACK TO THE DOOR ──────────────────────────────
 * 🪤 TWO COLUMNS ANSWER ONE QUESTION. The capability is minted off
 * `event_vendors.linked_vendor_profile_id`; the brief and the schedule policy
 * both gate on `marketplace_vendor_id`. Three writers set both, so they agree
 * today (measured in production 2026-08-27: 45 rows, 0 disagreements) — but one
 * migration sets the second from the first and never writes the first, so they
 * CAN diverge, in the direction where the hub admits and the brief refuses.
 * A desk rendered on that divergence would be a page of empty panels with no
 * error anywhere. So a refusal here returns `null` and the strip stays the
 * link-out it has always been: the supplier loses the desk, never the door.
 */

export type SupplierDeskModel = {
  /** Which of the four states the desk is in. The SHAPE never changes with it —
   *  same pieces, same order — only what each piece is able to say truthfully. */
  stage: SupplierDeskStage;
  /** The celebration's day, already formatted. A supplier looking three months
   *  out needs the date more than anything else on the desk. */
  eventDateLabel: string;
  /** "43 days to go" · "Tomorrow" · null once the day has arrived or passed. */
  countdown: string | null;
  /** Their trading name — the desk says whose desk it is, and is the way out. */
  businessName: string;
  vendorEventId: string;
  /** The venue's name and address: the two facts withheld until they said yes. */
  venueName: string | null;
  venueAddress: string | null;
  /** Live from the RSVPs. */
  attending: number;
  invited: number;
  /** What this shop was booked to do here — the couple-side category words. */
  bookedCategories: string[];
  /** Every running-order line this supplier may see, private ones included and
   *  flagged. Never filtered here — the marking is the whole point. */
  blocks: RunOfShowBlock[];
  /** Their own tools that live at an address of their own. */
  tools: DeskTool[];
  /**
   * THE BRIDGE — the shop's OTHER celebrations running today, if any.
   *
   * Design § E: a caterer with a morning christening and an evening reception
   * has two desks at two addresses and *"no time to hunt for links mid-service"*.
   * Empty on every other stage and, for almost everybody, always: it is one line
   * that appears the day somebody is genuinely working twice.
   */
  alsoToday: { eventId: string; name: string; href: string }[];
  /**
   * The couple↔supplier conversation that ALREADY EXISTS, when there is one.
   *
   * ⛔ The design is explicit that the room does not grow a chat of its own:
   * *"a third channel would split one conversation across three places."* This
   * is a link into the thread they and the organiser have been using since the
   * inquiry, offered on the call sheet because before the day *"everything is
   * communicated there"* has to be true too. `null` when no thread exists — a
   * booking made by Locked QR never opened one.
   */
  threadId: string | null;
};

type Brief = {
  stage?: string;
  event?: {
    venue_name?: string | null;
    venue_address?: string | null;
    event_date?: string | null;
  };
  booked_categories?: unknown;
  pax?: { invited?: number; attending?: number };
};

/**
 * Build the desk, or return null and let the strip stay a door.
 *
 * ⏳ IT IS BUILT FOR THE WHOLE LIFE OF THE BOOKING, NOT FOR ONE DAY. The stage
 * comes from `supplierDeskStage`, which is the same rule the organiser's own
 * day-of desk answers to; a celebration with no date at all yields no stage and
 * therefore no desk, because there is nothing honest a call sheet could say.
 *
 * 🔒 NOTHING ABOUT THE READ WIDENED WITH THE WINDOW. The same brief, the same
 * booked-stage gate, the same run-of-show read under the caller's own session.
 * A supplier three months out sees exactly what a supplier on the day sees,
 * because the database was always willing to tell them — `get_vendor_event_brief`
 * has no date gate, and neither does `event_schedule_blocks_booked_vendor_read`
 * (both read out of production 2026-08-28). The venue's address and the running
 * order were never withheld until the morning of; only this surface was.
 *
 * ⚠ NEVER THROWS. This runs inside the celebration's own page, which is the one
 * screen every guest at the event opens on the day. The same reasoning the
 * booking read already records: a failure must cost one supplier their desk, not
 * blank the invitation for two hundred people because a vendor table hiccuped.
 */
export async function loadSupplierDesk(
  capability: VendorCapability,
  /** The four facts the stage is decided from, read off the event shell the
   *  page already loaded. Passed in rather than re-queried: this file must not
   *  hold an opinion about when a celebration is, only about what to show. */
  when: DeskWhen,
): Promise<SupplierDeskModel | null> {
  const stage = supplierDeskStage(when);
  if (!stage) return null;

  try {
    const supabase = await createClient();

    const { data: briefData, error: briefError } = await supabase.rpc(
      'get_vendor_event_brief',
      { p_event_id: capability.vendorEventId },
    );
    if (briefError || !briefData) return null;
    const brief = briefData as Brief;
    // Only an agreed booking earns the venue and the running order. The RPC
    // already withholds them at every other rung — this refuses the DESK at
    // those rungs, so a pre-agreement supplier gets today's strip rather than a
    // room made of blanks.
    if (brief.stage !== 'booked') return null;

    const bookedCategories = Array.isArray(brief.booked_categories)
      ? (brief.booked_categories as unknown[]).filter((c): c is string => typeof c === 'string')
      : [];

    // THE BRIDGE, and it is asked only on the day. Before and after, "you are
    // also at" is not a fact anybody is about to act on, and the design puts the
    // line inside the live room.
    //
    // 🔒 IT IS AN RPC AND NOT A QUERY FOR THE REASON THIS WHOLE FILE EXISTS. The
    // shipped `fetchVendorRoomEvents` answers almost exactly this question and
    // opens `createAdminClient()` to do it — right for the vendor dashboard,
    // wrong inside a guest-facing page. `get_vendor_same_day_bookings` resolves
    // the caller from `auth.uid()`, proves they are booked in THIS room before
    // answering, and admits profiles they OWN only.
    const bridge =
      stage === 'today'
        ? supabase.rpc('get_vendor_same_day_bookings', {
            p_event_id: capability.vendorEventId,
            // The venue's calendar day. The database cannot know it — "today" is
            // a wall-clock question and the zone lives in app config.
            p_day: calendarDayInZone(when.tz, when.nowMs),
          })
        : Promise.resolve({ data: null, error: null });

    const [blocks, override, profile, thread, alsoRows] = await Promise.all([
      fetchRunOfShowBlocks(capability.vendorEventId),
      fetchDayOfOverride(supabase, capability.vendorProfileId, capability.vendorEventId),
      supabase
        .from('vendor_profiles')
        .select('services')
        .eq('vendor_profile_id', capability.vendorProfileId)
        .maybeSingle(),
      // The conversation that already exists. Read under the caller's own
      // session like everything else here: `chat_threads_member_read` admits a
      // thread whose `vendor_profile_id` is one of theirs, so a refusal here is
      // an empty result and costs one link, never the desk.
      supabase
        .from('chat_threads')
        .select('thread_id')
        .eq('event_id', capability.vendorEventId)
        .eq('vendor_profile_id', capability.vendorProfileId)
        .maybeSingle(),
      bridge,
    ]);

    const services = Array.isArray((profile.data as { services?: unknown } | null)?.services)
      ? ((profile.data as { services: unknown[] }).services.filter(
          (s): s is string => typeof s === 'string',
        ) as string[])
      : [];

    const modules = resolveModules(
      services,
      eventTilesForBooking({ bookedCategories }),
      override,
    );

    // A refused bridge costs one line, never the desk — same posture as the
    // thread read. An unreadable list of other bookings is not a reason to take
    // a supplier's running order away from them on the day.
    const alsoToday = Array.isArray((alsoRows as { data?: unknown }).data)
      ? ((alsoRows as { data: unknown[] }).data
          .filter((r): r is { event_id: string; display_name: string; slug: string | null } =>
            Boolean(r) && typeof r === 'object' && typeof (r as { event_id?: unknown }).event_id === 'string',
          )
          .map((r) => ({
            eventId: r.event_id,
            name: r.display_name,
            // The room is at the celebration's own address. Without a public
            // address there is no room to step into, so the link falls back to
            // the booking — never to a URL that would 404.
            href: r.slug ? `/${r.slug}` : `/vendor-dashboard/clients/${r.event_id}`,
          })))
      : [];

    const days = daysToGo({
      eventDate: when.eventDate,
      tz: when.tz,
      nowMs: when.nowMs,
    });

    return {
      stage,
      eventDateLabel: formatEventDate(brief.event?.event_date ?? when.eventDate ?? null),
      countdown: days === null ? null : countdownLine(days),
      businessName: capability.businessName,
      vendorEventId: capability.vendorEventId,
      venueName: brief.event?.venue_name ?? null,
      venueAddress: brief.event?.venue_address ?? null,
      attending: brief.pax?.attending ?? 0,
      invited: brief.pax?.invited ?? 0,
      bookedCategories,
      blocks: blocks ?? [],
      tools: deskTools(modules, capability.vendorEventId),
      alsoToday,
      threadId: (thread.data as { thread_id?: string } | null)?.thread_id ?? null,
    };
  } catch {
    return null;
  }
}
