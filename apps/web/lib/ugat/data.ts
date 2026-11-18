import { publicEventPath } from '@/lib/public-event-url';
import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { UgatEntityType } from './graph';
import {
  scoreUgatMatch,
  sanitizeIlikeTerm,
  eventWordFilters,
  guestNameOrFilter,
  guestDisplayName,
  guestRsvpLabel,
} from './data-pure';
import { ugatRecordHref } from './record-href';
import {
  classifyFocusQuery,
  countOrNull,
  focusPaymentHref,
  focusVendorHref,
  matchFocusAnswer,
  referenceIlikePattern,
  referenceIsExact,
  referenceMatches,
  settleRead,
  type FocusAnswerKey,
  type FocusCount,
  type PublicIdLetter,
  type SettledRead,
} from '@/lib/admin-map/focus-search';
import { getAdminQueueDigest } from '@/lib/admin/queue-counts';

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
 * selects chat message BODIES, guest FACE data, or file CONTENTS. Threads carry
 * event×vendor + status + last activity only — never a message. **That half of
 * the lock is untouched and must stay untouched.**
 *
 * ⚖ THE GUEST HALF WAS NARROWED BY THE OWNER ON 2026-08-27, AND ONLY BY NAME.
 * Asked directly — framed to him as a privacy posture call — whether an admin
 * should be able to search ANY guest by name across EVERY event, he
 * answered **YES**. So `ugatSearch()` now finds an individual guest. The lock
 * that used to read "no individual guest PII in slice 1" is superseded to
 * exactly this extent and no further:
 *   · SEARCHABLE by name only — `first_name`, `last_name`, `display_name`.
 *     Deliberately NOT by email or mobile: the ruling was "by name", and a
 *     reverse lookup from a contact detail is a different power nobody granted.
 *   · A HIT SHOWS what identifies the record — the name, the RSVP status, and
 *     which event. **Never a contact detail.** `email`, `mobile` and
 *     `address` are not selected by this module at all; they live on the
 *     record's own surface, which is the privacy-preserving default the
 *     shipped record links already follow.
 *   · The Guests TABLE BROWSER below stays AGGREGATE-ONLY. Browsing every
 *     guest is not what was asked for, and widening it was not ruled on.
 * ⚠ Do not read this as the lock being lifted. Anyone widening it further needs
 * a new ruling, not this comment.
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
  /** Samahan: non-archived communities (the live groups). */
  community: number;
  /** Papic: provisioned paparazzi seats — the unit of entitlement. */
  papic: number;
  /** Person: durable identities. Reads 0 until the counsel-gated spine lands. */
  person: number;
  /** Package: what vendors have authored for sale. */
  package: number;
  /** Proposal: offers made to a specific event. */
  proposal: number;
  /** Contract: signed artefacts. */
  contract: number;
  /** Availability: bookable pools. */
  availability: number;
  /** Geography: the shared region vocabulary. */
  geography: number;
  /** Seat Plan: tables laid out in the room. */
  seatplan: number;
  /** Run of Show: schedule blocks in the day. */
  runofshow: number;
  /** Live Studio: claimed camera operators. */
  livestudio: number;
  /**
   * Mood Board library: EVERY asset in the pool — admin placeholders, generated
   * attire figures, florals AND suppliers' own gallery photos. Not "supplier
   * photos uploaded"; for that slice, filter on
   * asset_type = 'supplier_gallery'.
   */
  gallery: number;
  /**
   * Design sign-offs: EVERY per-part finalization handshake ever opened,
   * including closed rounds (declined / cancelled / expired). Not "parts
   * currently settled"; for that slice, filter on state = 'agreed'.
   */
  signoff: number;
  /**
   * Colour access: every LIVE grant row — vendors and coordinators together,
   * one row per DOMAIN. A stylist's single on-screen switch is two rows. Not
   * "how many people hold access"; for that, count distinct subjects.
   */
  colourgrant: number;
  /**
   * Wedding March: every walk row — one per person placed in a march, across
   * every event. Not "how many walks"; for that, count distinct (event_id,
   * walk_no).
   */
  march: number;
  /** Inspiration parts: every part row, hidden ones included (they still hold photos). */
  inspirationpart: number;
  /** Supplier scans: every claim a supplier's scanner recorded (souvenir-desk rows written by a supplier are not repeated). */
  supplierscan: number;
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
    /**
     * Total membership ROWS across all communities — a tally, never identities.
     * The roster is personal data about third parties (RA 10173), so the admin
     * map counts memberships and stops there; naming members needs its own
     * stated basis and its own surface.
     */
    communityMembers: number;
    /** Captures across the whole platform (papic_photos rows). */
    papicPhotos: number;
    /** Guest-side captures (the Papic One shape). */
    papicGuestCaptures: number;
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
    communitiesLive,
    communityMemberRows,
    papicSeats,
    papicPhotoRows,
    papicGuestCaptureRows,
    peopleRows,
    packageRows,
    proposalRows,
    contractRows,
    poolRows,
    regionRows,
    tableRows,
    blockRows,
    cameraRows,
    libraryRows,
    signoffRows,
    colourGrantRows,
    colourGrantHostRows,
    marchRows,
    inspirationPartRows,
    supplierScanRows,
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
    // Samahan: LIVE groups only — `archived` is a soft-retire, so counting all
    // rows would inflate the node with groups nobody is in anymore.
    headCount(admin, 'communities', (q) => q.eq('archived', false)),
    // Membership TALLY only. Never select user_id here: the roster is personal
    // data about third parties (J14's trap), and a head-count needs no identities.
    headCount(admin, 'community_members'),
    // Papic: SEATS are the node number — a seat is the unit of entitlement, and
    // it is the hub of the 17-table cluster (J16).
    headCount(admin, 'paparazzi_seats'),
    // Capture volumes as sub-figures. Counts only: capture rows carry geo,
    // device and EXIF metadata, none of which an admin roll-up needs.
    headCount(admin, 'papic_photos'),
    headCount(admin, 'papic_guest_captures'),
    headCount(admin, 'people'),
    headCount(admin, 'vendor_packages'),
    headCount(admin, 'vendor_proposals'),
    headCount(admin, 'vendor_contracts'),
    headCount(admin, 'vendor_schedule_pools'),
    headCount(admin, 'regions'),
    headCount(admin, 'event_tables'),
    headCount(admin, 'event_schedule_blocks'),
    headCount(admin, 'panood_camera_operators'),
    // Mood Board library: the whole pool. The supplier-gallery slice is a
    // filter on asset_type, deliberately NOT what this node counts — see the
    // warning on UgatCounts.gallery and on TYPE-GALLERY itself.
    headCount(admin, 'moodboard_library_assets'),
    // Design sign-offs: every handshake ever opened. The node counts the
    // CONVERSATION, not its verdict — see the warning on UgatCounts.signoff.
    headCount(admin, 'moodboard_part_finalizations'),
    // Colour access: LIVE grants only. A revoked row is kept (revocation is a
    // flip, not a delete) and counting it would report standing permission
    // that no longer stands.
    headCount(admin, 'event_colour_grants', (q) => q.eq('is_active', true)),
    headCount(admin, 'event_colour_grants_coordinator', (q) => q.eq('is_active', true)),
    // Wedding March: every person placed in a march (one row each).
    headCount(admin, 'march_walks'),
    // Inspiration parts: every part, hidden included.
    headCount(admin, 'inspiration_parts'),
    // Supplier scans: every claim a supplier's scanner recorded.
    headCount(admin, 'supplier_scan_claims'),
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
    community: communitiesLive,
    papic: papicSeats,
    person: peopleRows,
    package: packageRows,
    proposal: proposalRows,
    contract: contractRows,
    availability: poolRows,
    geography: regionRows,
    seatplan: tableRows,
    runofshow: blockRows,
    livestudio: cameraRows,
    gallery: libraryRows,
    signoff: signoffRows,
    colourgrant: colourGrantRows + colourGrantHostRows,
    march: marchRows,
    inspirationpart: inspirationPartRows,
    supplierscan: supplierScanRows,
    detail: {
      vendorTotalOrgs: vendorsTotal,
      billingActiveSubs: activeSubs,
      billingTokensInCirculation: walletRows,
      taxonomyFolders: taxFolders,
      taxonomyTiles: taxTilesDistinct,
      taxonomyLeaves: taxLeaves,
      taxonomyRefinementSets: refinementSets,
      ordersPending,
      communityMembers: communityMemberRows,
      papicPhotos: papicPhotoRows,
      papicGuestCaptures: papicGuestCaptureRows,
    },
    computedAt: Date.now(),
  };
}

// Key bumped v1 → v2 for the added `community` + `detail.communityMembers`
// fields. Without the bump a cached v1 payload keeps being served for up to 60s
// and the new sub-figures read as undefined — which renders as a plausible-
// looking blank rather than an error, the worst kind of wrong.
// v2 → v3 for the added `papic` count + its two capture sub-figures. Same reason
// as the v1→v2 bump: a stale payload renders the new figures as undefined, which
// looks like a plausible blank rather than an error.
const loadUgatCountsCached = unstable_cache(loadUgatCounts, ['ugat-type-counts-v3'], {
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

/**
 * The single table list lives in `./data-pure` — see the long note there.
 *
 * It CANNOT live in this file: `ugat-console.tsx` is a `'use client'` component
 * and needs the tuple at runtime to render its tabs, but this module opens with
 * `import 'server-only'`, so importing a value from here into the client fails
 * the production build. Re-exported so every server-side caller keeps its
 * existing `@/lib/ugat/data` import path.
 */
export { UGAT_TABLE_KEYS, type UgatTableKey } from './data-pure';
// A re-export does NOT bind the name locally, and this module uses the type in
// six of its own signatures — so it is imported as well as re-exported.
import type { UgatTableKey as UgatTableKeyLocal } from './data-pure';
import { formatCount } from '@/lib/format-number';
type UgatTableKey = UgatTableKeyLocal;

/** A generic display row. `cells` are pre-formatted strings the table renders. */
export interface UgatRow {
  id: string;
  type: UgatEntityType;
  name: string;
  /** Ordered column values (strings, already formatted / redacted). */
  cells: string[];
  /**
   * Where this ONE row opens, when a per-record admin surface exists for it.
   * Genuinely optional here, unlike on a search hit: three of the nine tables
   * (services · threads · communities) have no admin page of their own, and the
   * console falls back to the type card for those rather than inventing a link.
   */
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
  vendors: ['Supplier', 'Tier', 'Verification'],
  services: ['Service card', 'Supplier', 'Category leaf'],
  orders: ['Reference', 'Service key', 'Status', 'Amount'],
  threads: ['Event × Supplier', 'Status', 'Last activity'],
  billing: ['Supplier', 'Kind', 'Detail'],
  // "Members" is a TALLY column, never a roster — see the communities case.
  communities: ['Group', 'Kind', 'Members'],
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
          href: ugatRecordHref({ kind: 'user', userId: u.user_id }),
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
          href: ugatRecordHref({
            kind: 'event',
            publicId: e.public_id ?? null,
            slug: null,
          }),
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
            // A guests row IS an event (this table is per-event tallies), so it
            // opens the event — never a guest, who has no admin page and whose
            // PII this surface deliberately never loads.
            href: ugatRecordHref({
              kind: 'event',
              publicId: e.public_id ?? null,
              slug: null,
            }),
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
          'Aggregate view only — per-event RSVP tallies. Browsing individual guests stays off-limits here; ' +
          'searching one by name is the door the owner opened (2026-08-27), and it lives in the search bar above.';
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
          name: v.business_name || v.public_id || 'Supplier',
          href: ugatRecordHref({ kind: 'vendor', vendorProfileId: v.vendor_profile_id }),
          status: [
            v.verification_state ?? 'unverified',
            statusTone(v.verification_state ?? 'unverified'),
          ] as [string, 'ok' | 'wait' | 'neutral' | 'report'],
          cells: [
            v.business_name || v.public_id || 'Supplier',
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
          href: ugatRecordHref({ kind: 'order', publicId: o.public_id ?? null }),
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
            vendorNames.set(v.vendor_profile_id, v.business_name || v.public_id || 'Supplier');
        }
        base.rows = (data ?? []).map((t: any) => {
          const ev = eventNames.get(t.event_id) ?? 'Event';
          const vn = vendorNames.get(t.vendor_profile_id) ?? 'Supplier';
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
            vendorNames.set(v.vendor_profile_id, v.business_name || v.public_id || 'Supplier');
        }
        base.rows = (data ?? []).map((s: any) => ({
          id: s.purchase_id,
          type: 'billing' as const,
          name: vendorNames.get(s.vendor_id) ?? 'Supplier',
          href: '/admin/subscriptions',
          status: [s.status ?? '—', statusTone(s.status ?? '—')] as [
            string,
            'ok' | 'wait' | 'neutral' | 'report',
          ],
          cells: [
            vendorNames.get(s.vendor_id) ?? 'Supplier',
            `Subscription · ${s.tier ?? '—'}`,
            `${fmtPeso(s.amount_php)} · ${s.billing_cycle ?? '—'}`,
          ],
        }));
        return base;
      }
      case 'communities': {
        // GROUP-LEVEL ONLY. A samahan is an entity and may be listed; its ROSTER
        // is personal data about third parties (RA 10173 · joint J14's trap), so
        // this reads member TALLIES and never selects a single user_id. If a
        // future surface needs to name members, it needs its own stated basis —
        // not a widened select here.
        const { data, count, error } = await admin
          .from('communities')
          .select('community_id, public_id, name, kind, archived, created_at', {
            count: 'exact',
          })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        base.total = count ?? 0;

        // One extra query for the tallies on THIS page only, counted in JS.
        // Selecting community_id alone keeps identities out of the payload.
        const ids = (data ?? []).map((c: any) => c.community_id).filter(Boolean);
        const memberTally = new Map<string, number>();
        if (ids.length) {
          const { data: ms } = await admin
            .from('community_members')
            .select('community_id')
            .in('community_id', ids);
          for (const m of ms ?? [])
            memberTally.set(m.community_id, (memberTally.get(m.community_id) ?? 0) + 1);
        }

        base.rows = (data ?? []).map((c: any) => ({
          id: c.community_id,
          type: 'community' as const,
          name: c.name || c.public_id || 'Group',
          // No href: there is no /admin communities surface yet. The first one
          // to ship should wire it here rather than inventing a second link.
          status: [c.archived ? 'archived' : 'live', c.archived ? 'neutral' : 'ok'] as [
            string,
            'ok' | 'wait' | 'neutral' | 'report',
          ],
          cells: [
            c.name || c.public_id || 'Group',
            c.kind ?? '—',
            `${memberTally.get(c.community_id) ?? 0} members`,
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
   orders · taxonomy names · GUESTS (by name, owner ruling 2026-08-27).
   Grouped results. Off-limits lock still applies (no messages / face / files,
   and no guest contact details). Ranking is a pure helper (unit-tested).
   ═════════════════════════════════════════════════════════════════════════ */
export interface UgatSearchHit {
  id: string;
  type: UgatEntityType;
  title: string;
  sub: string;
  /**
   * Where this ONE record opens. REQUIRED, and that is the fix: it was optional
   * and unread, so every hit opened a diagram of its own type instead. Making
   * it non-optional is what stops a sixth kind shipping without a destination —
   * the compiler refuses it rather than a reviewer noticing.
   */
  href: string;
  score: number;
  /** The record's public ID (or a payment's reference), shown at the row's end. */
  publicId?: string | null;
  /** Pages prepared beside a top hit — they only open a page, never act. */
  prepared?: ReadonlyArray<{ label: string; sub: string; href: string }>;
}

export interface UgatSearchGroup {
  category: string;
  hits: UgatSearchHit[];
  /** 🔑 The read behind this group FAILED — the box says "Couldn't search", never "no matches". */
  failed?: boolean;
  /** An answered question ("paid today") — counted numbers; `count: null` = could not be read. */
  answer?: FocusCount[];
}

/*
 * `TYPE_NODE_FOR` USED TO LIVE HERE and it is deliberately gone. It existed to
 * stamp every hit with the type node the console highlighted INSTEAD of opening
 * the record — the defect itself. With hits now carrying a real destination it
 * had no reader left, and leaving it would have replaced one dead field with
 * another. The table browser keeps its own map, which is still live: a row on a
 * table with no per-record admin page still falls back to the type card.
 */

async function ugatSearchInner(query: string): Promise<UgatSearchGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const admin = createAdminClient();

  /*
    🔦 FOCUS AT SPOTLIGHT LEVEL (owner approved 18 Nov 2026). Three changes to
    how this search answers, each decided in the pure `focus-search.ts`:
      · a WHOLE public ID reads the one table its letter belongs to and returns
        that record alone (`Exact ID`) — before, only events matched an ID;
      · a payment reference reads `payments.reference_number` — before, no arm
        searched it at all;
      · a question ("paid today") returns a counted number (`Answer`).
    And one change to every arm: 🔑 A FAILED READ IS A FAILED GROUP. Each arm
    used to end in `() => []`, so a refused read rendered exactly like "no
    matches". `settleRead` keeps the difference, and the box draws it.
  */
  const parsed = classifyFocusQuery(q);
  if (parsed.kind === 'public-id') return searchByPublicId(admin, parsed.publicId, parsed.known);

  /*
    SHARED SANITIZER, and it fixes the four arms below as well as the new one.
    This used to escape `%` and `_` and nothing else — but `.or()` splits its
    clauses on COMMAS, so any query containing one (`Dela Cruz, Maria`) built a
    malformed filter, PostgREST refused the whole query, and every arm resolved
    with an error and no rows. The box said "No matches" and nothing was logged.
    Rejected, not thrown; the only symptom is an absence.
  */
  const like = `%${sanitizeIlikeTerm(q)}%`;
  const guestFilter = guestNameOrFilter(q);
  const logged = <T,>(label: string, s: SettledRead<T>) => {
    if (s.failed) logQueryError(`ugat search (${label})`, new Error('read failed'));
    return s;
  };
  const answerKey = matchFocusAnswer(q);

  const [vendors, events, users, orders, tiles, guests, payments, answer] = await Promise.all([
    settleRead<any>(
      admin
        .from('vendor_profiles')
        .select('vendor_profile_id, public_id, business_name, business_slug')
        .or(`business_name.ilike.${like},business_slug.ilike.${like}`)
        .limit(6),
    ).then((s) => logged('vendors', s)),
    // 🔎 F-W2-37: word by word, with the public id.
    settleRead<any>(
      (eventWordFilters(q) ?? [])
        .reduce((qb, f) => qb.or(f), admin.from('events').select('event_id, public_id, display_name, slug'))
        .limit(6),
    ).then((s) => {
      if (s.failed) logQueryError('ugat search (events)', new Error('read failed'));
      return s;
    }),
    settleRead<any>(
      admin
        .from('users')
        .select('user_id, public_id, display_name, email')
        .or(`display_name.ilike.${like},email.ilike.${like}`)
        .limit(6),
    ).then((s) => logged('users', s)),
    settleRead<any>(
      admin
        .from('orders')
        .select('order_id, public_id, reference_code, service_key, status')
        .or(`reference_code.ilike.${like},service_key.ilike.${like}`)
        .limit(6),
    ).then((s) => logged('orders', s)),
    settleRead<any>(
      admin.from('canonical_service_taxonomy').select('canonical_service, tile_id').ilike('canonical_service', like).limit(6),
    ).then((s) => logged('taxonomy', s)),
    /*
      GUESTS — by NAME, and nothing that is not a name.
      · `email`, `mobile` and `address` are not in this select, so there is no
        arm of this feature where a contact detail can reach a screen.
      · `deleted_at is null` — a removed guest is not a record to hand back.
    */
    guestFilter === null
      ? Promise.resolve<SettledRead<any>>({ rows: [], failed: false })
      : settleRead<any>(
          admin
            .from('guests')
            .select('guest_id, public_id, first_name, last_name, display_name, rsvp_status, event_id')
            .or(guestFilter)
            .is('deleted_at', null)
            .limit(6),
        ).then((s) => logged('guests', s)),
    /*
      PAYMENTS — by the reference the couple typed (GCash / BDO), the same field
      the Payments queue reads. Only when the words ARE a reference: a wildcard
      between every digit finds it however it was spaced, and `referenceMatches`
      is the exact check on what comes back.
    */
    parsed.referenceDigits === null
      ? Promise.resolve<SettledRead<any>>({ rows: [], failed: false })
      : settleRead<any>(
          admin
            .from('payments')
            .select('payment_id, order_id, user_id, reference_number, channel, status, amount_php')
            .ilike('reference_number', referenceIlikePattern(parsed.referenceDigits))
            .order('created_at', { ascending: false })
            .limit(20),
        ).then((s) => logged('payments', s)),
    answerKey ? countFocusAnswer(admin, answerKey) : Promise.resolve(null),
  ]);

  const groups: UgatSearchGroup[] = [];
  if (answer) groups.push({ category: 'Answer', hits: [], answer });

  /*
    THE PAYMENT, THEN WHAT FOLLOWS IT: the order it is on, and who logged it.
    Read only when a reference actually matched.
  */
  const refDigits = parsed.referenceDigits;
  const paymentRows = refDigits ? (payments.rows as any[]).filter((p) => referenceMatches(p.reference_number, refDigits)).slice(0, 6) : [];
  if (refDigits && (payments.failed || paymentRows.length)) {
    const exact = paymentRows.some((p) => referenceIsExact(p.reference_number, refDigits));
    groups.push({
      category: exact ? 'Exact reference' : 'Payments',
      failed: payments.failed,
      hits: paymentRows.map((p) => ({
        id: p.payment_id,
        type: 'billing' as const,
        title: `${channelWord(p.channel)} payment`,
        sub: `Payment · ${paymentStatusWord(p.status)} · opens Payments`,
        href: focusPaymentHref(p.payment_id),
        publicId: p.reference_number ? `ref ${p.reference_number}` : null,
        score: 100,
      })),
    });
  }
  const payOrderIds = Array.from(new Set(paymentRows.map((p) => p.order_id).filter(Boolean)));
  const payUserIds = Array.from(new Set(paymentRows.map((p) => p.user_id).filter(Boolean)));
  const [payOrders, payUsers] = await Promise.all([
    payOrderIds.length
      ? settleRead<any>(admin.from('orders').select('order_id, public_id, reference_code, service_key, status').in('order_id', payOrderIds)).then((s) => logged('payment orders', s))
      : Promise.resolve<SettledRead<any>>({ rows: [], failed: false }),
    payUserIds.length
      ? settleRead<any>(admin.from('users').select('user_id, public_id, display_name, email').in('user_id', payUserIds)).then((s) => logged('payment people', s))
      : Promise.resolve<SettledRead<any>>({ rows: [], failed: false }),
  ]);

  /*
    WHICH OF THE FOUND SHOPS HAVE PAPERS WAITING — that is where a supplier row
    opens (its Verify job, at the per-shop address), and what its row says.
    A failed read is said on the row and the row opens the shop page.
  */
  const vendorIds = (vendors.rows as any[]).map((v) => v.vendor_profile_id).filter(Boolean);
  const waiting = await readWaitingApplications(admin, vendorIds);

  const vendorHits: UgatSearchHit[] = (vendors.rows as any[])
    .map((v) => vendorHit(v, waiting, scoreUgatMatch(v.business_name ?? v.business_slug ?? '', q)))
    .sort((a, b) => b.score - a.score);
  pushGroup(groups, 'Suppliers', vendorHits, vendors.failed);

  const eventHits: UgatSearchHit[] = (events.rows as any[])
    .map((e) => eventHit(e, scoreUgatMatch(e.display_name ?? e.slug ?? '', q)))
    .sort((a, b) => b.score - a.score);
  pushGroup(groups, 'Events', eventHits, events.failed);

  const userHits: UgatSearchHit[] = [
    ...(payUsers.rows as any[]).map((u) => ({ ...userHit(u, 100), sub: 'Person · logged this payment' })),
    ...(users.rows as any[])
      .filter((u) => !payUserIds.includes(u.user_id))
      .map((u) => userHit(u, scoreUgatMatch(`${u.display_name ?? ''} ${u.email ?? ''}`, q))),
  ].sort((a, b) => b.score - a.score);
  pushGroup(groups, 'People', userHits, users.failed || payUsers.failed);

  const orderHits: UgatSearchHit[] = [
    ...(payOrders.rows as any[]).map((o) => ({ ...orderHit(o, 100), sub: `Order · ${o.status ?? '—'} · this payment is on it` })),
    ...(orders.rows as any[])
      .filter((o) => !payOrderIds.includes(o.order_id))
      .map((o) => orderHit(o, scoreUgatMatch(`${o.reference_code ?? ''} ${o.service_key ?? ''}`, q))),
  ].sort((a, b) => b.score - a.score);
  pushGroup(groups, 'Orders', orderHits, orders.failed || payOrders.failed);

  const tileHits: UgatSearchHit[] = (tiles.rows as any[])
    .map((t) => ({
      id: t.canonical_service,
      type: 'taxonomy' as const,
      title: t.canonical_service,
      sub: `Taxonomy leaf · tile ${t.tile_id ?? '—'}`,
      href: ugatRecordHref({
        kind: 'taxonomy',
        tileId: t.tile_id ?? null,
        canonicalService: t.canonical_service ?? '',
      }),
      score: scoreUgatMatch(t.canonical_service ?? '', q),
    }))
    .sort((a, b) => b.score - a.score);
  pushGroup(groups, 'Taxonomy', tileHits, tiles.failed);

  /*
    WHICH CELEBRATION each found guest belongs to. A name on its own does not
    identify anybody — there is more than one Maria — and the event is
    also where the hit LANDS, so this read is what makes the destination real
    rather than a guess. Only runs when a guest actually matched.
  */
  const guestEventIds = Array.from(new Set((guests.rows as any[]).map((g) => g.event_id).filter(Boolean)));
  const guestEventById = await readGuestEvents(admin, guestEventIds);
  const guestHits: UgatSearchHit[] = (guests.rows as any[])
    .map((g) => guestHit(g, guestEventById, scoreUgatMatch(guestDisplayName(g), q)))
    .sort((a, b) => b.score - a.score);
  pushGroup(groups, 'Guests', guestHits, guests.failed);

  return groups;
}

/** A group with hits, or a failed group — never a failed read dressed as nothing. */
function pushGroup(groups: UgatSearchGroup[], category: string, hits: UgatSearchHit[], failed: boolean) {
  if (failed) groups.push({ category, hits, failed: true });
  else if (hits.length) groups.push({ category, hits });
}

type GuestEventRef = { public_id: string | null; display_name: string | null; slug: string | null };

async function readGuestEvents(admin: SupabaseClient, ids: string[]): Promise<Map<string, GuestEventRef>> {
  const out = new Map<string, GuestEventRef>();
  if (!ids.length) return out;
  const { data, error } = await admin.from('events').select('event_id, public_id, display_name, slug').in('event_id', ids);
  if (error) logQueryError('ugat search (guest events)', error);
  for (const e of data ?? []) {
    out.set(e.event_id, { public_id: e.public_id ?? null, display_name: e.display_name ?? null, slug: e.slug ?? null });
  }
  return out;
}

/** vendor_profile_id → the status of its waiting application. `null` = could not be read. */
async function readWaitingApplications(
  admin: SupabaseClient,
  vendorIds: string[],
): Promise<Map<string, 'pending_review' | 'in_review'> | null> {
  const out = new Map<string, 'pending_review' | 'in_review'>();
  if (!vendorIds.length) return out;
  const s = await settleRead<{ vendor_profile_id: string; status: string }>(
    admin
      .from('vendor_verification_applications')
      .select('vendor_profile_id, status')
      .in('vendor_profile_id', vendorIds)
      .in('status', ['pending_review', 'in_review']),
  );
  if (s.failed) {
    logQueryError('ugat search (waiting applications)', new Error('read failed'));
    return null;
  }
  for (const r of s.rows) {
    // pending_review is the Verify queue's own count — it wins over in_review.
    if (r.status === 'pending_review' || !out.has(r.vendor_profile_id)) {
      out.set(r.vendor_profile_id, r.status === 'pending_review' ? 'pending_review' : 'in_review');
    }
  }
  return out;
}

function vendorHit(v: any, waiting: Map<string, 'pending_review' | 'in_review'> | null, score: number): UgatSearchHit {
  const status = waiting?.get(v.vendor_profile_id) ?? null;
  const shop = focusVendorHref(v.vendor_profile_id, null);
  const sub =
    waiting === null
      ? 'Supplier · couldn’t read its papers · opens the shop'
      : status === 'pending_review'
        ? 'Supplier · documents waiting · opens Verify'
        : status === 'in_review'
          ? 'Supplier · papers in review · opens Verify'
          : `Supplier${v.business_slug ? ` · /${v.business_slug}` : ''}`;
  return {
    id: v.public_id ?? v.vendor_profile_id,
    type: 'vendor',
    title: v.business_name || v.public_id || 'Supplier',
    sub,
    href: focusVendorHref(v.vendor_profile_id, status),
    publicId: v.public_id ?? null,
    prepared: [
      ...(status ? [{ label: 'Open its shop page', sub: 'Plan, team and edit live there', href: shop }] : []),
      { label: 'Open its plan', sub: 'You press the real button there', href: `${shop}/plan` },
    ],
    score,
  };
}

function eventHit(e: any, score: number): UgatSearchHit {
  return {
    id: e.public_id ?? e.event_id,
    type: 'event',
    title: e.display_name || e.public_id || 'Event',
    sub: e.slug ? `Event · ${publicEventPath(e.slug)}` : 'Event',
    href: ugatRecordHref({ kind: 'event', publicId: e.public_id ?? null, slug: e.slug ?? null }),
    publicId: e.public_id ?? null,
    score,
  };
}

function userHit(u: any, score: number): UgatSearchHit {
  return {
    id: u.public_id ?? u.user_id,
    type: 'user',
    title: u.display_name || u.email || u.public_id || 'Person',
    sub: u.email ?? '',
    href: ugatRecordHref({ kind: 'user', userId: u.user_id }),
    publicId: u.public_id ?? null,
    score,
  };
}

function orderHit(o: any, score: number): UgatSearchHit {
  return {
    id: o.public_id ?? o.order_id,
    type: 'order',
    title: o.reference_code || o.public_id || 'Order',
    sub: `${o.service_key ?? '—'} · ${o.status ?? '—'}`,
    href: ugatRecordHref({ kind: 'order', publicId: o.public_id ?? null }),
    publicId: o.public_id ?? null,
    score,
  };
}

/*
  A GUEST HIT SHOWS THREE THINGS: who they are, whether they replied, and
  whose event it is. That is what identifies the record — no more.
*/
function guestHit(g: any, byEvent: Map<string, GuestEventRef>, score: number): UgatSearchHit {
  const ev = byEvent.get(g.event_id);
  const where = ev?.display_name || ev?.public_id || 'an unnamed celebration';
  return {
    id: g.public_id ?? g.guest_id,
    type: 'guest',
    title: guestDisplayName(g),
    sub: `${guestRsvpLabel(g.rsvp_status)} · ${where}`,
    href: ugatRecordHref({ kind: 'guest', eventPublicId: ev?.public_id ?? null, eventSlug: ev?.slug ?? null }),
    score,
  };
}

/**
 * A WHOLE public ID: the one table its letter belongs to, `public_id = <id>`,
 * one record. Nothing else is listed beside it. A letter Focus cannot open, or
 * no such record, returns nothing — and the box says "Nothing matches", which
 * is then true. A failed read returns a failed group.
 */
async function searchByPublicId(
  admin: SupabaseClient,
  publicId: string,
  letter: PublicIdLetter | null,
): Promise<UgatSearchGroup[]> {
  if (!letter) return [];
  const exact = (hit: UgatSearchHit | null, failed: boolean): UgatSearchGroup[] =>
    failed ? [{ category: 'Exact ID', hits: [], failed: true }] : hit ? [{ category: 'Exact ID', hits: [hit] }] : [];
  switch (letter) {
    case 'B': {
      const s = await settleRead<any>(
        admin.from('vendor_profiles').select('vendor_profile_id, public_id, business_name, business_slug').eq('public_id', publicId).limit(1),
      );
      const v = s.rows[0];
      if (!v) return exact(null, s.failed);
      const waiting = await readWaitingApplications(admin, [v.vendor_profile_id]);
      return exact({ ...vendorHit(v, waiting, 100), prepared: [] }, false);
    }
    case 'U': {
      const s = await settleRead<any>(admin.from('users').select('user_id, public_id, display_name, email').eq('public_id', publicId).limit(1));
      return exact(s.rows[0] ? { ...userHit(s.rows[0], 100), sub: 'Person' } : null, s.failed);
    }
    case 'E': {
      const s = await settleRead<any>(admin.from('events').select('event_id, public_id, display_name, slug').eq('public_id', publicId).limit(1));
      return exact(s.rows[0] ? eventHit(s.rows[0], 100) : null, s.failed);
    }
    case 'O': {
      const s = await settleRead<any>(
        admin.from('orders').select('order_id, public_id, reference_code, service_key, status').eq('public_id', publicId).limit(1),
      );
      return exact(s.rows[0] ? { ...orderHit(s.rows[0], 100), sub: `Order · ${s.rows[0].status ?? '—'}` } : null, s.failed);
    }
    case 'G': {
      const s = await settleRead<any>(
        admin
          .from('guests')
          .select('guest_id, public_id, first_name, last_name, display_name, rsvp_status, event_id')
          .eq('public_id', publicId)
          .is('deleted_at', null)
          .limit(1),
      );
      const g = s.rows[0];
      if (!g) return exact(null, s.failed);
      const byEvent = await readGuestEvents(admin, g.event_id ? [g.event_id] : []);
      return exact({ ...guestHit(g, byEvent, 100), publicId: g.public_id ?? null }, false);
    }
    default:
      return [];
  }
}

/**
 * ONE COUNTED NUMBER for a question the box understood. Each count is read from
 * the database — the Work list's own `getAdminQueueDigest` for the waiting
 * queues, one head-count each for "paid today" and "orders this week".
 * 🔑 A count that cannot be read is `null`, never 0, and the box says so.
 */
async function countFocusAnswer(admin: SupabaseClient, key: FocusAnswerKey): Promise<FocusCount[]> {
  const digestCount = async (queue: 'payments' | 'verify'): Promise<number | null> => {
    try {
      const d = await getAdminQueueDigest();
      const c = d[queue]?.count;
      return typeof c === 'number' ? c : null;
    } catch {
      return null;
    }
  };
  const head = async (build: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> => {
    try {
      return countOrNull(await build());
    } catch {
      return null;
    }
  };
  switch (key) {
    case 'paid-today': {
      const since = manilaMidnightIso(Date.now());
      const [paid, waitingCount] = await Promise.all([
        head(() => admin.from('payments').select('payment_id', { count: 'exact', head: true }).eq('status', 'matched').gte('reviewed_at', since)),
        digestCount('payments'),
      ]);
      return [
        { key, count: paid },
        { key: 'payments-waiting', count: waitingCount },
      ];
    }
    case 'orders-this-week': {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      return [{ key, count: await head(() => admin.from('orders').select('order_id', { count: 'exact', head: true }).gte('created_at', since)) }];
    }
    case 'waiting-to-verify':
      return [{ key, count: await digestCount('verify') }];
    case 'payments-waiting':
      return [{ key, count: await digestCount('payments') }];
    default:
      return [];
  }
}

/** Today's midnight in Manila, as an ISO instant. */
function manilaMidnightIso(nowMs: number): string {
  const day = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  return new Date(`${day}T00:00:00+08:00`).toISOString();
}

function channelWord(channel: string | null | undefined): string {
  const c = (channel ?? '').toLowerCase();
  if (c.includes('gcash')) return 'GCash';
  if (c.includes('maya')) return 'Maya';
  if (c.includes('bdo')) return 'BDO';
  if (c.includes('bpi')) return 'BPI';
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'A';
}

function paymentStatusWord(status: string | null | undefined): string {
  switch (status) {
    case 'pending':
      return 'waiting for you';
    case 'matched':
      return 'confirmed';
    case 'rejected':
      return 'refused';
    case 'resubmit_requested':
      return 'asked to send again';
    default:
      return status ?? '—';
  }
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
          question: 'Suppliers with an active subscription',
          table: 'billing',
          count: count ?? 0,
          summary: `${formatCount(count ?? 0)} active subscription${(count ?? 0) === 1 ? '' : 's'} — opening the Billing table.`,
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
          summary: `${formatCount(count ?? 0)} order${(count ?? 0) === 1 ? '' : 's'} awaiting payment — opening the Orders table.`,
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
          summary: `${formatCount(count ?? 0)} event${(count ?? 0) === 1 ? '' : 's'} created in the last 7 days — opening the Events table.`,
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
  { key: 'vendors-active-sub', question: 'Suppliers with an active subscription', table: 'billing' },
  { key: 'orders-pending', question: 'Orders pending payment', table: 'orders' },
  { key: 'events-this-week', question: 'Events created this week', table: 'events' },
];
