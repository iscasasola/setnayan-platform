/**
 * Vendor → couple invite (the reverse of the couple/admin → vendor
 * `vendor_invites` claim flow in lib/vendor-invites.ts).
 *
 * Owner-locked flow (2026-06-30): a vendor shows/sends an invite QR; the
 * couple scans it and lands on /vendor-invite/[slug]. If signed out they
 * sign up (returning here via ?next); if signed in they pick one of their
 * events (or create one), and the vendor is imported into THAT event's
 * Explore shortlist (an `event_vendors` row — the same target as the
 * marketplace "Save" button). This is the free CRM on-ramp + viral
 * acquisition loop: the vendor's QR onboards the couple, and the vendor
 * lands on the couple's shortlist so they're now planning on Setnayan.
 *
 * No new table + no token cost — the vendor advertising themselves isn't a
 * per-recipient secret, so we key on the public `business_slug`. The
 * relationship that reviews-on-import later attach to IS this event_vendors
 * row.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { recomputeReceptionAnchor } from '@/lib/events';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { resolveVendorCategory } from '@/lib/vendor-packages';

const PRIMARY_HOST_ROLE_SUBTYPES = ['couple', 'co_host'] as const;

/**
 * Public couple-facing URL the vendor's invite (Shortlist) QR encodes.
 *
 * The base is still keyed on the public `business_slug` (stateless, tokenless —
 * a vendor advertising themselves isn't a per-recipient secret). The optional
 * `eventType` + `category` are the vendor's "pick an event / pick a service"
 * choices from the Shortlist QR generator: they scope the landing (which event
 * the couple is being invited to plan, and which category the vendor is
 * shortlisted under) and are read back on /vendor-invite/[slug].
 */
export function buildVendorInviteUrl(
  slug: string,
  opts?: { eventType?: string | null; category?: string | null },
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';
  const base = `${appUrl.replace(/\/$/, '')}/vendor-invite/${slug}`;
  const params = new URLSearchParams();
  if (opts?.eventType) params.set('et', opts.eventType);
  if (opts?.category) params.set('cat', opts.category);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Map a vendor's `services` text[] to a coarse VendorCategory for the
 * shortlist row. Mirrors the proven coercion in app/explore/actions.ts
 * (saveVendorToPicks): direct enum match first, then leaf→coarse, else misc.
 */
export function coerceVendorCategory(services: ReadonlyArray<string>): VendorCategory {
  for (const s of services) {
    if (VENDOR_CATEGORIES.includes(s as VendorCategory)) {
      return s as VendorCategory;
    }
  }
  for (const s of services) {
    const resolved = resolveVendorCategory(s);
    if (resolved !== 'misc') return resolved;
  }
  return 'misc';
}

/**
 * Distinct coarse VendorCategories a vendor covers, derived from their
 * `services` text[] (leaf codes). Powers the "pick a service" selector in the
 * Shortlist QR generator — the vendor scopes the QR to one of the categories
 * they actually serve. Order-stable (first appearance). Empty → caller shows
 * the "all my services" default only.
 */
export function vendorCoverageCategories(
  services: ReadonlyArray<string>,
): VendorCategory[] {
  const seen = new Set<VendorCategory>();
  const out: VendorCategory[] = [];
  for (const s of services) {
    const cat = VENDOR_CATEGORIES.includes(s as VendorCategory)
      ? (s as VendorCategory)
      : resolveVendorCategory(s);
    if (cat && cat !== 'misc' && !seen.has(cat)) {
      seen.add(cat);
      out.push(cat);
    }
  }
  return out;
}

export type HostEvent = {
  event_id: string;
  display_name: string | null;
  event_date: string | null;
  is_primary: boolean;
};

type EventStub = {
  event_id: string;
  display_name: string | null;
  event_date: string | null;
  is_primary: boolean;
  archived: boolean;
};

function pickEvent(row: { events: unknown }): EventStub | null {
  const ev = (Array.isArray(row.events) ? row.events[0] : row.events) as EventStub | null;
  return ev && !ev.archived ? ev : null;
}

/**
 * All non-archived events this user hosts, across BOTH membership models
 * (legacy event_members 'couple' + iteration 0048 event_moderators invite
 * path). Primary first, then by soonest date. De-duped by event_id. Pass the
 * admin client from a server action (event_moderators RLS is restrictive).
 */
export async function listHostEvents(
  client: SupabaseClient,
  userId: string,
): Promise<HostEvent[]> {
  const { data: memberRows } = await client
    .from('event_members')
    .select('event_id, events:event_id(event_id, display_name, event_date, is_primary, archived)')
    .eq('user_id', userId)
    .eq('member_type', 'couple');

  const { data: modRows } = await client
    .from('event_moderators')
    .select('event_id, events:event_id(event_id, display_name, event_date, is_primary, archived)')
    .eq('user_id', userId)
    .is('removed_at', null)
    .not('accepted_at', 'is', null)
    .in('role_subtype', PRIMARY_HOST_ROLE_SUBTYPES as unknown as string[]);

  const byId = new Map<string, EventStub>();
  for (const row of [...(memberRows ?? []), ...(modRows ?? [])]) {
    const ev = pickEvent(row);
    if (ev && !byId.has(ev.event_id)) byId.set(ev.event_id, ev);
  }

  return [...byId.values()]
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      // soonest dated next; undated last
      if (a.event_date && b.event_date) return a.event_date < b.event_date ? -1 : 1;
      if (a.event_date) return -1;
      if (b.event_date) return 1;
      return 0;
    })
    .map((e) => ({
      event_id: e.event_id,
      display_name: e.display_name,
      event_date: e.event_date,
      is_primary: e.is_primary,
    }));
}

export type ImportResult =
  | { status: 'ok'; eventVendorId: string }
  | { status: 'already_saved'; eventVendorId: string }
  | { status: 'vendor_not_found' }
  | { status: 'error'; message: string };

/**
 * Insert (idempotently) an `event_vendors` shortlist row linking a vendor
 * to an event. Same shape as saveVendorToPicks (status='considering', a
 * reception anchor recompute when the pick is a venue), EXCEPT the provenance:
 * source='vendor_invite' records that this relationship formed via the vendor's
 * QR invite (the vendor brought the couple), distinct from 'host_manual' (the
 * couple saved the vendor from the marketplace themselves). This is what
 * receipt-backed reviews read to render "Verified booking" (import) vs
 * "Verified wedding" (on-platform). Caller must have already verified the user
 * hosts `eventId`.
 */
export async function importVendorToEventShortlist(
  admin: SupabaseClient,
  input: {
    eventId: string;
    vendorProfileId: string;
    pickedBy: string;
    /**
     * The category the vendor chose in the Shortlist QR generator. When it's a
     * valid VendorCategory it overrides the coarse coercion from the vendor's
     * full service list, so the shortlist row lands under exactly the service
     * the QR was cut for. Ignored (falls back to coercion) when absent/invalid.
     */
    categoryOverride?: string | null;
  },
): Promise<ImportResult> {
  const { data: vendor, error: vError } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, services')
    .eq('vendor_profile_id', input.vendorProfileId)
    .maybeSingle();
  if (vError) return { status: 'error', message: vError.message };
  if (!vendor) return { status: 'vendor_not_found' };

  const { data: existing } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', input.eventId)
    .eq('marketplace_vendor_id', input.vendorProfileId)
    .maybeSingle();
  if (existing?.vendor_id) {
    return { status: 'already_saved', eventVendorId: existing.vendor_id };
  }

  const category =
    input.categoryOverride &&
    VENDOR_CATEGORIES.includes(input.categoryOverride as VendorCategory)
      ? (input.categoryOverride as VendorCategory)
      : coerceVendorCategory((vendor.services ?? []) as string[]);
  const { data: inserted, error: iError } = await admin
    .from('event_vendors')
    .insert({
      event_id: input.eventId,
      marketplace_vendor_id: input.vendorProfileId,
      category,
      vendor_name: vendor.business_name,
      status: 'considering',
      source: 'vendor_invite',
    })
    .select('vendor_id')
    .single();
  if (iError || !inserted) {
    return { status: 'error', message: iError?.message ?? 'Insert failed' };
  }

  if (category === 'venue') {
    await recomputeReceptionAnchor(admin, input.eventId);
  }

  return { status: 'ok', eventVendorId: inserted.vendor_id };
}
