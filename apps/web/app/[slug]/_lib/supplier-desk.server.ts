import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { fetchDayOfOverride } from '@/lib/vendor-dayof-config';
import { resolveModules } from '@/lib/vendor-dayof-modules';
import { eventTilesForBooking } from '@/lib/vendor-event-roles';
import { deskTools, type DeskTool } from '@/lib/supplier-desk-rule';
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
};

type Brief = {
  stage?: string;
  event?: { venue_name?: string | null; venue_address?: string | null };
  booked_categories?: unknown;
  pax?: { invited?: number; attending?: number };
};

/**
 * Build the desk, or return null and let the strip stay a door.
 *
 * ⚠ NEVER THROWS. This runs inside the celebration's own page, which is the one
 * screen every guest at the event opens on the day. The same reasoning the
 * booking read already records: a failure must cost one supplier their desk, not
 * blank the invitation for two hundred people because a vendor table hiccuped.
 */
export async function loadSupplierDesk(
  capability: VendorCapability,
): Promise<SupplierDeskModel | null> {
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

    const [blocks, override, profile] = await Promise.all([
      fetchRunOfShowBlocks(capability.vendorEventId),
      fetchDayOfOverride(supabase, capability.vendorProfileId, capability.vendorEventId),
      supabase
        .from('vendor_profiles')
        .select('services')
        .eq('vendor_profile_id', capability.vendorProfileId)
        .maybeSingle(),
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

    return {
      businessName: capability.businessName,
      vendorEventId: capability.vendorEventId,
      venueName: brief.event?.venue_name ?? null,
      venueAddress: brief.event?.venue_address ?? null,
      attending: brief.pax?.attending ?? 0,
      invited: brief.pax?.invited ?? 0,
      bookedCategories,
      blocks: blocks ?? [],
      tools: deskTools(modules, capability.vendorEventId),
    };
  } catch {
    return null;
  }
}
