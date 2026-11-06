import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveCoverageLabels } from '@/lib/vendor-coverages';
import { guestShownName } from '@/lib/guest-reviews';
import type { ScanMode } from '@/lib/supplier-scan';

/**
 * 🎟 THE SUPPLIER CLAIM SCANNER — the reads (the pure half is `lib/supplier-scan.ts`; every permission check is in the
 * database, migration 20271320327933). Each read is HONEST: a failed read returns null (or 'unreadable'), never an
 * empty list — "no claims yet" and "we couldn't load the claims" must never draw the same.
 *
 *   · the shop's own scanner setting per service — Shop › Services (the shop's own RLS);
 *   · the services a person may scan for on ONE event, with each one's count — the Hub's Scanner view
 *     (`supplier_scan_services` + `supplier_scan_tally`, SECURITY DEFINER, counts only);
 *   · a guest's own numbers — their Event Hub's quiet "Your number" card (the guest is not an RLS member; read with
 *     the service role, scoped to that one guest id the page already resolved from their pass);
 *   · the couple's view, with names — their souvenir desk (their own RLS: couple/coordinator members).
 */

export type ScanSetting = { enabled: boolean; mode: ScanMode };

/** The shop's scanner setting per service (coverage id). null = the read failed. */
export async function readShopScanSettings(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<Map<number, ScanSetting> | null> {
  const { data, error } = await supabase
    .from('supplier_scan_settings')
    .select('coverage_id, enabled, mode')
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    logQueryError('readShopScanSettings', error, { vendorProfileId });
    return null;
  }
  const out = new Map<number, ScanSetting>();
  for (const r of (data ?? []) as { coverage_id: number | string; enabled: boolean; mode: ScanMode }[]) {
    out.set(Number(r.coverage_id), { enabled: r.enabled, mode: r.mode });
  }
  return out;
}

export type ScanTally = {
  claimed: number;
  total: number;
  lastNumber: number;
  souvenir: boolean;
  /** Ordered → Received and shots (0 otherwise). */
  ordered: number;
  ready: number;
  /** Unlimited: every scan, and the guests among them. */
  served: number;
  unique: number;
  /** Group session: shots so far, and the one open now (null = none). */
  sessions: number;
  open: { number: number; guests: number } | null;
};

export type EventScanService = {
  coverageId: number;
  label: string;
  mode: ScanMode;
  /** null = this one count could not be read (the scanner still works; the count says "—"). */
  tally: ScanTally | null;
};

/** Parse the database's tally. */
export function tallyOf(raw: unknown): ScanTally | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const claimed = n(t.claimed);
  const total = n(t.total);
  const lastNumber = n(t.last_number);
  if (claimed === null || total === null || lastNumber === null) return null;
  const openNumber = n(t.open_number);
  return {
    claimed,
    total,
    lastNumber,
    souvenir: t.souvenir === true,
    ordered: n(t.ordered) ?? 0,
    ready: n(t.ready) ?? 0,
    served: n(t.served) ?? 0,
    unique: n(t.unique) ?? 0,
    sessions: n(t.sessions) ?? 0,
    open: openNumber !== null ? { number: openNumber, guests: n(t.open_guests) ?? 0 } : null,
  };
}

/**
 * The services the signed-in person may scan for on this event — their shop's, BOOKED here, scanner ON — each with
 * its count. 'unreadable' = the list itself could not be read (the view says so; it never says "no scanner").
 */
export async function readEventScanServices(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventScanService[] | 'unreadable'> {
  const { data, error } = await supabase.rpc('supplier_scan_services', { p_event_id: eventId });
  if (error) {
    logQueryError('readEventScanServices', error, { eventId });
    return 'unreadable';
  }
  const rows = (data ?? []) as { coverage_id: number | string; canonical_service: string; mode: ScanMode }[];
  if (rows.length === 0) return [];
  const labels = await resolveCoverageLabels();
  return Promise.all(
    rows.map(async (r) => {
      const coverageId = Number(r.coverage_id);
      const t = await supabase.rpc('supplier_scan_tally', { p_event_id: eventId, p_coverage_id: coverageId });
      if (t.error) logQueryError('readEventScanServices.tally', t.error, { eventId, coverageId });
      return {
        coverageId,
        label: labels.leafLabel(r.canonical_service),
        mode: r.mode,
        tally: t.error ? null : tallyOf(t.data),
      };
    }),
  );
}

export type GuestScanNumber = {
  number: number;
  service: string;
  shop: string | null;
  at: string;
  /** Ordered → Received: 'ordered' (being prepared) · 'ready' (claim it now) · 'received'. Souvenirs are received. */
  state: 'ordered' | 'ready' | 'received';
};

/**
 * One guest's own numbers at one event (newest first) — for THEIR Event Hub only. The caller has already resolved the
 * guest from their pass (`readGuestSession` / the page's viewer); this never takes a guest id from the browser.
 * null = the read failed (the card is simply not drawn — a guest is never told "no number" on a failed read).
 */
export async function readGuestScanNumbers(eventId: string, guestId: string): Promise<GuestScanNumber[] | null> {
  try {
    const admin = createAdminClient();
    const [claims, souvenirs] = await Promise.all([
      admin
        .from('supplier_scan_claims')
        .select('scan_number, claimed_at, coverage_id, vendor_profile_id, state')
        .eq('event_id', eventId)
        .eq('guest_id', guestId),
      admin
        .from('guest_souvenir_claims')
        .select('scan_number, claimed_at, coverage_id, vendor_profile_id')
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .not('scan_number', 'is', null),
    ]);
    if (claims.error || souvenirs.error) {
      logQueryError('readGuestScanNumbers', claims.error ?? souvenirs.error, { eventId });
      return null;
    }
    type Row = {
      scan_number: number;
      claimed_at: string;
      coverage_id: number | string | null;
      vendor_profile_id: string | null;
      state?: 'ordered' | 'ready' | 'received';
    };
    const rows = [...((claims.data ?? []) as Row[]), ...((souvenirs.data ?? []) as Row[])];
    if (rows.length === 0) return [];
    const covIds = [...new Set(rows.map((r) => r.coverage_id).filter((c): c is number | string => c != null))];
    const shopIds = [...new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => v != null))];
    const [covs, shops, labels] = await Promise.all([
      covIds.length ? admin.from('vendor_coverages').select('id, canonical_service').in('id', covIds) : { data: [], error: null },
      shopIds.length
        ? admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds)
        : { data: [], error: null },
      resolveCoverageLabels(),
    ]);
    const covLabel = new Map(
      ((covs.data ?? []) as { id: number | string; canonical_service: string }[]).map((c) => [String(c.id), labels.leafLabel(c.canonical_service)]),
    );
    const shopName = new Map(
      ((shops.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((s) => [s.vendor_profile_id, s.business_name]),
    );
    return rows
      .map((r) => ({
        number: r.scan_number,
        service: (r.coverage_id != null ? covLabel.get(String(r.coverage_id)) : null) ?? 'A supplier',
        shop: r.vendor_profile_id ? (shopName.get(r.vendor_profile_id) ?? null) : null,
        at: r.claimed_at,
        state: r.state ?? ('received' as const),
      }))
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch (err) {
    logQueryError('readGuestScanNumbers', err, { eventId });
    return null;
  }
}

export type CoupleScanClaim = {
  /** 'ordered' · 'ready' while an Ordered → Received item is on its way; 'received' once handed over. */
  state: 'ordered' | 'ready' | 'received';
  number: number;
  guestName: string;
  service: string;
  shop: string | null;
  method: 'supplier_qr' | 'supplier_nfc';
  at: string;
};

/**
 * Every supplier claim at this event, with the guest's name — the couple's desk. Read under the couple's OWN access
 * (`supplier_scan_claims_member_read`, and the guest list they already read), so a person who cannot read the guest
 * list reads nothing here either. Souvenir claims are not repeated: they are already the desk's own rows.
 * null = the read failed.
 */
export async function readCoupleScanClaims(supabase: SupabaseClient, eventId: string): Promise<CoupleScanClaim[] | null> {
  const embed = 'scan_number, claimed_at, method, coverage_id, vendor_profile_id, guests(first_name, last_name, display_name)';
  const [scans, souvenirs] = await Promise.all([
    supabase.from('supplier_scan_claims').select(`${embed}, state`).eq('event_id', eventId).order('claimed_at', { ascending: false }).limit(500),
    // A souvenir handed out at a supplier's scanner is the desk's own row — listed here too, so this is the whole night.
    supabase
      .from('guest_souvenir_claims')
      .select(embed)
      .eq('event_id', eventId)
      .not('scan_number', 'is', null)
      .order('claimed_at', { ascending: false })
      .limit(500),
  ]);
  if (scans.error || souvenirs.error) {
    logQueryError('readCoupleScanClaims', scans.error ?? souvenirs.error, { eventId });
    return null;
  }
  type Row = {
    scan_number: number;
    claimed_at: string;
    method: 'supplier_qr' | 'supplier_nfc';
    coverage_id: number | string | null;
    vendor_profile_id: string | null;
    state?: 'ordered' | 'ready' | 'received';
    guests: { first_name: string | null; last_name: string | null; display_name: string | null } | null;
  };
  const rows = [...((scans.data ?? []) as unknown as Row[]), ...((souvenirs.data ?? []) as unknown as Row[])];
  if (rows.length === 0) return [];
  // The supplier's name and the service's word are not secrets the couple lacks — their own Suppliers page shows both.
  const admin = createAdminClient();
  const covIds = [...new Set(rows.map((r) => r.coverage_id).filter((c): c is number | string => c != null))];
  const shopIds = [...new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => v != null))];
  const [covs, shops, labels] = await Promise.all([
    covIds.length ? admin.from('vendor_coverages').select('id, canonical_service').in('id', covIds) : { data: [], error: null },
    shopIds.length
      ? admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds)
      : { data: [], error: null },
    resolveCoverageLabels(),
  ]);
  const covLabel = new Map(
    ((covs.data ?? []) as { id: number | string; canonical_service: string }[]).map((c) => [String(c.id), labels.leafLabel(c.canonical_service)]),
  );
  const shopName = new Map(
    ((shops.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((s) => [s.vendor_profile_id, s.business_name]),
  );
  return rows
    .map((r) => {
      const g = r.guests;
      const name = g?.display_name?.trim() || `${g?.first_name ?? ''} ${g?.last_name ?? ''}`.trim() || 'A guest';
      return {
        state: r.state ?? ('received' as const),
        number: r.scan_number,
        guestName: name,
        service: (r.coverage_id != null ? covLabel.get(String(r.coverage_id)) : null) ?? 'A service',
        shop: r.vendor_profile_id ? (shopName.get(r.vendor_profile_id) ?? null) : null,
        method: r.method,
        at: r.claimed_at,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

export type AdminScanClaim = CoupleScanClaim & { claimId: string; kind: 'scan' | 'souvenir' };

/**
 * Admin › the event — every supplier claim with its id, so Setnayan can take back one recorded in error. Service role
 * (the page is behind `requireAdmin`); null = the read failed.
 */
export async function readAdminEventScans(eventId: string): Promise<AdminScanClaim[] | null> {
  try {
    const admin = createAdminClient();
    const embed = 'claim_id, scan_number, claimed_at, method, coverage_id, vendor_profile_id, guests(first_name, last_name, display_name)';
    const [scans, souvenirs, labels] = await Promise.all([
      admin.from('supplier_scan_claims').select(`${embed}, state`).eq('event_id', eventId).order('claimed_at', { ascending: false }).limit(500),
      admin
        .from('guest_souvenir_claims')
        .select(embed)
        .eq('event_id', eventId)
        .not('scan_number', 'is', null)
        .order('claimed_at', { ascending: false })
        .limit(500),
      resolveCoverageLabels(),
    ]);
    if (scans.error || souvenirs.error) {
      logQueryError('readAdminEventScans', scans.error ?? souvenirs.error, { eventId });
      return null;
    }
    type Row = {
      claim_id: string;
      scan_number: number;
      claimed_at: string;
      method: 'supplier_qr' | 'supplier_nfc';
      coverage_id: number | string | null;
      vendor_profile_id: string | null;
      state?: 'ordered' | 'ready' | 'received';
      guests: { first_name: string | null; last_name: string | null; display_name: string | null } | null;
    };
    const tagged = [
      ...((scans.data ?? []) as unknown as Row[]).map((r) => ({ r, kind: 'scan' as const })),
      ...((souvenirs.data ?? []) as unknown as Row[]).map((r) => ({ r, kind: 'souvenir' as const })),
    ];
    if (tagged.length === 0) return [];
    const covIds = [...new Set(tagged.map((t) => t.r.coverage_id).filter((c): c is number | string => c != null))];
    const shopIds = [...new Set(tagged.map((t) => t.r.vendor_profile_id).filter((v): v is string => v != null))];
    const [covs, shops] = await Promise.all([
      covIds.length ? admin.from('vendor_coverages').select('id, canonical_service').in('id', covIds) : { data: [], error: null },
      shopIds.length
        ? admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds)
        : { data: [], error: null },
    ]);
    const covLabel = new Map(
      ((covs.data ?? []) as { id: number | string; canonical_service: string }[]).map((c) => [String(c.id), labels.leafLabel(c.canonical_service)]),
    );
    const shopName = new Map(
      ((shops.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((s) => [s.vendor_profile_id, s.business_name]),
    );
    return tagged
      .map(({ r, kind }) => {
        const g = r.guests;
        return {
          claimId: r.claim_id,
          kind,
          state: r.state ?? ('received' as const),
          number: r.scan_number,
          guestName: g?.display_name?.trim() || `${g?.first_name ?? ''} ${g?.last_name ?? ''}`.trim() || 'A guest',
          service: (r.coverage_id != null ? covLabel.get(String(r.coverage_id)) : null) ?? 'A service',
          shop: r.vendor_profile_id ? (shopName.get(r.vendor_profile_id) ?? null) : null,
          method: r.method,
          at: r.claimed_at,
        };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch (err) {
    logQueryError('readAdminEventScans', err, { eventId });
    return null;
  }
}

export type GuestReviewAsk = {
  /** The shop being asked about — one ask per shop per event (the one store keeps one guest review per shop per event). */
  vendorProfileId: string;
  /** The service the scanner marked received ("Photo booth"); the first one when a shop has several. */
  service: string;
  shop: string | null;
  /** How the guest's name would show publicly, for the "Shown as" dropdown: "Gabriel D." or "G. D.". */
  names: { name: string; initials: string };
};

/**
 * ⭐ The shops this guest RECEIVED from (a `supplier_scan_claims` row in state received — the gate the one writer
 * `vendor_guest_review_submit` checks) and has neither reviewed (`vendor_guest_reviews`, by any door) nor answered "Not
 * now" to (`supplier_scan_review_skips`) — their Event Hub's optional "How was the Photo booth?" card (slice 5).
 * Service role, scoped to the one guest the page resolved from their pass.
 * null = the read failed (no card is drawn — never a question asked on a guess).
 */
export async function readGuestReviewAsks(eventId: string, guestId: string): Promise<GuestReviewAsk[] | null> {
  try {
    const admin = createAdminClient();
    const [claims, reviewed, skipped, guest] = await Promise.all([
      admin
        .from('supplier_scan_claims')
        .select('coverage_id, vendor_profile_id, claimed_at')
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .eq('state', 'received')
        .order('claimed_at', { ascending: true }),
      admin.from('vendor_guest_reviews').select('vendor_profile_id').eq('event_id', eventId).eq('guest_id', guestId),
      admin.from('supplier_scan_review_skips').select('vendor_profile_id').eq('event_id', eventId).eq('guest_id', guestId),
      admin.from('guests').select('first_name, last_name').eq('event_id', eventId).eq('guest_id', guestId).maybeSingle(),
    ]);
    const failed = claims.error ?? reviewed.error ?? skipped.error ?? guest.error;
    if (failed) {
      logQueryError('readGuestReviewAsks', failed, { eventId });
      return null;
    }
    const done = new Set(
      [...((reviewed.data ?? []) as { vendor_profile_id: string }[]), ...((skipped.data ?? []) as { vendor_profile_id: string }[])].map((r) => r.vendor_profile_id),
    );
    // One ask per shop: the first service that shop's scanner marked received names the question.
    const open = new Map<string, string>();
    for (const r of (claims.data ?? []) as { coverage_id: number | string; vendor_profile_id: string | null }[]) {
      if (r.vendor_profile_id && !done.has(r.vendor_profile_id) && !open.has(r.vendor_profile_id)) open.set(r.vendor_profile_id, String(r.coverage_id));
    }
    if (open.size === 0) return [];
    const [covs, shops, labels] = await Promise.all([
      admin.from('vendor_coverages').select('id, canonical_service').in('id', [...new Set(open.values())]),
      admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', [...open.keys()]),
      resolveCoverageLabels(),
    ]);
    const label = new Map(((covs.data ?? []) as { id: number | string; canonical_service: string }[]).map((c) => [String(c.id), labels.leafLabel(c.canonical_service)]));
    const shop = new Map(((shops.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((x) => [x.vendor_profile_id, x.business_name]));
    const g = (guest.data ?? null) as { first_name: string | null; last_name: string | null } | null;
    // The same words the "From guests" row will print (the guest-review page builds them the same way).
    const names = { name: guestShownName(g?.first_name ?? null, g?.last_name ?? null, 'name'), initials: guestShownName(g?.first_name ?? null, g?.last_name ?? null, 'initials') };
    return [...open.entries()].map(([vp, cov]) => ({
      vendorProfileId: vp,
      service: label.get(cov) ?? 'supplier',
      shop: shop.get(vp) ?? null,
      names,
    }));
  } catch (err) {
    logQueryError('readGuestReviewAsks', err, { eventId });
    return null;
  }
}
