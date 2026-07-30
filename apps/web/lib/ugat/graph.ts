/**
 * lib/ugat/graph.ts — the STATIC map registry for the Ugat Console (slice 1).
 *
 * This is a faithful, code-only port of the verified corpus prototype
 * (03_Strategy/Jarvis_Console_Prototype_2026-07-04.html · 8 design laws) — the
 * platform type-level map, its type visual vocabulary, the 12-chain joints
 * audit, and the 2026-07-04/05 health findings. It carries NO live data: the
 * nine node COUNTS + the entity table rows are fetched live in lib/ugat/data.ts
 * and merged in at render time.
 *
 * WHY STATIC IS CORRECT HERE (slice-1 scope, deliberate):
 *   - The joint/edge cards document the SCHEMA (which table implements a bond,
 *     which column, which RLS guard). That is correct until the schema changes,
 *     exactly like a data-dictionary — not a live telemetry read.
 *   - The health findings are a frozen registry from the 2026-07-04/05 audit.
 *     The panel is labelled "as of the 2026-07-05 audit — live telemetry
 *     coming"; slice 2 wires the live signal.
 *   - Only the PLATFORM (type-level) scope ships in slice 1. Per-event and
 *     per-vendor row scopes are slice 2, so only the `platform` layout is here.
 *
 * The nine type nodes and their bindings mirror the schema confirmed live on
 * setnayan-prod (2026-07-04): users · events · guests · vendor_profiles ·
 * vendor_services · orders · chat_threads · billing (vendor_subscriptions +
 * token wallets) · the taxonomy tree (service_categories +
 * canonical_service_taxonomy + canonical_service_schemas + onboarding_refinements).
 */

/* ── entity types (the warm-to-cool hue family from the prototype) ── */
export type UgatEntityType =
  | 'user'
  | 'event'
  | 'guest'
  | 'vendor'
  | 'service'
  | 'order'
  | 'thread'
  | 'billing'
  | 'taxonomy';

/** Which live count key drives each type node (see lib/ugat/data.ts). */
export type UgatCountKey = UgatEntityType;

export interface UgatTypeMeta {
  /** Stable node id used across the map, cards and health/joint indices. */
  id: string;
  type: UgatEntityType;
  /** Node label on the map + card. */
  name: string;
  /** Short lifecycle/role blurb shown under the count. */
  blurb: string;
  /** Which live count in UgatCounts fills this node. */
  countKey: UgatCountKey;
  /** Lucide-ish icon key (see UGAT_ICON_PATHS). */
  icon: string;
  /** CSS var for the type hue + its tint (scoped inside the dark canvas). */
  color: string;
  colorBg: string;
  /** Verb-labelled edges to other type nodes (drawn on the platform map). */
  edges: Array<{ verb: string; to: string }>;
  /** A couple of documented columns, surfaced on the card. */
  fields: Array<{ key: string; name: string; note: string }>;
  /** Which live table this node counts / links to a real admin surface. */
  table: string;
  /** In-app cross-link target (the console navigates the admin, never replaces it). */
  href?: string;
  /** Precomputed platform-scope position in graph space. */
  x: number;
  y: number;
}

/**
 * The nine platform type nodes + their static bindings. Positions match the
 * prototype's `LAYOUTS.platform` so the ported map reads identically.
 */
export const UGAT_TYPES: UgatTypeMeta[] = [
  {
    id: 'TYPE-USERS',
    type: 'user',
    name: 'Users',
    blurb: 'accounts · hosts, co-planners, vendor members, claimed guests',
    countKey: 'user',
    icon: 'user',
    color: 'var(--ug-e-user)',
    colorBg: 'var(--ug-e-user-bg)',
    table: 'users',
    href: '/admin/users',
    x: 520,
    y: 120,
    fields: [
      { key: 'pk', name: 'user_id', note: 'S89U-…' },
      { key: '', name: 'email', note: 'unique, not null' },
    ],
    edges: [
      { verb: 'host events', to: 'TYPE-EVENTS' },
      { verb: 'are members of', to: 'TYPE-VENDORS' },
      { verb: 'claimed from', to: 'TYPE-GUESTS' },
      { verb: 'sit in', to: 'TYPE-THREADS' },
    ],
  },
  {
    id: 'TYPE-EVENTS',
    type: 'event',
    name: 'Events',
    blurb: 'weddings + the wider event market',
    countKey: 'event',
    icon: 'heart',
    color: 'var(--ug-e-event)',
    colorBg: 'var(--ug-e-event-bg)',
    table: 'events',
    href: '/admin/events',
    x: 520,
    y: 300,
    fields: [
      { key: 'pk', name: 'event_id', note: 'S89E-…' },
      { key: '', name: 'event_join_tokens.token', note: 'rotatable (regenerateInviteQr)' },
    ],
    edges: [
      { verb: 'hosted by', to: 'TYPE-USERS' },
      { verb: 'have', to: 'TYPE-GUESTS' },
      { verb: 'book', to: 'TYPE-VENDORS' },
      { verb: 'activate', to: 'TYPE-SERVICES' },
      { verb: 'generate', to: 'TYPE-ORDERS' },
      { verb: 'preferences & refinement picks', to: 'TYPE-TAXONOMY' },
    ],
  },
  {
    id: 'TYPE-GUESTS',
    type: 'guest',
    name: 'Guests',
    blurb: 'invited → RSVP’d → may claim an account',
    countKey: 'guest',
    icon: 'users',
    color: 'var(--ug-e-guest)',
    colorBg: 'var(--ug-e-guest-bg)',
    table: 'guests',
    x: 250,
    y: 420,
    fields: [
      { key: 'pk', name: 'guest_id', note: 'S89G-…' },
      { key: 'fk', name: 'event_id', note: 'not null' },
      { key: '', name: 'user_id', note: '— column does not exist' },
    ],
    edges: [
      { verb: 'belong to', to: 'TYPE-EVENTS' },
      { verb: 'may become', to: 'TYPE-USERS' },
    ],
  },
  {
    id: 'TYPE-VENDORS',
    type: 'vendor',
    name: 'Vendors',
    blurb: 'vendor orgs · free-during-launch profiles',
    countKey: 'vendor',
    icon: 'building',
    color: 'var(--ug-e-vendor)',
    colorBg: 'var(--ug-e-vendor-bg)',
    table: 'vendor_profiles',
    href: '/admin/vendors',
    x: 800,
    y: 300,
    fields: [
      { key: 'pk', name: 'vendor_profile_id', note: 'S89V-…' },
      { key: '', name: 'tier_state', note: 'denormalized ⚠' },
    ],
    edges: [
      { verb: 'staffed by', to: 'TYPE-USERS' },
      { verb: 'publish', to: 'TYPE-SERVICES' },
      { verb: 'booked at', to: 'TYPE-EVENTS' },
      { verb: 'carry', to: 'TYPE-BILLING' },
      { verb: 'answer in', to: 'TYPE-THREADS' },
    ],
  },
  {
    id: 'TYPE-SERVICES',
    type: 'service',
    name: 'Service cards',
    blurb: 'vendor cards + SETNAYAN in-app cards',
    countKey: 'service',
    icon: 'tag',
    color: 'var(--ug-e-service)',
    colorBg: 'var(--ug-e-service-bg)',
    table: 'vendor_services',
    x: 800,
    y: 470,
    fields: [
      { key: 'pk', name: 'vendor_service_id', note: 'S89S-…' },
      { key: '', name: 'category', note: 'bare TEXT 🔴 no-FK' },
    ],
    edges: [
      { verb: 'published by', to: 'TYPE-VENDORS' },
      { verb: 'activate via', to: 'TYPE-ORDERS' },
      { verb: 'tagged to one leaf', to: 'TYPE-TAXONOMY' },
    ],
  },
  {
    id: 'TYPE-ORDERS',
    type: 'order',
    name: 'Orders & activations',
    blurb: 'apply → pay → activate (eventSkuActive)',
    countKey: 'order',
    icon: 'receipt',
    color: 'var(--ug-e-order)',
    colorBg: 'var(--ug-e-order-bg)',
    table: 'orders',
    href: '/admin/payments',
    x: 560,
    y: 470,
    fields: [
      { key: 'pk', name: 'order_id', note: 'S89O-…' },
      { key: '', name: 'service_key', note: 'TEXT ⚠ no-FK' },
    ],
    edges: [
      { verb: 'activate', to: 'TYPE-SERVICES' },
      { verb: 'raised on', to: 'TYPE-EVENTS' },
    ],
  },
  {
    id: 'TYPE-THREADS',
    type: 'thread',
    name: 'Threads',
    blurb: 'couple ↔ vendor — answering is free',
    countKey: 'thread',
    icon: 'chat',
    color: 'var(--ug-e-thread)',
    colorBg: 'var(--ug-e-thread-bg)',
    table: 'chat_threads',
    x: 260,
    y: 210,
    fields: [
      { key: 'pk', name: 'thread_id', note: 'S89T-…' },
      { key: 'uq', name: '(event_id,vendor_profile_id)', note: 'UNIQUE' },
    ],
    edges: [
      { verb: 'connect', to: 'TYPE-USERS' },
      { verb: 'and', to: 'TYPE-VENDORS' },
    ],
  },
  {
    id: 'TYPE-BILLING',
    type: 'billing',
    name: 'Billing',
    blurb: 'vendor subscriptions (org) · token wallets dormant',
    countKey: 'billing',
    icon: 'wallet',
    color: 'var(--ug-e-billing)',
    colorBg: 'var(--ug-e-billing-bg)',
    table: 'vendor_subscriptions',
    href: '/admin/subscriptions',
    x: 1040,
    y: 300,
    fields: [
      { key: 'pk', name: 'purchase_id', note: 'S89B-…' },
      { key: '', name: 'sku_code', note: 'TEXT ⚠ no-FK' },
    ],
    edges: [{ verb: 'subscriptions of', to: 'TYPE-VENDORS' }],
  },
  {
    id: 'TYPE-TAXONOMY',
    type: 'taxonomy',
    name: 'Taxonomy',
    blurb: 'the shared language where preferences meet service cards',
    countKey: 'taxonomy',
    icon: 'layers',
    color: 'var(--ug-e-tax)',
    colorBg: 'var(--ug-e-tax-bg)',
    table: 'canonical_service_taxonomy',
    href: '/admin/taxonomy',
    x: 1060,
    y: 470,
    fields: [
      { key: 'pk', name: 'tile_id', note: 'real FK anchor' },
      { key: '', name: 'folder_id', note: 'DENORM ⚠ no FK' },
      { key: '', name: 'leaf_key', note: 'string, cards glue to it 🔴' },
    ],
    edges: [
      { verb: 'preferences', to: 'TYPE-EVENTS' },
      { verb: 'tags cards', to: 'TYPE-SERVICES' },
    ],
  },
];

export const UGAT_TYPE_BY_ID: Record<string, UgatTypeMeta> = Object.fromEntries(
  UGAT_TYPES.map((t) => [t.id, t]),
);

/* ── the type visual vocabulary (mirrors the prototype's TYPE map) ── */
export const UGAT_TYPE_VOCAB: Record<
  UgatEntityType,
  { label: string; icon: string; color: string; colorBg: string }
> = {
  user: { label: 'User', icon: 'user', color: 'var(--ug-e-user)', colorBg: 'var(--ug-e-user-bg)' },
  event: { label: 'Event', icon: 'heart', color: 'var(--ug-e-event)', colorBg: 'var(--ug-e-event-bg)' },
  guest: { label: 'Guest', icon: 'users', color: 'var(--ug-e-guest)', colorBg: 'var(--ug-e-guest-bg)' },
  vendor: { label: 'Vendor', icon: 'building', color: 'var(--ug-e-vendor)', colorBg: 'var(--ug-e-vendor-bg)' },
  service: { label: 'Service card', icon: 'tag', color: 'var(--ug-e-service)', colorBg: 'var(--ug-e-service-bg)' },
  order: { label: 'Order / activation', icon: 'receipt', color: 'var(--ug-e-order)', colorBg: 'var(--ug-e-order-bg)' },
  thread: { label: 'Thread', icon: 'chat', color: 'var(--ug-e-thread)', colorBg: 'var(--ug-e-thread-bg)' },
  billing: { label: 'Billing', icon: 'wallet', color: 'var(--ug-e-billing)', colorBg: 'var(--ug-e-billing-bg)' },
  taxonomy: { label: 'Taxonomy', icon: 'layers', color: 'var(--ug-e-tax)', colorBg: 'var(--ug-e-tax-bg)' },
};

/* ── inline Lucide-style icon paths (no network; SVG innerHTML) ── */
export const UGAT_ICON_PATHS: Record<string, string> = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 5a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3"/>',
  heart: '<path d="M12 21s-8-4.6-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.4-8 11-8 11z"/>',
  building:
    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M2 22h20M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  tag: '<path d="M20 12 12 20l-8-8V4h8l8 8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  receipt:
    '<path d="M5 22V4a1 1 0 0 1 1.4-.9L9 4l3-1.4L15 4l2.6-1.9A1 1 0 0 1 19 3v19l-3-1.6L13 22l-3-1.6L7 22l-2-1.4z"/><path d="M8 8h8M8 12h6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  wallet:
    '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v3"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h3v-4z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  alert:
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  link: '<path d="M9 15 15 9M10.5 6.5 12 5a4 4 0 0 1 6 6l-1.5 1.5M13.5 17.5 12 19a4 4 0 0 1-6-6l1.5-1.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="m9 12 2 2 4-4"/>',
  sparkles:
    '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  compass: '<circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  externalLink: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',
};

export function ugatIcon(name: string, cls?: string): string {
  return `<svg class="ug-ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24">${
    UGAT_ICON_PATHS[name] ?? UGAT_ICON_PATHS.tag
  }</svg>`;
}

/* ═════════════════════════════════════════════════════════════════════════
   HEALTH FINDINGS — a DATED registry, re-audited 2026-07-30.

   HISTORY / WHY THIS SHAPE: this began as a frozen verbatim copy of the
   2026-07-04/05 audit. By 2026-07-30 SIX of the nine had been fixed and the
   panel was still painting them red — a surface whose entire job is telling
   the truth was crying wolf, and two of the false alarms were "security"
   findings. Worse, three findings pointed at columns that DO NOT EXIST
   (events.qr_revoked_at, payment_inbox_messages, order_ledger_entries): the
   prose rotted independently of the verdict.

   So a finding now carries its own expiry evidence:
     · `status`           — open / mitigated / fixed ('fixed' is kept as HISTORY,
                            never deleted; a visible fixed row proves the audit
                            loop works, and deleting it invites re-discovery)
     · `verifiedAt`       — the ISO date a human last checked it
     · `verifiedEvidence` — the ref + file:line or migration that proves it
     · `guard`            — the CI tripwire that keeps it fixed, when one exists
     · `signalKey`        — a live DB signal, when the finding is machine-checkable

   Findings past UGAT_FINDING_STALE_AFTER_DAYS surface a "re-verify" chip
   rather than silently continuing to look authoritative.

   RULE, learned from F2 and re-committed by F11: never print a static price,
   fee, or rate in this registry or the console. Prices move; the panel that
   flags drift must not itself drift.
   ═════════════════════════════════════════════════════════════════════════ */
export type UgatSeverity = 'red' | 'amber';

/**
 * open      — still true, still needs work.
 * mitigated — the sharp edge is guarded, but the underlying class survives
 *             (typically as a CONVENTION rather than an enforced invariant).
 * fixed     — verified closed. Kept in the registry as history; excluded from
 *             the map overlay so it can never paint a red edge again.
 */
export type UgatFindingStatus = 'open' | 'mitigated' | 'fixed';

/** Live-signal keys (populated by getUgatFindingSignals in lib/ugat/data.ts). */
export type UgatSignalKey =
  | 'verification-fee-zero'
  | 'tier-lapsed-badges'
  | 'orphan-service-categories'
  | 'public-receipt-refs';

/** A finding unchecked for longer than this shows a "re-verify" chip. */
export const UGAT_FINDING_STALE_AFTER_DAYS = 30;

export interface UgatFinding {
  id: string;
  sev: UgatSeverity;
  title: string;
  oneliner: string;
  /** Type-node this finding rolls up to on the platform scope. */
  bindType: UgatEntityType;
  /** Optional edge (type-node pair) this finding marks. */
  bindEdge?: [string, string];
  fix: 'queued' | 'needsowner' | 'done';
  fixLabel: string;
  /** open / mitigated / fixed — see UgatFindingStatus. */
  status: UgatFindingStatus;
  /** ISO date (YYYY-MM-DD) this finding was last verified by a human. */
  verifiedAt: string;
  /** The ref + file:line or migration that proves the current verdict. */
  verifiedEvidence: string;
  /** CI tripwire keeping this fixed, when one exists. */
  guard?: string;
  /** Live DB signal key, when the finding is machine-checkable. */
  signalKey?: UgatSignalKey;
  /** 5-step binding-trace walk: [label, value]. */
  trace: Array<[string, string]>;
}

export const UGAT_FINDINGS: UgatFinding[] = [
  {
    id: 'F1',
    sev: 'red',
    title: 'Payment screenshots → PUBLIC bucket',
    oneliner:
      'CLOSED: Setnayan-checkout payment proofs route to the private bucket and display via short-lived presigned GETs.',
    bindType: 'order',
    fix: 'done',
    fixLabel: 'Fixed — verified 2026-07-30',
    status: 'fixed',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · lib/bucket-routing.ts:33-42 routes payment-screenshots/ (and legacy payment-screenshot/) to the private threadFiles bucket',
    guard: 'lib/bucket-routing.test.ts',
    trace: [
      ['Surface', 'Checkout screenshot upload · 0034 Payments & Cart'],
      ['Binding', 'lib/bucket-routing.ts bucketForPrefix() — "Privacy-critical" prefix→bucket map'],
      ['Writers', 'All three use the private prefix: inline-checkout-drawer.tsx:558 · checkout/actions.ts:555 · orders/actions.ts:177'],
      ['Display', 'Presigned short-lived GETs (admin/payments/page.tsx:165,369); SEC-1 client-ref gate closes the cross-tenant sign oracle'],
      ['Trace correction', 'The original "home row payment_inbox_messages.proof_r2_key" was FICTION — that table appears in ZERO of the 1,002 migrations'],
      ['Audit trail', 'Flagged 2026-07-04 · re-verified fixed 2026-07-30. ⚠ A DIFFERENT public-bucket path was found during this re-audit — see F10.'],
    ],
  },
  {
    id: 'F2',
    sev: 'red',
    title: 'Verification fee drift',
    oneliner:
      'CLOSED: the fee is resolved from service_catalog at runtime and fails closed to free — no price is baked into code.',
    bindType: 'vendor',
    bindEdge: ['TYPE-VENDORS', 'TYPE-BILLING'],
    fix: 'done',
    fixLabel: 'Fixed — verified 2026-07-30',
    status: 'fixed',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · lib/vendor-verification.ts:116-146 resolveApplicationFeeCentavos() reads service_catalog and fails closed to 0 (missing row → 0, inactive → 0, error → 0)',
    signalKey: 'verification-fee-zero',
    trace: [
      ['Surface', 'Vendor verification — fee line'],
      ['Binding', 'resolveApplicationFeeCentavos() · type names explicitly carry "NO price baked in"'],
      ['All four readers', 'admin/verify/page.tsx:543-548 · vendor-dashboard/verify/page.tsx:91 · verify/actions.ts:104 · shop/inline-docs-actions.ts:292'],
      ['Last writer', 'Migration 20260702000000_v2_retire_v1_skus_and_setnayan_pay.sql; even robots.ts/sitemap were scrubbed of the retired copy'],
      ['Audit trail', 'Flagged 2026-07-04 · fixed and re-verified 2026-07-30. THE LESSON: never print a static price — a live signal now guards the regression.'],
    ],
  },
  {
    id: 'F3',
    sev: 'red',
    title: 'Bundle composition triple-hardcode',
    oneliner:
      'Bundle contents are hardcoded in three separate places — already broke Papic buyers once.',
    bindType: 'service',
    bindEdge: ['TYPE-SERVICES', 'TYPE-ORDERS'],
    fix: 'done',
    fixLabel: 'Fixed — verified 2026-07-30',
    status: 'fixed',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · migration 20270511379088_bundle_components_single_source_table.sql created public.bundle_components with real FKs to BOTH catalogs; bundles_granting_sku() re-declared to SELECT from it',
    guard: 'scripts/lint-entitlement-gates.mjs + lib/entitlements.test.ts:730+',
    trace: [
      ['Surface', 'Checkout cart line item + confirmation email + fulfillment worker'],
      ['Binding', 'public.bundle_components — ONE table, real FKs to both catalogs'],
      ['App side', 'lib/entitlements.ts:340,481-501 reads DB-first via fetchBundleComponents(); the const survives only as graceful degradation'],
      ['Divergence resolved', 'The seed resolved the real PAPIC_UNLOCK split (7 vs 6 children) in the BUYER’s favour'],
      ['Audit trail', 'Regression confirmed 2026-06 · fixed and re-verified 2026-07-30. This finding earned an automated CI guard — the strongest close in the registry.'],
    ],
  },
  {
    id: 'F4',
    sev: 'red',
    title: 'Faith modal offered 18, server accepted 10',
    oneliner:
      'CLOSED — and closed the GENEROUS way: the DB was widened to all 18 rather than the modal being cut back to 10.',
    bindType: 'event',
    fix: 'done',
    fixLabel: 'Fixed — verified 2026-07-30',
    status: 'fixed',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · migration 20261120000000_faith_worldwide_expansion.sql widened the CHECK to 18; server validator derives from lib/faith-registry.ts ALLOWED_CEREMONY_VALUES',
    guard: 'lib/ceremony-validation.test.ts (pins TS↔DB-CHECK lockstep, all 18 transcribed verbatim)',
    trace: [
      ['Surface', 'Event creation → faith/tradition picker'],
      ['Resolution', 'The DB was WIDENED to 18 — the opposite direction the finding assumed. Includes the 8 worldwide-expansion faiths from PR #1275.'],
      ['Binding', 'Server validator derives from lib/faith-registry.ts; no second hand-maintained list'],
      ['Trace correction', 'The original text named events.faith — the real column is events.ceremony_type. The finding was wrong about the column it was reporting on.'],
      ['Audit trail', 'Flagged 2026-07-04 · fixed and re-verified 2026-07-30 with a lockstep test guard.'],
    ],
  },
  {
    id: 'F5',
    sev: 'amber',
    title: 'Pre-reveal vendor logo leak in thread lists',
    oneliner:
      'Hybrid anonymity should hide the vendor logo until they reply — the thread LIST view leaks it early.',
    bindType: 'thread',
    bindEdge: ['TYPE-VENDORS', 'TYPE-THREADS'],
    fix: 'done',
    fixLabel: 'Fixed — verified 2026-07-30',
    status: 'fixed',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · app/dashboard/[eventId]/messages/page.tsx:138-153 gates the list-row logo behind isVendorNameRevealed(); pre-reveal the avatar receives logoUrl=null',
    trace: [
      ['Surface', 'Couple inbox — thread LIST rows'],
      ['Binding', 'Explicit "Hybrid-anonymity logo gate — Data Flow Map audit gap #6" block; logo now masked by the SAME predicate that reveals the name'],
      ['⚠ Model changed', 'The gate is NO LONGER chat_threads.vendor_first_reply_at. It is lib/vendors.ts:669 isVendorNameRevealed → venue-exempt / verified / paid-tier / name_revealed_at (Bark-style screen names; Pro+ reveal day-1).'],
      ['Doc debt', 'Joint J5’s trap text still describes the OLD reply-gated model and needs the same correction — tracked with the joints, not here'],
      ['Audit trail', 'Flagged 2026-07-04 · fixed and re-verified 2026-07-30. Both the leak AND the finding’s own description had gone stale.'],
    ],
  },
  {
    id: 'F6',
    sev: 'amber',
    title: 'Event join QR can never be revoked',
    oneliner:
      'QR revocation fields are read by 4 surfaces but written by none — a leaked QR stays valid forever.',
    bindType: 'event',
    fix: 'done',
    fixLabel: 'Fixed — verified 2026-07-30',
    status: 'fixed',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · app/dashboard/[eventId]/guests/invite/actions.ts regenerateInviteQr() ("Data Flow Map audit gap #9") — couple-gated token ROTATION on event_join_tokens',
    trace: [
      ['Surface', 'Event QR scan-to-join · guest QR check-in · admin QR reissue · seating-chart print pack'],
      ['Binding', 'regenerateInviteQr() rotates the token (UNIQUE per event); a leaked QR is invalidated by rotation'],
      ['All four readers honour it', 'join/[eventId]/page.tsx:26-35 · actions.ts:192-200,349-357 · [slug]/invite — all check revoked_at / expires_at'],
      ['⚠ Trace correction', 'events.qr_revoked_at NEVER EXISTED — zero hits across all 1,002 migrations. Revocation always lived on event_join_tokens. The finding cited a phantom column for 25 days.'],
      ['Audit trail', 'Flagged 2026-07-04 · fixed and re-verified 2026-07-30.'],
    ],
  },
  {
    id: 'F7',
    sev: 'amber',
    title: 'tier_state copied onto vendor_profiles with no sync',
    oneliner:
      'MITIGATED, not closed: expiry stamping + a login-driven sweep guard the sharp edge, but pairing tier_state with tier_expires_at is a CONVENTION, not an enforced invariant.',
    bindType: 'billing',
    bindEdge: ['TYPE-VENDORS', 'TYPE-BILLING'],
    fix: 'queued',
    fixLabel: 'Mitigated — drift class survives',
    status: 'mitigated',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · still denormalized with no re-sync trigger, but lib/sku-activation.ts:1280-1293 stamps tier_expires_at and migration 20270720243717_custom_plan_lapse_sweep.sql added sweep_vendor_tier_expiry',
    signalKey: 'tier-lapsed-badges',
    trace: [
      ['Surface', 'Vendor profile badge (Solo/Pro/Enterprise pill)'],
      ['Still true', 'tier_state remains denormalized on vendor_profiles; NO database trigger re-syncs it'],
      ['New since 07-05', 'Pay-activation stamps tier_expires_at = now+28d; a login-driven sweep fires from vendor-dashboard/layout.tsx:250 (write guard 20270920020000)'],
      ['The residual', 'Public readers are BUILT to pair the columns (v/[slug]/page.tsx:253-259,1516-1520 · vendorHoldsActivePaidSub · enterprise-vendor-gate.ts:32) — but any NEW reader of tier_state alone regresses silently. A convention cannot be enforced by review alone.'],
      ['Audit trail', 'Flagged 2026-07-04 · re-verified 2026-07-30 as mitigated. Live signal counts vendors currently wearing a lapsed badge.'],
    ],
  },
  {
    id: 'F8',
    sev: 'amber',
    title: 'Order ledger has no HUMAN-facing view',
    oneliner:
      'CHANGED: machines read order_ledger constantly (activation idempotency), but no admin surface displays it — the BIR/accounting reader gap stands.',
    bindType: 'order',
    fix: 'needsowner',
    fixLabel: 'Needs owner decision',
    status: 'open',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · `git grep order_ledger -- apps/web/app/admin` returns ONLY action files, all writers — zero display surfaces',
    trace: [
      ['Surface', 'Admin console → Finance (still no ledger view)'],
      ['⚠ Title was wrong', 'The old title said "never read". It IS read — by MACHINES: lib/sku-activation.ts:346,470,566,644,842,1225,1455,1592 use it as activation idempotency guards.'],
      ['⚠ Table name was wrong', 'The finding said order_ledger_entries. The real table is public.order_ledger (created 20260529020000_voucher_system_day1_5_spec_alignment.sql:170).'],
      ['Still true', 'No human can read it. admin/payments/actions.ts:39 confirms every admin payment transition appends, but nothing renders it.'],
      ['Audit trail', 'Flagged 2026-07-04 · re-scoped 2026-07-30. OWNER DECISION: build a minimal admin Finance ledger view now, or defer the reader to the 0026 BIR iteration?'],
    ],
  },
  {
    id: 'F9',
    sev: 'red',
    title: 'Service cards string-glued to the taxonomy (no FK)',
    oneliner:
      'vendor_services.category is a bare TEXT leaf key — a leaf rename silently orphans every card tagged with the old string.',
    bindType: 'service',
    bindEdge: ['TYPE-SERVICES', 'TYPE-TAXONOMY'],
    fix: 'needsowner',
    fixLabel: 'Needs owner decision',
    status: 'open',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · still no FK: vendor_services.category is TEXT (20261126000000_schedule_pools.sql:126 — "TEXT, taxonomy-keyed — never an enum"); 20270426250948:46 mirrors it for coverages',
    signalKey: 'orphan-service-categories',
    trace: [
      ['Surface', 'Vendor service-card builder · marketplace category filters · leaf-match engine'],
      ['Binding', 'vendor_services.category = bare TEXT — NO FK to any taxonomy table. Unchanged.'],
      ['Severity honestly LOWER than written', 'The writer validates app-side against lib/vendor-category-taxonomy.ts and throws "Unknown service category" (vendor-dashboard/services/actions.ts:108-120).'],
      ['A rename does NOT orphan', 'The admin taxonomy rename action changes label_en only, keeping the key stable (admin/taxonomy/actions.ts:242-264). Orphaning now requires a key-space change in code or migration.'],
      ['⚠ Description correction', 'category holds the legacy VendorCategory enum key mapped to tiles via tilesForVendorCategory — NOT a raw canonical_service_taxonomy.leaf_key as originally written.'],
      ['Audit trail', 'Flagged 2026-07-04 · re-verified STILL TRUE 2026-07-30. OWNER DECISION: commission a real lookup/FK, or accept app-side validation permanently? Live signal counts actual orphans.'],
    ],
  },
  {
    id: 'F10',
    sev: 'red',
    title: 'Off-platform receipt screenshots → PUBLIC bucket (NEW)',
    oneliner:
      'Couples’ bank-transfer receipts for off-platform vendor payments upload to the public media bucket BY DESIGN — same PII class F1 was raised for.',
    bindType: 'order',
    fix: 'needsowner',
    fixLabel: 'Needs owner decision · routed to security',
    status: 'open',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · vendor-itemization-card.tsx:670-679 uploads with bucket="media", pathPrefix="events/{eventId}/payment-proof"; setnayan-media is THE publicly-served bucket (booth-studio.ts:267 PUBLIC_MEDIA_BUCKET, served unsigned)',
    signalKey: 'public-receipt-refs',
    trace: [
      ['Surface', 'Couple budget → log a payment to an off-platform vendor → "Attach receipt (optional)"'],
      ['Binding', 'FileUpload bucket="media" → the one publicly-served R2 bucket, no signature required to fetch'],
      ['Home row', 'event_vendor_payments.proof_r2_key (column from 20260820000000_vendor_payment_methods.sql)'],
      ['Why it looks deliberate', 'The code comment frames these as "the host’s own record, not a Setnayan-verified proof" — but they are bank-transfer screenshots. Only protection is an unguessable UUID key.'],
      ['Audit trail', 'Found 2026-07-30 during the F1 re-audit. NOT the original F1 (that path is closed). OWNER DECISION: move to the private bucket + presigned display, or accept a documented posture. Existing objects are ALREADY public and need their own migration.'],
    ],
  },
  {
    id: 'F11',
    sev: 'amber',
    title: 'This console committed the F2 failure class itself',
    oneliner:
      'The Ugat billing card hardcoded a token rate — the exact "static price in code" mistake F2 exists to flag. Fixed in the same PR that found it.',
    bindType: 'billing',
    fix: 'done',
    fixLabel: 'Fixed — verified 2026-07-30',
    status: 'fixed',
    verifiedAt: '2026-07-30',
    verifiedEvidence:
      'origin/main@39f1ce0c3 · ugat-console.tsx hardcoded a per-token rate; the locked price moved (20270728100000_vendor_token_pack_reprice_200.sql) and the pack SALE was retired outright (20270910266901_retire_vendor_token_packs.sql, owner 2026-07-21)',
    trace: [
      ['Surface', 'Ugat console → TYPE-BILLING node card'],
      ['The irony', 'A panel whose job is flagging drift was itself printing a stale price. F2’s lesson, violated by F2’s own reporting surface.'],
      ['Fix', 'DELETE the rate row entirely — never print a static price. Relabel the tokens figure as dormant (sale retired 2026-07-21).'],
      ['Related stale copy', 'TYPE-BILLING blurb said "token packs (per member)"; TYPE-THREADS said "token-gated to answer" — answering was made free by 20270909586177.'],
      ['Audit trail', 'Found and fixed 2026-07-30 in the re-audit PR.'],
    ],
  },
];

export const UGAT_FINDINGS_BY_ID: Record<string, UgatFinding> = Object.fromEntries(
  UGAT_FINDINGS.map((f) => [f.id, f]),
);

/** Findings that roll up onto a given platform type node (ALL, incl. fixed history). */
export function findingsForType(type: UgatEntityType): UgatFinding[] {
  return UGAT_FINDINGS.filter((f) => f.bindType === type);
}

/**
 * Findings that still need attention — everything except `fixed`.
 *
 * The map overlay MUST use this rather than UGAT_FINDINGS, otherwise a closed
 * finding keeps painting a red edge forever. That is precisely the failure this
 * registry was rewritten to end: on 2026-07-30 six of nine findings were fixed
 * and the console was still showing all nine as live.
 */
export function openUgatFindings(): UgatFinding[] {
  return UGAT_FINDINGS.filter((f) => f.status !== 'fixed');
}

/**
 * Whole days since a finding was last verified.
 *
 * `nowMs` is injected, never read from Date.now() inside this module: the value
 * is computed once on the server and passed into the client console, so the
 * rendered staleness cannot hydration-mismatch.
 */
export function findingAgeDays(f: UgatFinding, nowMs: number): number {
  const verified = Date.parse(`${f.verifiedAt}T00:00:00Z`);
  if (Number.isNaN(verified)) return 0;
  return Math.max(0, Math.floor((nowMs - verified) / 86_400_000));
}

/**
 * True when an unresolved finding has gone unchecked past the staleness window.
 * Fixed findings are never stale — they are history, not a standing claim.
 */
export function isFindingStale(f: UgatFinding, nowMs: number): boolean {
  if (f.status === 'fixed') return false;
  return findingAgeDays(f, nowMs) > UGAT_FINDING_STALE_AFTER_DAYS;
}

/**
 * Canonical key for an unordered type-node pair.
 *
 * Exported because the derived-edges union and the console both need to dedupe
 * on the same key; an inline re-implementation of the sort-join is how the two
 * halves of an edge silently stop matching.
 */
export function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** The OPEN finding that marks a given type-node edge, if any. */
export function findingForEdge(a: string, b: string): UgatFinding | undefined {
  return openUgatFindings().find(
    (f) => f.bindEdge && edgeKey(...f.bindEdge) === edgeKey(a, b),
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   JOINTS — the 12-chain audit (2026-07-04, verbatim). On the platform map a
   connection between two types is almost always ITSELF a table (a joint) with
   its own columns, writers and RLS guard. Static schema documentation: correct
   until the schema changes. Each joint is wired to a type-node edge pair.
   ═════════════════════════════════════════════════════════════════════════ */
export interface UgatJoint {
  id: string;
  chain: number;
  /** Type-node edge this joint documents (order-independent). */
  pair: [string, string];
  title: string;
  /** The implementing table, or null for a direct FK. */
  joint: string | null;
  cardinality: string;
  implementedBy: string;
  writtenBy: string;
  guardedBy: string;
  traps: string;
  /** Cross-reference to a health finding, if this joint has one. */
  healthId?: string;
}

export const UGAT_JOINTS: UgatJoint[] = [
  {
    id: 'J1',
    chain: 1,
    pair: ['TYPE-USERS', 'TYPE-EVENTS'],
    title: 'User ↔ Event',
    joint: 'event_members',
    cardinality: 'Many-to-many · UNIQUE(event_id, user_id) — one membership row per (person, event)',
    implementedBy:
      'event_members — member_type ∈ couple / guest / vendor / coordinator. Its guest_id column is the durable user↔guest bond.',
    writtenBy: 'Event-creation spine · joinEventAction · acceptHostInvite · login guest-link',
    guardedBy: 'current_event_ids() — the RLS spine most event-scoped policies ride',
    traps: 'vendor_id column is dead — no FK, never wired. Don’t read it expecting a live vendor bond.',
  },
  {
    id: 'J2',
    chain: 2,
    pair: ['TYPE-USERS', 'TYPE-GUESTS'],
    title: 'Guest → User (claim)',
    joint: 'guest_claims',
    cardinality: 'One-to-one, eventually · UNIQUE(event, claimer) — one claim attempt per person per event',
    implementedBy:
      'guests has NO user_id column. Chain: guest_claims UNIQUE(event, claimer) — name-as-answer-key + email OTP → approval stamps event_members.guest_id.',
    writtenBy: 'Claim-flow submit handler (name match + OTP) → approval step writes event_members.guest_id',
    guardedBy: 'RLS: claimer must match the authenticated auth.uid(); approval gated to the claim owner or an admin',
    traps: 'The bond is NOT on guests itself — the durable link lives on event_members.guest_id, one hop away.',
  },
  {
    id: 'J3',
    chain: 3,
    pair: ['TYPE-EVENTS', 'TYPE-GUESTS'],
    title: 'Guest → Event',
    joint: null,
    cardinality: 'One-to-many · direct FK, no joint table needed',
    implementedBy:
      'Direct FK guests.event_id + personal qr_token per guest. Plus-one is a self-referencing guest row. households groups guests with ON DELETE SET NULL.',
    writtenBy: 'Guest-list add/import flows · CSV bulk import · plus-one add action',
    guardedBy: 'current_event_ids() — same RLS spine as chain 1',
    traps: 'Not every edge hides a table — this one is a plain FK. Don’t assume every line on this map is a joint.',
  },
  {
    id: 'J4',
    chain: 4,
    pair: ['TYPE-USERS', 'TYPE-VENDORS'],
    title: 'User ↔ Vendor org',
    joint: 'vendor_team_members',
    cardinality: 'Many-to-many · UNIQUE(org_id, user_id) — one membership row per (person, org)',
    implementedBy:
      'vendor_profiles.user_id is the founder FK (nullable — admin can pre-stage an unclaimed shop). Team roster is the joint: vendor_team_members, roles admin / agent / viewer.',
    writtenBy: 'Team invite accept flow · founder auto-insert on vendor registration',
    guardedBy: 'current_vendor_ids() — the vendor-side RLS spine',
    traps: 'A DB trigger enforces an ≥1-admin floor — you cannot remove the last admin row without first promoting someone else.',
  },
  {
    id: 'J5',
    chain: 5,
    pair: ['TYPE-VENDORS', 'TYPE-THREADS'],
    title: 'Event ↔ Vendor (conversation)',
    joint: 'chat_threads',
    cardinality: 'One-to-one per pair · UNIQUE(event_id, vendor_profile_id) — exactly one thread, ever',
    implementedBy:
      'chat_threads UNIQUE(event, vendor). There is NO participants table — membership is derived in RLS policy, not stored as rows.',
    writtenBy: 'First-message-send handler (creates the thread row on first contact, either direction)',
    guardedBy:
      'RLS derives membership from event_members + vendor_team_members — current_thread_ids() is a dead stub: granted, never used.',
    traps: 'Anonymity masks the vendor name/logo until they reply (vendor_first_reply_at gate) — but the thread LIST view leaks the logo early. See F5.',
    healthId: 'F5',
  },
  {
    id: 'J7',
    chain: 7,
    pair: ['TYPE-EVENTS', 'TYPE-VENDORS'],
    title: 'Event ↔ Vendor (booking)',
    joint: 'event_vendors',
    cardinality: 'Many-to-many · one booking row per (event, vendor-or-offplatform)',
    implementedBy:
      'event_vendors — 🔴 TRAP: its PK column is literally NAMED vendor_id but it is actually the BOOKING id, not a vendor reference.',
    writtenBy: 'Vendor-add flow on the couple dashboard · CSV import · admin-assisted booking entry',
    guardedBy: 'current_event_ids() for the couple side; vendor side reads via current_vendor_ids() when vendor_org_id is set',
    traps: 'Org FK (vendor_org_id) is SET-NULL nullable — a booking can point at an off-platform vendor with no org row. category_key DOES have a real FK.',
  },
  {
    id: 'J8',
    chain: 8,
    pair: ['TYPE-SERVICES', 'TYPE-TAXONOMY'],
    title: 'Service card → Taxonomy',
    joint: 'vendor_service_attributes',
    cardinality: 'One-to-one per (org, canonical_service) — NOT keyed to the individual service row',
    implementedBy:
      'vendor_services.category is a bare TEXT leaf key, 🔴 NO FK — string-glued to the taxonomy. Refinement answers live in a SEPARATE joint, vendor_service_attributes, keyed by (org, canonical_service). schema_version_at_fill is the never-orphan version stamp.',
    writtenBy: 'Service-card builder → refinement questionnaire submit',
    guardedBy: 'current_vendor_ids() — org must own the service card being edited',
    traps: 'Card↔attributes join exists ONLY in application code — no DB-level FK ties a service row to its attribute row. A leaf rename can silently orphan the join.',
    healthId: 'F9',
  },
  {
    id: 'J9',
    chain: 9,
    pair: ['TYPE-SERVICES', 'TYPE-ORDERS'],
    title: 'Order → Event feature (activation)',
    joint: 'event_software_activations_v2',
    cardinality: 'One-to-one per (event, service_code) · UNIQUE — a feature activates once per event',
    implementedBy:
      'Chain: orders (user FK; event FK nullable; ⚠ service_key TEXT no-FK) → status=paid → joint event_software_activations_v2 UNIQUE(event, service_code) → eventSkuActive() gate → dashboard auto-show.',
    writtenBy: 'Payment-confirmed webhook / admin reconciliation approve action',
    guardedBy: 'eventSkuActive(event_id, service_code) read-gate — every dashboard surface calls this before rendering a paid feature',
    traps: '⚠ Duplicated copy events.setnayan_ai_active* is app-synced, not DB-synced — same drift risk as chain 10’s tier_state.',
  },
  {
    id: 'J10',
    chain: 10,
    pair: ['TYPE-VENDORS', 'TYPE-BILLING'],
    title: 'Vendor → Subscription',
    joint: 'vendor_subscriptions',
    cardinality: 'One-to-one (current) · one active subscription row per org',
    implementedBy: 'vendor_subscriptions — ⚠ sku_code is TEXT with no FK to the billing catalog.',
    writtenBy: 'Subscription checkout confirm · admin comp-grant · renewal (after()/waitUntil)',
    guardedBy: 'current_vendor_ids() — org must own the subscription being read/modified',
    traps: '⚠ tier_state is DENORMALIZED onto vendor_profiles at write-time, app-synced, with NO DB trigger to re-copy on tier change. See F7.',
    healthId: 'F7',
  },
  {
    id: 'J13',
    chain: 11,
    pair: ['TYPE-EVENTS', 'TYPE-TAXONOMY'],
    title: 'Event → Taxonomy (preferences)',
    joint: 'onboarding_refinements',
    cardinality: 'Many per event — one row per refinement pick made in onboarding',
    implementedBy:
      'onboarding_refinements.tile_id IS a real FK into canonical_service_taxonomy — the one safe anchor in the taxonomy cluster. Preference picks land here and drive the leaf-match engine.',
    writtenBy: 'Couple onboarding quiz · preference picker on the dashboard',
    guardedBy: 'current_event_ids() — the event-scoped RLS spine',
    traps: 'The two halves of matching have UNEQUAL integrity: couple picks are FK-anchored (this joint); vendor cards are string-glued (chain 8 · F9).',
  },
];

const UGAT_JOINT_PAIR_INDEX: Record<string, UgatJoint[]> = {};
for (const j of UGAT_JOINTS) {
  const k = edgeKey(...j.pair);
  (UGAT_JOINT_PAIR_INDEX[k] ??= []).push(j);
}

/** All joints that document a given type-node edge (order-independent). */
export function jointsForEdge(a: string, b: string): UgatJoint[] {
  return UGAT_JOINT_PAIR_INDEX[edgeKey(a, b)] ?? [];
}

/* ═════════════════════════════════════════════════════════════════════════
   PLATFORM EDGES — the lines drawn on the type-level map. Derived from each
   type node's `edges`, de-duped on the unordered endpoint pair (so a reciprocal
   verb doesn't draw twice), keeping the first verb seen. Pure — no DOM.
   ═════════════════════════════════════════════════════════════════════════ */
export interface UgatPlatformEdge {
  from: string;
  to: string;
  verb: string;
}

export function platformEdges(): UgatPlatformEdge[] {
  const present = new Set(UGAT_TYPES.map((t) => t.id));
  const seen = new Set<string>();
  const out: UgatPlatformEdge[] = [];
  for (const node of UGAT_TYPES) {
    for (const eg of node.edges) {
      if (!present.has(eg.to)) continue;
      const k = edgeKey(node.id, eg.to);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ from: node.id, to: eg.to, verb: eg.verb });
    }
  }
  return out;
}
