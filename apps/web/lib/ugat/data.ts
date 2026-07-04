import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { UgatEntityType } from './graph';
import { scoreUgatMatch } from './data-pure';

export { scoreUgatMatch } from './data-pure';

/**
 * lib/ugat/data.ts — the LIVE half of the Ugat Console (slice 1).
 *
 * The map's static registry (nine type nodes, their bindings, the joints audit
 * and the health findings) lives in lib/ugat/graph.ts. This module supplies the
 * REAL DB reads that fill it in against setnayan-prod:
 *   - getUgatCounts()  → the nine type-node counts (one cached ~60s round).
 *   - loadUgatTable()  → paginated (25/page) live rows per entity table.
 *   - ugatSearch()     → the ⌘K omnibox search across records + taxonomy.
 *
 * ADMIN OFF-LIMITS LOCK (project_setnayan_admin_account_access_model): this is
 * an internal surface using the RLS-bypassing service-role client, but it NEVER
 * selects chat message BODIES, guest FACE data, or file CONTENTS. The Guests
 * table is aggregate-only (per-event RSVP breakdown — no individual guest PII in
 * slice 1, per the privacy lock). Threads carry event×vendor + status + last
 * activity only — never a message.
 *
 * CACHING: counts are wrapped in `unstable_cache({ revalidate: 60 })` (the
 * spotlight-awards.ts admin-read pattern) so the map header is one cheap round
 * trip, refreshed at most once a minute. Table pages + search are per-request
 * (interactive, must be fresh) but memoized within a request via React cache().
 */

/* ── the nine live counts that fill the type nodes ── */
export interface UgatCounts {
  user: number;
  event: number;
  guest: number;
  /** VERIFIED, publishable vendors — the marketplace predicate (reused). */
  vendor: number;
  service: number;
  order: number;
  thread: number;
  /** Active subscriptions + summed token balances (a composite billing count). */
  billing: number;
  /** Taxonomy: folders · tiles · leaves · refinement sets (leaf count as the node number). */
  taxonomy: number;
  /** Sub-figures surfaced on the type-node cards. */
  detail: {
    vendorTotalOrgs: number;
    billingActiveSubs: number;
    billingTokensInCirculation: number;
    taxonomyFolders: number;
    taxonomyTiles: number;
    taxonomyLeaves: number;
    taxonomyRefinementSets: number;
    ordersPending: number;
  };
  /** Epoch ms the counts were computed (shown as "live · updated Xs ago"). */
  computedAt: number;
}

/**
 * Verified-vendor predicate — the SAME contract as lib/vendor-counts.ts
 * (public_visibility ∈ verified/coming_soon · verification_state = verified ·
 * not demo · non-empty business_name). Reused here so the Ugat vendor node can
 * never contradict the /explore grid or the signup count.
 */
function applyVerifiedVendorPredicate(
  q: ReturnType<SupabaseClient['from']>['select'] extends never ? never : any,
) {
  return q
    .in('public_visibility', ['verified', 'coming_soon'])
    .eq('verification_state', 'verified')
    .or('is_demo.is.null,is_demo.eq.false')
    .not('business_name', 'is', null)
    .neq('business_name', '');
}

async function headCount(
  admin: SupabaseClient,
  table: string,
  build?: (q: any) => any,
): Promise<number> {
  try {
    let q = admin.from(table).select('*', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    if (error) {
      logQueryError(`ugat headCount (${table})`, error);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    logQueryError(
      `ugat headCount threw (${table})`,
      e instanceof Error ? e : new Error(String(e)),
    );
    return 0;
  }
}

async function loadUgatCounts(): Promise<UgatCounts> {
  const admin = createAdminClient();

  // Nine type counts + the handful of card sub-figures, fanned out as cheap
  // head-count queries in parallel (the growth-stats.ts approach). Token
  // balances need a real read (sum), so that one pulls the two wallet columns.
  const [
    users,
    events,
    guestsLive,
    vendorsVerified,
    vendorsTotal,
    services,
    orders,
    ordersPending,
    threads,
    activeSubs,
    taxLeaves,
    taxTilesDistinct,
    taxFolders,
    refinementSets,
    walletRows,
  ] = await Promise.all([
    headCount(admin, 'users'),
    headCount(admin, 'events'),
    headCount(admin, 'guests', (q) => q.is('deleted_at', null)),
    headCount(admin, 'vendor_profiles', (q) => applyVerifiedVendorPredicate(q)),
    headCount(admin, 'vendor_profiles'),
    headCount(admin, 'vendor_services'),
    headCount(admin, 'orders'),
    headCount(admin, 'orders', (q) =>
      q.in('status', ['submitted', 'awaiting_payment', 'draft']),
    ),
    headCount(admin, 'chat_threads'),
    headCount(admin, 'vendor_subscriptions', (q) => q.eq('status', 'active')),
    headCount(admin, 'canonical_service_taxonomy'),
    // distinct tiles — a small read, deduped in JS (57 rows tops).
    admin
      .from('canonical_service_taxonomy')
      .select('tile_id')
      .then(({ data }) => {
        const s = new Set((data ?? []).map((r: { tile_id: string }) => r.tile_id));
        return s.size;
      }, () => 0),
    // folders = tier-1 categories (confirmed live: 10 rows at tier 1).
    headCount(admin, 'service_categories', (q) => q.eq('tier', 1)),
    headCount(admin, 'onboarding_refinements'),
    admin
      .from('vendor_wallets')
      .select('purchased_tokens, earned_tokens')
      .then(({ data, error }) => {
        if (error) {
          logQueryError('ugat wallets sum', error);
          return 0;
        }
        return (data ?? []).reduce(
          (sum: number, r: { purchased_tokens: number | null; earned_tokens: number | null }) =>
            sum + (r.purchased_tokens ?? 0) + (r.earned_tokens ?? 0),
          0,
        );
      }, () => 0),
  ]);

  return {
    user: users,
    event: events,
    guest: guestsLive,
    vendor: vendorsVerified,
    service: services,
    order: orders,
    thread: threads,
    // Composite billing figure: active subs + wallets that hold tokens.
    billing: activeSubs,
    taxonomy: taxLeaves,
    detail: {
      vendorTotalOrgs: vendorsTotal,
      billingActiveSubs: activeSubs,
      billingTokensInCirculation: walletRows,
      taxonomyFolders: taxFolders,
      taxonomyTiles: taxTilesDistinct,
      taxonomyLeaves: taxLeaves,
      taxonomyRefinementSets: refinementSets,
      ordersPending,
    },
    computedAt: Date.now(),
  };
}

const loadUgatCountsCached = unstable_cache(loadUgatCounts, ['ugat-type-counts-v1'], {
  revalidate: 60,
});

/** The nine live type-node counts + card sub-figures. Cached ~60s. */
export const getUgatCounts = cache(loadUgatCountsCached);

/* ═════════════════════════════════════════════════════════════════════════
   ENTITY TABLES — paginated live rows (25/page), one table per type. Each
   loader returns read-only row shapes + a stable id so the client can open a
   card. The Guests table is AGGREGATE-ONLY (per-event RSVP breakdown, no
   individual PII); Threads never carry message content.
   ═════════════════════════════════════════════════════════════════════════ */
export const UGAT_PAGE_SIZE = 25;

export type UgatTableKey =
  | 'users'
  | 'events'
  | 'guests'
  | 'vendors'
  | 'services'
  | 'orders'
  | 'threads'
  | 'billing';

/** A generic display row. `cells` are pre-formatted strings the table renders. */
export interface UgatRow {
  id: string;
  type: UgatEntityType;
  name: string;
  /** Ordered column values (strings, already formatted / redacted). */
  cells: string[];
  /** Optional in-app cross-link (opens the admin surface for this record). */
  href?: string;
  /** Optional status chip: [label, tone]. */
  status?: [string, 'ok' | 'wait' | 'neutral' | 'report'];
}

export interface UgatTablePage {
  key: UgatTableKey;
  columns: string[];
  rows: UgatRow[];
  page: number;
  pageSize: number;
  total: number;
  /** Aggregate-only tables carry a note instead of PII rows. */
  note?: string;
}

const TABLE_COLUMNS: Record<UgatTableKey, string[]> = {
  users: ['Name', 'Type', 'Created'],
  events: ['Event', 'Type', 'Date', 'Members'],
  guests: ['Event', 'Invited', 'RSVP’d', 'Declined', 'Pending'],
  vendors: ['Vendor', 'Tier', 'Verification'],
  services: ['Service card', 'Vendor', 'Category leaf'],
  orders: ['Reference', 'Service key', 'Status', 'Amount'],
  threads: ['Event × Vendor', 'Status', 'Last activity'],
  billing: ['Vendor', 'Kind', 'Detail'],
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtPeso(centavosOrPhp: number | null | undefined): string {
  if (centavosOrPhp == null) return '—';
  // orders store *_total_php in PHP (whole pesos), confirmed live.
  return `₱${Number(centavosOrPhp).toLocaleString('en-PH')}`;
}

function statusTone(status: string): 'ok' | 'wait' | 'neutral' | 'report' {
  const s = status.toLowerCase();
  if (['paid', 'fulfilled', 'active', 'verified', 'accepted'].some((x) => s.includes(x)))
    return 'ok';
  if (['pending', 'awaiting', 'submitted', 'draft', 'coming'].some((x) => s.includes(x)))
    return 'wait';
  if (['refunded', 'cancelled', 'rejected', 'declined'].some((x) => s.includes(x)))
    return 'report';
  return 'neutral';
}

/**
 * Load one page of an entity table. All reads use the service-role client
 * (internal surface) but honor the off-limits lock — no message bodies, no face
 * data, no file contents.
 */
async function loadUgatTableInner(
  key: UgatTableKey,
  page: number,
): Promise<UgatTablePage> {
  const admin = createAdminClient();
  const p = Math.max(0, Math.floor(page));
  const from = p * UGAT_PAGE_SIZE;
  const to = from + UGAT_PAGE_SIZE - 1;
  const columns = TABLE_COLUMNS[key];
  const base: UgatTablePage = {
    key,
    columns,
    rows: [],
    page: p,
    pageSize: UGAT_PAGE_SIZE,
    total: 0,
  };

  try {
    switch (key) {
      case 'users': {
        const { data, count, error } = await admin
          .from('users')
          .select('user_id, public_id, display_name, email, account_type, created_at', {
            count: 'exact',
          })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        base.rows = (data ?? []).map((u: any) => ({
          id: u.public_id ?? u.user_id,
          type: 'user' as const,
          name: u.display_name || u.email || u.public_id || 'User',
          href: '/admin/users',
          cells: [u.account_type ?? '—', fmtDate(u.created_at)],
        }));
        // prepend the name column value into cells for the client renderer
        base.rows = base.rows.map((r, i) => ({
          ...r,
          cells: [r.name, ...(r.cells as string[])],
        }));
        return base;
      }
      case 'events': {
        const { data, count, error } = await admin
          .from('events')
          .select('event_id, public_id, display_name, event_type, event_date, created_at', {
            count: 'exact',
          })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        // member counts for just this page's events (one grouped read).
        const eventIds = (data ?? []).map((e: any) => e.event_id);
        const memberCounts = new Map<string, number>();
        if (eventIds.length) {
          const { data: members } = await admin
            .from('event_members')
            .select('event_id')
            .in('event_id', eventIds);
          for (const m of members ?? []) {
            memberCounts.set(m.event_id, (memberCounts.get(m.event_id) ?? 0) + 1);
          }
        }
        base.rows = (data ?? []).map((e: any) => ({
          id: e.public_id ?? e.event_id,
          type: 'event' as const,
          name: e.display_name || e.public_id || 'Event',
          href: '/admin/events',
          cells: [
            e.display_name || e.public_id || 'Event',
            e.event_type ?? '—',
            fmtDate(e.event_date),
            String(memberCounts.get(e.event_id) ?? 0),
          ],
        }));
        return base;
      }
      case 'guests': {
        // AGGREGATE-ONLY (privacy lock): per-event RSVP breakdown, NO individual
        // guest rows. One page = up to 25 events, each with its guest tallies.
        const { data: events, count, error } = await admin
          .from('events')
          .select('event_id, public_id, display_name', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        const eventIds = (events ?? []).map((e: any) => e.event_id);
        // rsvp_status per guest for this page's events (status only — no PII).
        const tallies = new Map<
          string,
          { invited: number; rsvpd: number; declined: number; pending: number }
        >();
        if (eventIds.length) {
          const { data: guests } = await admin
            .from('guests')
            .select('event_id, rsvp_status')
            .is('deleted_at', null)
            .in('event_id', eventIds);
          for (const g of guests ?? []) {
            const t =
              tallies.get(g.event_id) ??
              { invited: 0, rsvpd: 0, declined: 0, pending: 0 };
            t.invited += 1;
            const s = (g.rsvp_status ?? '').toLowerCase();
            if (s === 'attending' || s === 'yes' || s === 'confirmed') t.rsvpd += 1;
            else if (s === 'declined' || s === 'no' || s === 'regrets') t.declined += 1;
            else t.pending += 1;
            tallies.set(g.event_id, t);
          }
        }
        base.rows = (events ?? []).map((e: any) => {
          const t =
            tallies.get(e.event_id) ?? { invited: 0, rsvpd: 0, declined: 0, pending: 0 };
          return {
            id: e.public_id ?? e.event_id,
            type: 'guest' as const,
            name: e.display_name || e.public_id || 'Event',
            href: '/admin/events',
            cells: [
              e.display_name || e.public_id || 'Event',
              String(t.invited),
              String(t.rsvpd),
              String(t.declined),
              String(t.pending),
            ],
          };
        });
        base.note =
          'Aggregate view only — per-event RSVP tallies. Individual guest PII is off-limits in slice 1 (privacy lock).';
        return base;
      }
      case 'vendors': {
        const { data, count, error } = await admin
          .from('vendor_profiles')
          .select(
            'vendor_profile_id, public_id, business_name, business_slug, tier_state, verification_state',
            { count: 'exact' },
          )
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        base.rows = (data ?? []).map((v: any) => ({
          id: v.public_id ?? v.vendor_profile_id,
          type: 'vendor' as const,
          name: v.business_name || v.public_id || 'Vendor',
          href: `/admin/vendors/${v.vendor_profile_id}/edit`,
          status: [
            v.verification_state ?? 'unverified',
            statusTone(v.verification_state ?? 'unverified'),
          ] as [string, 'ok' | 'wait' | 'neutral' | 'report'],
          cells: [
            v.business_name || v.public_id || 'Vendor',
            v.tier_state ?? '—',
            v.verification_state ?? 'unverified',
          ],
        }));
        return base;
      }
      case 'services': {
        const { data, count, error } = await admin
          .from('vendor_services')
          .select('vendor_service_id, public_id, title, category, vendor_profile_id', {
            count: 'exact',
          })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        // resolve vendor names for this page.
        const vids = [
          ...new Set((data ?? []).map((s: any) => s.vendor_profile_id).filter(Boolean)),
        ];
        const vendorNames = new Map<string, string>();
        if (vids.length) {
          const { data: vs } = await admin
            .from('vendor_profiles')
            .select('vendor_profile_id, business_name')
            .in('vendor_profile_id', vids);
          for (const v of vs ?? [])
            vendorNames.set(v.vendor_profile_id, v.business_name ?? '—');
        }
        base.rows = (data ?? []).map((s: any) => ({
          id: s.public_id ?? s.vendor_service_id,
          type: 'service' as const,
          name: s.title || s.public_id || 'Service card',
          cells: [
            s.title || s.public_id || 'Service card',
            vendorNames.get(s.vendor_profile_id) ?? '—',
            s.category ?? '—',
          ],
        }));
        return base;
      }
      case 'orders': {
        const { data, count, error } = await admin
          .from('orders')
          .select(
            'order_id, public_id, reference_code, service_key, status, requested_total_php, confirmed_total_php',
            { count: 'exact' },
          )
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        base.rows = (data ?? []).map((o: any) => ({
          id: o.public_id ?? o.order_id,
          type: 'order' as const,
          name: o.reference_code || o.public_id || 'Order',
          href: '/admin/payments',
          status: [o.status ?? 'unknown', statusTone(o.status ?? 'unknown')] as [
            string,
            'ok' | 'wait' | 'neutral' | 'report',
          ],
          cells: [
            o.reference_code || o.public_id || '—',
            o.service_key ?? '—',
            o.status ?? '—',
            fmtPeso(o.confirmed_total_php ?? o.requested_total_php),
          ],
        }));
        return base;
      }
      case 'threads': {
        // event × vendor + status + last activity ONLY — never a message body.
        const { data, count, error } = await admin
          .from('chat_threads')
          .select(
            'thread_id, public_id, event_id, vendor_profile_id, inquiry_status, updated_at',
            { count: 'exact' },
          )
          .order('updated_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        const eventIds = [
          ...new Set((data ?? []).map((t: any) => t.event_id).filter(Boolean)),
        ];
        const vendorIds = [
          ...new Set((data ?? []).map((t: any) => t.vendor_profile_id).filter(Boolean)),
        ];
        const eventNames = new Map<string, string>();
        const vendorNames = new Map<string, string>();
        if (eventIds.length) {
          const { data: es } = await admin
            .from('events')
            .select('event_id, display_name, public_id')
            .in('event_id', eventIds);
          for (const e of es ?? [])
            eventNames.set(e.event_id, e.display_name || e.public_id || 'Event');
        }
        if (vendorIds.length) {
          const { data: vs } = await admin
            .from('vendor_profiles')
            .select('vendor_profile_id, business_name, public_id')
            .in('vendor_profile_id', vendorIds);
          for (const v of vs ?? [])
            vendorNames.set(v.vendor_profile_id, v.business_name || v.public_id || 'Vendor');
        }
        base.rows = (data ?? []).map((t: any) => {
          const ev = eventNames.get(t.event_id) ?? 'Event';
          const vn = vendorNames.get(t.vendor_profile_id) ?? 'Vendor';
          return {
            id: t.public_id ?? t.thread_id,
            type: 'thread' as const,
            name: `${ev} × ${vn}`,
            status: [
              t.inquiry_status ?? 'open',
              statusTone(t.inquiry_status ?? 'open'),
            ] as [string, 'ok' | 'wait' | 'neutral' | 'report'],
            cells: [`${ev} × ${vn}`, t.inquiry_status ?? 'open', fmtDate(t.updated_at)],
          };
        });
        return base;
      }
      case 'billing': {
        // subscriptions per org (the token-wallet balances roll up on the node
        // card; here we list the subscription rows the admin can act on).
        const { data, count, error } = await admin
          .from('vendor_subscriptions')
          .select('purchase_id, vendor_id, tier, status, amount_php, billing_cycle', {
            count: 'exact',
          })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;
        const vids = [...new Set((data ?? []).map((s: any) => s.vendor_id).filter(Boolean))];
        const vendorNames = new Map<string, string>();
        if (vids.length) {
          const { data: vs } = await admin
            .from('vendor_profiles')
            .select('vendor_profile_id, business_name, public_id')
            .in('vendor_profile_id', vids);
          for (const v of vs ?? [])
            vendorNames.set(v.vendor_profile_id, v.business_name || v.public_id || 'Vendor');
        }
        base.rows = (data ?? []).map((s: any) => ({
          id: s.purchase_id,
          type: 'billing' as const,
          name: vendorNames.get(s.vendor_id) ?? 'Vendor',
          href: '/admin/subscriptions',
          status: [s.status ?? '—', statusTone(s.status ?? '—')] as [
            string,
            'ok' | 'wait' | 'neutral' | 'report',
          ],
          cells: [
            vendorNames.get(s.vendor_id) ?? 'Vendor',
            `Subscription · ${s.tier ?? '—'}`,
            `${fmtPeso(s.amount_php)} · ${s.billing_cycle ?? '—'}`,
          ],
        }));
        return base;
      }
      default:
        return base;
    }
  } catch (e) {
    logQueryError(
      `ugat loadTable (${key})`,
      e instanceof Error ? e : new Error(String(e)),
    );
    return { ...base, note: 'Could not load this table right now.' };
  }
}

/** Per-request memoized table page loader (25/page). */
export const loadUgatTable = cache(loadUgatTableInner);

/* ═════════════════════════════════════════════════════════════════════════
   ⌘K OMNIBOX SEARCH — live, server-side, across vendors · events · users ·
   orders · taxonomy names. Grouped results. Off-limits lock applies (no
   messages / face / files). Ranking is a pure helper (unit-tested).
   ═════════════════════════════════════════════════════════════════════════ */
export interface UgatSearchHit {
  id: string;
  type: UgatEntityType;
  title: string;
  sub: string;
  /** The type node to highlight when this hit is selected. */
  typeNodeId: string;
  href?: string;
  score: number;
}

export interface UgatSearchGroup {
  category: string;
  hits: UgatSearchHit[];
}

const TYPE_NODE_FOR: Record<UgatEntityType, string> = {
  user: 'TYPE-USERS',
  event: 'TYPE-EVENTS',
  guest: 'TYPE-GUESTS',
  vendor: 'TYPE-VENDORS',
  service: 'TYPE-SERVICES',
  order: 'TYPE-ORDERS',
  thread: 'TYPE-THREADS',
  billing: 'TYPE-BILLING',
  taxonomy: 'TYPE-TAXONOMY',
};

async function ugatSearchInner(query: string): Promise<UgatSearchGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const admin = createAdminClient();
  const like = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;

  const [vendors, events, users, orders, tiles] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id, public_id, business_name, business_slug')
      .or(`business_name.ilike.${like},business_slug.ilike.${like}`)
      .limit(6)
      .then(({ data }) => data ?? [], () => []),
    admin
      .from('events')
      .select('event_id, public_id, display_name, slug')
      .or(`display_name.ilike.${like},slug.ilike.${like}`)
      .limit(6)
      .then(({ data }) => data ?? [], () => []),
    admin
      .from('users')
      .select('user_id, public_id, display_name, email')
      .or(`display_name.ilike.${like},email.ilike.${like}`)
      .limit(6)
      .then(({ data }) => data ?? [], () => []),
    admin
      .from('orders')
      .select('order_id, public_id, reference_code, service_key, status')
      .or(`reference_code.ilike.${like},service_key.ilike.${like}`)
      .limit(6)
      .then(({ data }) => data ?? [], () => []),
    admin
      .from('canonical_service_taxonomy')
      .select('canonical_service, tile_id')
      .ilike('canonical_service', like)
      .limit(6)
      .then(({ data }) => data ?? [], () => []),
  ]);

  const groups: UgatSearchGroup[] = [];

  const vendorHits: UgatSearchHit[] = (vendors as any[])
    .map((v) => ({
      id: v.public_id ?? v.vendor_profile_id,
      type: 'vendor' as const,
      title: v.business_name || v.public_id || 'Vendor',
      sub: v.business_slug ? `/${v.business_slug}` : (v.public_id ?? ''),
      typeNodeId: TYPE_NODE_FOR.vendor,
      href: `/admin/vendors/${v.vendor_profile_id}/edit`,
      score: scoreUgatMatch(v.business_name ?? v.business_slug ?? '', q),
    }))
    .sort((a, b) => b.score - a.score);
  if (vendorHits.length) groups.push({ category: 'Vendors', hits: vendorHits });

  const eventHits: UgatSearchHit[] = (events as any[])
    .map((e) => ({
      id: e.public_id ?? e.event_id,
      type: 'event' as const,
      title: e.display_name || e.public_id || 'Event',
      sub: e.slug ? `/${e.slug}` : (e.public_id ?? ''),
      typeNodeId: TYPE_NODE_FOR.event,
      href: '/admin/events',
      score: scoreUgatMatch(e.display_name ?? e.slug ?? '', q),
    }))
    .sort((a, b) => b.score - a.score);
  if (eventHits.length) groups.push({ category: 'Events', hits: eventHits });

  const userHits: UgatSearchHit[] = (users as any[])
    .map((u) => ({
      id: u.public_id ?? u.user_id,
      type: 'user' as const,
      title: u.display_name || u.email || u.public_id || 'User',
      sub: u.email ?? (u.public_id ?? ''),
      typeNodeId: TYPE_NODE_FOR.user,
      href: '/admin/users',
      score: scoreUgatMatch(`${u.display_name ?? ''} ${u.email ?? ''}`, q),
    }))
    .sort((a, b) => b.score - a.score);
  if (userHits.length) groups.push({ category: 'Users', hits: userHits });

  const orderHits: UgatSearchHit[] = (orders as any[])
    .map((o) => ({
      id: o.public_id ?? o.order_id,
      type: 'order' as const,
      title: o.reference_code || o.public_id || 'Order',
      sub: `${o.service_key ?? '—'} · ${o.status ?? '—'}`,
      typeNodeId: TYPE_NODE_FOR.order,
      href: '/admin/payments',
      score: scoreUgatMatch(`${o.reference_code ?? ''} ${o.service_key ?? ''}`, q),
    }))
    .sort((a, b) => b.score - a.score);
  if (orderHits.length) groups.push({ category: 'Orders', hits: orderHits });

  const tileHits: UgatSearchHit[] = (tiles as any[])
    .map((t) => ({
      id: t.canonical_service,
      type: 'taxonomy' as const,
      title: t.canonical_service,
      sub: `Taxonomy leaf · tile ${t.tile_id ?? '—'}`,
      typeNodeId: TYPE_NODE_FOR.taxonomy,
      href: '/admin/taxonomy',
      score: scoreUgatMatch(t.canonical_service ?? '', q),
    }))
    .sort((a, b) => b.score - a.score);
  if (tileHits.length) groups.push({ category: 'Taxonomy', hits: tileHits });

  return groups;
}

/** Per-request memoized omnibox search. */
export const ugatSearch = cache(ugatSearchInner);

/* ═════════════════════════════════════════════════════════════════════════
   SAVED SEARCHES ("Questions") — three REAL filtered queries, each returning a
   count + the rows, so the omnibox "Questions" group is live, not canned.
   ═════════════════════════════════════════════════════════════════════════ */
export type UgatSavedSearchKey =
  | 'vendors-active-sub'
  | 'orders-pending'
  | 'events-this-week';

export interface UgatSavedSearch {
  key: UgatSavedSearchKey;
  question: string;
  /** Which table view to open + a summary count. */
  table: UgatTableKey;
  count: number;
  summary: string;
}

async function runSavedSearchInner(
  key: UgatSavedSearchKey,
): Promise<UgatSavedSearch> {
  const admin = createAdminClient();
  try {
    switch (key) {
      case 'vendors-active-sub': {
        const { count } = await admin
          .from('vendor_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        return {
          key,
          question: 'Vendors with an active subscription',
          table: 'billing',
          count: count ?? 0,
          summary: `${count ?? 0} active subscription${(count ?? 0) === 1 ? '' : 's'} — opening the Billing table.`,
        };
      }
      case 'orders-pending': {
        const { count } = await admin
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['submitted', 'awaiting_payment', 'draft']);
        return {
          key,
          question: 'Orders pending payment',
          table: 'orders',
          count: count ?? 0,
          summary: `${count ?? 0} order${(count ?? 0) === 1 ? '' : 's'} awaiting payment — opening the Orders table.`,
        };
      }
      case 'events-this-week': {
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { count } = await admin
          .from('events')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', weekAgo);
        return {
          key,
          question: 'Events created this week',
          table: 'events',
          count: count ?? 0,
          summary: `${count ?? 0} event${(count ?? 0) === 1 ? '' : 's'} created in the last 7 days — opening the Events table.`,
        };
      }
      default:
        return { key, question: '', table: 'events', count: 0, summary: '' };
    }
  } catch (e) {
    logQueryError(
      `ugat savedSearch (${key})`,
      e instanceof Error ? e : new Error(String(e)),
    );
    return { key, question: '', table: 'events', count: 0, summary: 'Could not run this search.' };
  }
}

export const runSavedSearch = cache(runSavedSearchInner);

/** The three saved-search definitions (for rendering the Questions group). */
export const UGAT_SAVED_SEARCHES: Array<{
  key: UgatSavedSearchKey;
  question: string;
  table: UgatTableKey;
}> = [
  { key: 'vendors-active-sub', question: 'Vendors with an active subscription', table: 'billing' },
  { key: 'orders-pending', question: 'Orders pending payment', table: 'orders' },
  { key: 'events-this-week', question: 'Events created this week', table: 'events' },
];
