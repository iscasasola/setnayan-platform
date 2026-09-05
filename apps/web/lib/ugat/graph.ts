import type { UgatSchemaClaim } from './schema-claims';

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
  | 'taxonomy'
  | 'community'
  | 'papic'
  | 'person'
  | 'package'
  | 'proposal'
  | 'contract'
  | 'availability'
  | 'geography'
  | 'seatplan'
  | 'runofshow'
  | 'livestudio'
  | 'render'
  | 'gallery'
  | 'signoff'
  | 'colourgrant';

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
  {
    // Samahan (Tagalog: an association / a group one belongs to). Scoped to
    // COMMUNITIES only — deliberately not "People & Samahan". The person spine
    // (people / person_connections / dependents) is a separate concern behind a
    // counsel gate; folding both under one node would give the map two
    // contradictory ideas of what a "person" is.
    id: 'TYPE-SAMAHAN',
    type: 'community',
    name: 'Samahan',
    blurb: 'private groups — barkada · parish · clan · org',
    countKey: 'community',
    icon: 'group',
    color: 'var(--ug-e-community)',
    colorBg: 'var(--ug-e-community-bg)',
    table: 'communities',
    x: 250,
    y: 60,
    fields: [
      { key: 'pk', name: 'community_id', note: 'UUID · public_id S89C-…' },
      { key: '', name: 'kind', note: 'barkada · parish · clan · org · other' },
      { key: '', name: 'archived', note: 'soft-retire, never deleted' },
    ],
    edges: [
      { verb: 'members', to: 'TYPE-USERS' },
      { verb: 'owns', to: 'TYPE-EVENTS' },
    ],
  },
  {
    /**
     * PAPIC — the candid-capture subsystem. 17 tables, the largest single
     * cluster on the platform and the first concept promoted off the
     * map-backlog (2026-07-30).
     *
     * ⚠ NAMING LOCK SUPERSEDED. This said "the two product types are Papic
     * Pool and Papic One". Owner 2026-08-11, restated 2026-08-26: *"we do not
     * have papic one or papic pool. no 2 ways of papic service. just 1."*
     * There is ONE product, Papic. Giving one camera its own shots is a
     * FEATURE of it — a floor on what that camera can spend, never a ceiling,
     * and never a second thing to buy.
     * Never print "Papic Guest" as a product name. Several TABLES still carry
     * the older `papic_guest_*` naming (`papic_guest_captures`,
     * `papic_guest_orders`) — table names are facts and are cited as-is, but
     * they are not product names.
     *
     * `paparazzi_seats` is the hub (6 inbound FKs), not `papic_photos`: a seat
     * is the unit of entitlement, and captures hang off it.
     */
    id: 'TYPE-PAPIC',
    type: 'papic',
    name: 'Papic',
    blurb: 'candid capture — seats, captures, missions',
    countKey: 'papic',
    icon: 'camera',
    color: 'var(--ug-e-papic)',
    colorBg: 'var(--ug-e-papic-bg)',
    table: 'paparazzi_seats',
    x: 420,
    y: 620,
    fields: [
      { key: 'pk', name: 'paparazzi_seats.seat_id', note: 'the unit of entitlement' },
      { key: 'fk', name: 'event_id', note: 'CASCADE — seats die with the event' },
      { key: '', name: 'papic_photos', note: '39 cols · the capture table' },
    ],
    edges: [
      { verb: 'scoped to', to: 'TYPE-EVENTS' },
      { verb: 'claimed by', to: 'TYPE-USERS' },
      { verb: 'captures', to: 'TYPE-GUESTS' },
      { verb: 'paid via', to: 'TYPE-ORDERS' },
      { verb: 'missions for', to: 'TYPE-VENDORS' },
    ],
  },
  {
    /**
     * PERSON — the person spine: who someone IS, independent of any one event.
     *
     * THREE backlog rows collapse here: `people` (the node), `person_*`
     * (connections + stewardships + story items) and `dependents`. Splitting
     * them would put three nodes on the map for one concept and start the slide
     * from a concept map toward an ERD.
     *
     * ⚠ `households` was assumed to belong here and DID NOT. Its only foreign
     * key was `event_id → events` — an event-scoped guest grouping, not a
     * person-spine concept. Caught only by reading the live FKs, which is the
     * whole argument for claim-checking a map instead of describing one. It
     * then turned out to hold no rows, no product reader and no writer in the
     * eleven weeks since it shipped. DROPPED 2026-08-01 (owner: "just remove
     * it") once its one real dependency — a canary in
     * `event-member-self-join.db.test.ts` — was moved onto `guests`, which
     * carries actual names and so asserts more than the empty table did.
     *
     * ⚠ EMPTY AND COUNSEL-GATED, DELIBERATELY MAPPED ANYWAY. `people` holds
     * zero rows today and the family-tree work is waiting on legal review. It
     * is on the map because the map documents CONCEPTS, and a concept that
     * exists in the schema and in the build plan is real whether or not a row
     * has landed. The count will read 0 until it doesn't — which is the honest
     * rendering, and the same reason an unprobed edge stays unlit rather than
     * green.
     *
     * ⚠ NOT THE SAME AS A GUEST. A guest is event-scoped and may never have an
     * account; a person is the durable identity a guest can be resolved TO. The
     * bond between them is a claim (joint J2), and a claim is `pending_review`
     * until a host confirms it — the guest is provisional until then. Reading
     * `people` as "guests with accounts" inverts that.
     */
    id: 'TYPE-PERSON',
    type: 'person',
    name: 'Person',
    blurb: 'the durable identity — connections · households · dependents',
    countKey: 'person',
    icon: 'user',
    color: 'var(--ug-e-person)',
    colorBg: 'var(--ug-e-person-bg)',
    table: 'people',
    x: 60,
    y: 260,
    fields: [
      { key: 'pk', name: 'person_id', note: 'the durable identity, not event-scoped' },
      { key: '', name: 'claimed_by_user_id', note: 'null until an account claims this person' },
      { key: '', name: 'in_memoriam', note: 'memorial flag — a person outlives their account' },
    ],
    edges: [
      { verb: 'is', to: 'TYPE-USERS' },
      { verb: 'resolves', to: 'TYPE-GUESTS' },
    ],
  },
  {
    /**
     * PACKAGE — what a vendor SELLS, authored once and offered many times.
     * Owned by the vendor, not by any event.
     *
     * The cluster branches: `vendor_package_items` hang off a package, and
     * `vendor_package_item_options` hang off an item — and an item can itself
     * hang off an OPTION (`parent_option_id`). So the shape is a tree, not a
     * flat list, which is how "pick a lunch, then pick its drink" is modelled.
     */
    id: 'TYPE-PACKAGE',
    type: 'package',
    name: 'Package',
    blurb: 'what a vendor sells — items branching into options',
    countKey: 'package',
    icon: 'layers',
    color: 'var(--ug-e-deal)',
    colorBg: 'var(--ug-e-deal-bg)',
    table: 'vendor_packages',
    x: 1040,
    y: 620,
    fields: [
      { key: 'pk', name: 'package_id', note: 'authored by the vendor, reused across events' },
      { key: 'fk', name: 'vendor_profile_id', note: 'the only owner — a package is never event-scoped' },
    ],
    edges: [{ verb: 'sold by', to: 'TYPE-VENDORS' }],
  },
  {
    /**
     * PROPOSAL — what a vendor offers ONE couple for ONE event.
     *
     * ⚠ A PROPOSAL NEED NOT COME FROM A PACKAGE. It reaches one only through
     * `template_id → vendor_proposal_templates → default_package_id`, and
     * `template_id` is NULLABLE. A freehand proposal is a first-class case, so
     * any code that assumes "every proposal has a package behind it" is wrong.
     */
    id: 'TYPE-PROPOSAL',
    type: 'proposal',
    name: 'Proposal',
    blurb: 'what a vendor offers one couple — amendable after sending',
    countKey: 'proposal',
    icon: 'tag',
    color: 'var(--ug-e-deal)',
    colorBg: 'var(--ug-e-deal-bg)',
    table: 'vendor_proposals',
    x: 860,
    y: 700,
    fields: [
      { key: 'pk', name: 'proposal_id', note: 'one vendor offering one event' },
      { key: 'fk', name: 'template_id', note: 'NULLABLE — the only path to a package, and it is optional' },
      { key: '', name: 'status', note: 'the offer lifecycle' },
    ],
    edges: [
      { verb: 'offers', to: 'TYPE-EVENTS' },
      { verb: 'drawn from', to: 'TYPE-PACKAGE' },
    ],
  },
  {
    /**
     * CONTRACT — what both sides sign.
     *
     * 🚨 THE DEAL CHAIN BREAKS HERE, and the owner has called it a defect to fix
     * (2026-08-01) rather than a quirk to live with. A contract carries
     * `event_vendor_id` (the booking) and `order_id` (the money) and has NO
     * COLUMN referencing the proposal it came from — see J27's `no_column`
     * claim, which is asserted so this annotation FAILS the day the link lands.
     *
     * The consequence is not academic: proposals are amendable after sending
     * (`proposal_amendments`, with its own line items), so "what did they
     * actually agree to?" cannot be answered from a signed contract row. The
     * order amount is the only surviving trace, and it cannot distinguish a
     * package from an amended one that happens to total the same.
     */
    id: 'TYPE-CONTRACT',
    type: 'contract',
    name: 'Contract',
    blurb: 'what both sides sign — bound to the booking, not to the offer',
    countKey: 'contract',
    icon: 'receipt',
    color: 'var(--ug-e-deal)',
    colorBg: 'var(--ug-e-deal-bg)',
    table: 'vendor_contracts',
    x: 660,
    y: 760,
    fields: [
      { key: 'pk', name: 'contract_id', note: 'the signed artefact' },
      { key: 'fk', name: 'event_vendor_id', note: 'the booking it binds' },
      { key: 'fk', name: 'order_id', note: 'the money — nullable' },
    ],
    edges: [
      { verb: 'binds', to: 'TYPE-VENDORS' },
      { verb: 'settles', to: 'TYPE-ORDERS' },
    ],
  },
  {
    /**
     * VENDOR AVAILABILITY — who gets a finite day.
     *
     * The only place in the schema deciding a RIVALROUS resource. Everything
     * else under VENDOR describes what a vendor IS or SELLS and reads
     * concurrently without conflict; this decides who gets the date, and it
     * owns concurrency machinery that exists nowhere else — deterministic
     * `FOR UPDATE` ordering against deadlock, a partial unique index for
     * idempotent re-acquire, and a capacity number.
     *
     * ⚠ SCOPED BY CONCEPT, NOT BY PREFIX. `vendor_calendar_blocks` and
     * `vendor_calendar_day_states` do NOT match `vendor_schedule_%` and are the
     * gates deciding whether a date is bookable at all. A prefix-scoped node
     * would ship with its two most decision-bearing tables missing — which is
     * why this node had to be drawn deliberately rather than derived.
     *
     * ⚠ UNPROVEN, NOT BUILT. 1 booking row against 45 `event_vendors`, and four
     * of the six tables at zero. The mechanism is effectively unexercised in
     * production, so its behaviour under contention has never actually happened.
     */
    id: 'TYPE-AVAILABILITY',
    type: 'availability',
    name: 'Availability',
    blurb: 'who gets a finite day — pools, blocks, day states',
    countKey: 'availability',
    icon: 'link',
    color: 'var(--ug-e-avail)',
    colorBg: 'var(--ug-e-avail-bg)',
    table: 'vendor_schedule_pools',
    x: 1040,
    y: 140,
    fields: [
      { key: 'pk', name: 'pool_id', note: 'the bookable unit — a vendor may run several' },
      { key: '', name: 'daily_booking_capacity', note: 'checked inside acquire_schedule_pools(), not by a constraint' },
      { key: '', name: 'is_active', note: 'the closed switch — see J29 for what it did NOT do until 2026-08-01' },
    ],
    edges: [
      { verb: 'held by', to: 'TYPE-VENDORS' },
      { verb: 'books', to: 'TYPE-EVENTS' },
    ],
  },
  {
    /**
     * GEOGRAPHY — the shared region vocabulary.
     *
     * Not a vendor concept and not an event concept: ~11 tables across four
     * different existing nodes join to it BY TEXT, so filing it under any one
     * of them makes a shared vocabulary that node's private property and hides
     * the drift from everyone else.
     *
     * 🚨 EXACTLY ONE FOREIGN KEY IN THE ENTIRE DATABASE POINTS AT `regions`
     * (`wedding_destinations.region_code`, asserted in J31). Every other
     * reference — `events.region`, `vendor_profiles.hq_region`, the market and
     * pricing bands — is unenforced text. This is the tiles-vs-categories shape
     * again, one join further out.
     *
     * ⚠ AND IT HAS ALREADY BITTEN ONCE, in a way worth remembering rather than
     * fearing: the retired `token_burn_bands` table carried long-form slugs
     * (`central_luzon`, `davao_region`) against a `regions` table using short
     * form (`c-luzon`, `davao`). It mis-keyed six regions and UNDERCHARGED
     * them. It was fixed on 2026-07-01 by collapsing onto `regions.burn_band`,
     * and the dead table still sits in prod holding 10 of 20 rows that match no
     * real region. Nothing reads it — verified — so the drift is inert, but it
     * is a loaded gun for anyone who greps the schema and trusts what they find.
     */
    id: 'TYPE-GEOGRAPHY',
    type: 'geography',
    name: 'Geography',
    blurb: 'the shared region vocabulary — joined by text almost everywhere',
    countKey: 'geography',
    icon: 'globe',
    color: 'var(--ug-e-geo)',
    colorBg: 'var(--ug-e-geo-bg)',
    table: 'regions',
    x: 300,
    y: 760,
    fields: [
      { key: 'pk', name: 'slug', note: 'SHORT form (c-luzon, davao, car) — the only correct spelling' },
      { key: '', name: 'burn_band', note: 'the single source for region token pricing since 2026-07-01' },
    ],
    edges: [{ verb: 'locates', to: 'TYPE-EVENTS' }],
  },
  {
    /**
     * SEAT PLAN — the WHERE. Tables, chairs, who sits in them, and the room
     * they sit in.
     *
     * Geometry is NOT split from placement, and both investigations reached
     * that independently: one file writes both, one RPC reads both, and
     * auto-seat consumes the floor plan's priority order alongside the table
     * and assignment rows. `event_floor_*` alone is not a concept anyone names.
     *
     * 🚨 GUEST READS DO NOT GO THROUGH RLS — the single most important thing on
     * this node. `event_tables` and `event_seat_assignments` grant anon nothing
     * (five policies each, all `authenticated`), yet /find-my-table, /seat and
     * /hub correctly show a guest their table. They read through anon-executable
     * SECURITY DEFINER RPCs (`public_seat_lookup`, `public_venue_scene`). An
     * RLS-only audit concludes "guests cannot see their seat" — FALSE — and
     * misses that the real exposure surface is the function body, not the policy.
     * That discovery is what triggered the 2026-08-01 anon-RPC audit.
     *
     * ⚠ THE PUBLISH GATE LIVES ONLY IN FUNCTION BODIES. `event_floor_plan
     * .published_at` and `event_walkthrough_zones.published_at` are enforced
     * inside the RPCs; no policy references either. A new reader that forgets
     * the check fails OPEN and serves an unpublished seat plan.
     *
     * ⚠ `seating_editor_locks` LOOKS DEAD AND IS FULLY LIVE. A grep for the
     * table name finds only tests — all access runs through four SECURITY
     * DEFINER RPCs (acquire / refresh / release / assert), driven by a 30-second
     * heartbeat and asserted before every write. It was nearly deleted on the
     * strength of that grep.
     */
    id: 'TYPE-SEATPLAN',
    type: 'seatplan',
    name: 'Seat Plan',
    blurb: 'the WHERE — tables, chairs, assignments, the room',
    countKey: 'seatplan',
    icon: 'layers',
    color: 'var(--ug-e-dayof)',
    colorBg: 'var(--ug-e-dayof-bg)',
    table: 'event_tables',
    x: 60,
    y: 520,
    fields: [
      { key: 'pk', name: 'table_id', note: 'one table in the room' },
      { key: '', name: 'link_group_id', note: 'FK-SHAPED BUT NOT AN FK (verified, any schema) — groups tables into one serpentine run' },
      { key: 'fk', name: 'walkthrough_zone_id', note: 'nullable, SET NULL — the one non-destructive outbound link' },
    ],
    edges: [
      { verb: 'seats', to: 'TYPE-GUESTS' },
      { verb: 'lays out', to: 'TYPE-EVENTS' },
    ],
  },
  {
    /**
     * RUN OF SHOW — the WHEN. A machine, not a field on EVENT: two enums, a
     * SECURITY DEFINER state machine (`advance_schedule_block`), a DB-enforced
     * single-live-block invariant, its own realtime channel, ~25 importing
     * modules.
     *
     * It is the four-way intersection where COUPLE, VENDORS, coordinator and
     * GUESTS meet on one row — six RLS policies, roughly one per role. That is
     * precisely the cross-role JOIN surface that already caused a live prod
     * outage in this same day-of area (the tiles-vs-categories desk lockout).
     *
     * ⚠ THE PREFIX UNDER-CAPTURES THE CONCEPT. `vendor_block_scripts.block_id`
     * CASCADEs from a block, so deleting a block DESTROYS THE EMCEE SCRIPT
     * written for it — and blocks have no soft-delete. Meanwhile
     * `event_floor_plan.cocktail_schedule_block_id` merely SET NULLs. Any audit
     * scoped to `event_schedule_%` misses both the destructive cascade and the
     * SECURITY DEFINER writer.
     */
    id: 'TYPE-RUNOFSHOW',
    type: 'runofshow',
    name: 'Run of Show',
    blurb: 'the WHEN — nested blocks, one live at a time',
    countKey: 'runofshow',
    icon: 'link',
    color: 'var(--ug-e-dayof)',
    colorBg: 'var(--ug-e-dayof-bg)',
    table: 'event_schedule_blocks',
    x: 300,
    y: 560,
    fields: [
      { key: 'pk', name: 'block_id', note: 'one moment in the day' },
      { key: 'fk', name: 'parent_block_id', note: 'self-referencing, CASCADE — blocks NEST' },
      { key: '', name: 'event_id', note: 'the day it belongs to' },
    ],
    edges: [
      { verb: 'paces', to: 'TYPE-EVENTS' },
      { verb: 'cues', to: 'TYPE-VENDORS' },
    ],
  },
  {
    /**
     * LIVE STUDIO — the control room. Cameras, cut points, the wall, the
     * broadcast.
     *
     * ⚠ ONE NODE OVER TWO PREFIXES, AND THE PREFIXES ARE A RENAME ARTIFACT.
     * The product was renamed Panood → Live Studio on 2026-06-29; the tables
     * were not. `live_studio_roam_zones` carries a COMPOSITE foreign key
     * `(camera_operator_id, event_id) → panood_camera_operators(id, event_id)`,
     * and three `live-studio-*.ts` modules read `panood_*` tables directly.
     * Drawing two nodes would map the rename instead of the system, and would
     * hide the family's only inbound bond across a node boundary.
     *
     * This is the THIRD cluster where a name prefix under-captured a concept —
     * after the calendar tables that do not match `vendor_schedule_%` and the
     * emcee script that does not match `event_schedule_%`. A prefix is a naming
     * convention, never a boundary.
     *
     * ⚠ THE BROADCAST LEDGER HAS NEVER RECORDED ANYTHING. `panood_broadcasts`
     * has held zero rows for its entire existence while `panood_control_state`
     * carries two rows with `first_live_at` stamped — the control room has been
     * driven live twice and no broadcast was ever created. Its only writer sits
     * behind three YouTube Data API calls that must all succeed, so zero rows is
     * POSITIVE evidence the YouTube leg has never completed in production.
     * (Whether the suspended Google Cloud Identity account is the cause was NOT
     * verified and is not asserted here.)
     *
     * 🔴 RA 10173 GAP, ALREADY ASSERTED BY THE CODEBASE ITSELF.
     * `panood_camera_operators.claimer_user_id` is a data-subject key with NO
     * foreign key (verified across every schema), and the subject-rights
     * plumbing does not cover this table: `export-coverage-guardrail.test.ts`
     * classifies it verbatim as `TODO(RA10173-backlog)`, and the erasure
     * guardrail lists it in `UNDECIDED_BACKLOG` — a ratchet whose own header
     * reads "NOT A CLEAN BILL OF HEALTH — the opposite". A data-subject export
     * or erasure today omits it, and the guardrails are what know.
     *
     * ⚠ DO NOT DROP THIS TABLE ON A NAME GREP. It is a live canary in two
     * security suites — the same shape that broke ten assertions when
     * `households` was dropped.
     */
    id: 'TYPE-LIVESTUDIO',
    type: 'livestudio',
    name: 'Live Studio',
    blurb: 'the control room — cameras, cuts, the wall, the broadcast',
    countKey: 'livestudio',
    icon: 'camera',
    color: 'var(--ug-e-studio)',
    colorBg: 'var(--ug-e-studio-bg)',
    table: 'panood_camera_operators',
    x: 620,
    y: 60,
    fields: [
      { key: 'pk', name: 'camera_index', note: 'the camera\u2019s identity — referenced everywhere as free text, not by id' },
      { key: '', name: 'claimer_user_id', note: 'a data-subject key with NO FK (verified any schema) and no erasure coverage' },
      { key: '', name: 'claim_qr_token', note: 'the operator\u2019s credential \u2014 survives erasure today, see the RA 10173 note' },
    ],
    edges: [
      { verb: 'broadcasts', to: 'TYPE-EVENTS' },
      { verb: 'cued by', to: 'TYPE-RUNOFSHOW' },
    ],
  },
  {
    /**
     * "Make it real" — the first surface where a couple spends money INSIDE a
     * planning tool rather than on a service, and therefore the first place a
     * balance can silently disagree with what was paid for.
     *
     * ⚠ THE CREDIT IS THE UNIT, NOT THE PESO. Everything a couple is shown is
     * counted in credits (1 a part · 5 the whole look); the only peso figure in
     * the subsystem is the pack price in platform_retail_catalog_v2. A second
     * peso figure anywhere is a defect by construction.
     *
     * ⚠ `reusable` IS GENERATED, AND THAT IS THE PRIVACY BOUNDARY. A render
     * made with the couple's free-text note is stored but never offered to
     * another couple. If that were a settable flag it would eventually drift
     * from the note, and the symptom would be invisible — somebody else's
     * personal render served as a library match with nothing rendering
     * differently. It is computed from note/image/failure/quarantine instead,
     * so it cannot be got wrong by forgetting.
     */
    id: 'TYPE-RENDERS',
    type: 'render',
    name: 'Mood Board renders',
    blurb: 'the paid photoreal image — a part, a digest, and the credit it cost',
    countKey: 'render',
    icon: 'sparkles',
    color: 'var(--ug-e-render)',
    colorBg: 'var(--ug-e-render-bg)',
    table: 'event_renders',
    x: 60,
    y: 60,
    fields: [
      { key: 'pk', name: 'part_id', note: 'room:/people:/place:/whole_look — shape-checked, never an enum, because the vocabulary is DERIVED in lib/moodboard-render-parts.ts' },
      { key: '', name: 'config_digest', note: 'v<n>:<digest> — MB9’s COARSE cache key; the free-text note is deliberately excluded from it' },
      { key: '', name: 'reusable', note: 'GENERATED — a note-bearing, imageless, failed or quarantined render can never enter the shared pool' },
    ],
    edges: [
      { verb: 'rendered for', to: 'TYPE-EVENTS' },
      { verb: 'paid for by', to: 'TYPE-ORDERS' },
    ],
  },
  {
    /**
     * THE MOOD BOARD LIBRARY — and, since MB10, the SUPPLIER GALLERY inside it.
     *
     * The table is old (2026-05-25): admin placeholders, then Recraft-generated
     * attire figures, then florals. What is new is that one of its asset types
     * belongs to somebody outside Setnayan. `asset_type = 'supplier_gallery'`
     * rows are a shop's OWN portfolio photographs, and the chain they start
     * runs library → board → vendor list:
     *
     *   moodboard_library_assets  the photo, tagged with its slot and its shop
     *            ↓  the couple picks it
     *   event_inspiration_assets  library_asset_id + source_kind='gallery_pick'
     *            ↓  tallied per shop
     *   the vendor list           "You saved 2 of their photos"
     *
     * ⚠ THE COUNT IS THE WHOLE LIBRARY, NOT THE GALLERY. Every asset type
     * shares this table, so the node's number includes admin placeholders and
     * generated attire figures. Re-measure the gallery slice specifically with
     * `select count(*) from moodboard_library_assets where asset_type =
     * 'supplier_gallery'` — do not read this node's figure as "supplier photos
     * uploaded".
     *
     * ⚠ THE SLOT LIVES IN `asset_subtype`, NOT IN A `slot_key` COLUMN, and J45
     * claims that absence. `idx_moodboard_library_assets_published` is already
     * `(asset_type, asset_subtype) WHERE approved_at IS NOT NULL AND retired_at
     * IS NULL` — the picker's query verbatim — and a second column naming what
     * a photo depicts is a second thing to keep in step. Every reader pins
     * asset_type before touching asset_subtype; one that does not would read a
     * cake photo as a gown.
     *
     * ⚠ SINCE MB21 THE SCREEN HAS THREE OUTCOMES, NOT TWO. `screen_findings`
     * is NULL for a clean photo, so `screen_findings IS NOT NULL AND
     * approved_at IS NULL AND rejected_at IS NULL` IS the admin review queue —
     * there is no separate queue table and no status enum. A refusal is
     * `rejected_at` + `rejection_reason`, deliberately NOT `retired_at`:
     * retiring is reversible housekeeping with no judgement attached, and
     * collapsing the two would make an ordinary un-publish read to a supplier
     * as an accusation.
     *
     * ⚠ THE PUBLIC-READ POLICY AND THE WARRANTY CHECK OPEN THE SAME DOOR.
     * Public read is `approved_at IS NOT NULL AND retired_at IS NULL`, and
     * `moodboard_library_assets_supplier_gallery_shape` refuses an APPROVED
     * gallery row with no `rights_warranted_at`. So a supplier photo cannot
     * become publicly readable without a rights warranty — deliberately keyed
     * on the same predicate rather than on insertion, so a draft may exist
     * un-warranted and can never be published that way.
     */
    id: 'TYPE-GALLERY',
    type: 'gallery',
    name: 'Mood Board library',
    blurb: 'the photo pool behind the board — and suppliers\u2019 own credited work',
    countKey: 'gallery',
    icon: 'image',
    color: 'var(--ug-e-gallery)',
    colorBg: 'var(--ug-e-gallery-bg)',
    table: 'moodboard_library_assets',
    href: '/admin/moodboard-library',
    x: 860,
    y: 140,
    fields: [
      { key: 'pk', name: 'asset_id', note: 'uuid \u2014 what event_inspiration_assets.library_asset_id points at' },
      { key: '', name: 'vendor_profile_id', note: 'the SHOP credited on the photo \u2014 not uploaded_by, which is a user account' },
      { key: '', name: 'asset_subtype', note: 'for supplier_gallery rows this is the INSPIRATION SLOT, CHECK-constrained to the same 18 keys' },
      { key: '', name: 'rights_warranted_at', note: 'required before an approved gallery row may be publicly read; MB11 captures it at upload' },
      { key: '', name: 'screen_findings', note: 'MB21 \u2014 what the content screen found, plus the text it read. NOT NULL IS the admin queue. Revoked from anon + authenticated: this table has a PUBLIC read policy' },
      { key: '', name: 'rejection_reason', note: 'MB21 \u2014 a reviewer\u2019s words, shown to the supplier. Paired with rejected_at by a CHECK, so a refusal can never arrive with nothing to read' },
    ],
    edges: [
      { verb: 'credited to', to: 'TYPE-VENDORS' },
      { verb: 'picked onto the boards of', to: 'TYPE-EVENTS' },
    ],
  },
  {
    /**
     * THE SIGN-OFF — the moment a design stops being a wish (MB12).
     *
     * A mood board is a couple TELLING a supplier what they want. This table is
     * the supplier ANSWERING, one part at a time, and the answer has a
     * consequence: an agreed part stops re-deriving from the couple’s five
     * main colours.
     *
     * ⚠ IT IS THE BOOKING HANDSHAKE’S VOCABULARY AT A SECOND SCOPE, NOT A
     * SECOND MECHANISM. `state` holds the same five values as
     * `event_vendors.lock_request_state` — pending / agreed / declined /
     * cancelled / expired — with the same 48-hour materialised fuse and the
     * same lazy expiry on the answer path. `apps/web/lib/lock-request-state.ts`
     * reads both.
     *
     * 🔑 AND IT DELIBERATELY DOES NOT INHERIT “A BOOKING OUTRANKS ANY
     * MARKER” (owner ruling 2026-09-04). `lockRequestStateOf` returns `locked`
     * for any confirmed booking; `partFinalizationStateOf` takes no status at
     * all. Being hired is not the same as having reviewed and agreed to a
     * specific design, and auto-finalizing from a booking would fabricate the
     * exact agreement this table exists to capture.
     *
     * ⚠ THE FREEZE IS NOT IN THIS TABLE. It is in `events.role_palette` —
     * `touched_roles` plus `room_dressing`, MB5’s existing derivation-stops.
     * `vendor_agree_to_part` writes both in ONE transaction with the state
     * flip, and `events_hold_part_finalization_freeze` (a BEFORE UPDATE trigger
     * on events) puts the freeze back on EVERY palette write from every path,
     * so a writer that has never heard of finalization cannot drop it by
     * forgetting. J47 claims that pair.
     *
     * ⚠ THE COUNT IS EVERY ROW EVER, INCLUDING CLOSED ROUNDS. A declined or
     * expired ask stays as history and does not occupy the one-live-handshake
     * slot. For “how many parts are settled right now”, filter:
     * `select count(*) from moodboard_part_finalizations where state = 'agreed'`.
     */
    id: 'TYPE-SIGNOFF',
    type: 'signoff',
    name: 'Design sign-off',
    blurb: 'a supplier agreed to one part — and it stopped moving',
    countKey: 'signoff',
    icon: 'lock',
    color: 'var(--ug-e-signoff)',
    colorBg: 'var(--ug-e-signoff-bg)',
    table: 'moodboard_part_finalizations',
    x: 660,
    y: 140,
    fields: [
      { key: 'pk', name: 'finalization_id', note: 'uuid — what every RPC takes' },
      { key: '', name: 'state', note: 'the booking handshake’s five values, second scope; NEVER derived from event_vendors.status' },
      { key: '', name: 'design_snapshot', note: 'the colours the supplier answered — recorded at ASK time, because the couple keeps editing' },
      { key: '', name: 'frozen_palette_keys', note: 'what THIS agreement added to touched_roles — not everything the snapshot names, so a re-open cannot discard the couple’s own edit' },
      { key: '', name: 'reopen_state', note: 'the COUNTER-handshake: a finalized part is released only when the supplier says yes' },
    ],
    edges: [
      { verb: 'settles a part of', to: 'TYPE-EVENTS' },
      { verb: 'answered by', to: 'TYPE-VENDORS' },
    ],
  },
  {
    /**
     * STANDING PERMISSION TO CHANGE SOMEBODY ELSE'S COLOURS (MB16).
     *
     * The mood board is the couple's, and `events.role_palette` has been
     * writable by `member_type = 'couple'` alone since day one. This subsystem
     * is how a specific trusted person gets to move one part of it — and it
     * exists as three tables rather than a flag because all three answers have
     * to be separately true: WHO may (the two grant tables), WHAT they did (the
     * change log), and WHETHER it still stands (`reverted_at`).
     *
     * 🛑 IT DOES NOT WIDEN ANY POLICY, AND THAT IS THE WHOLE DESIGN.
     * `couple_can_update_event` is byte-for-byte what `20260513040000` wrote.
     * A grant holder reaches the column ONLY through
     * `apply_colour_change`, a SECURITY DEFINER function that checks the grant
     * and performs the write internally — the shape MB8's
     * `moodboard_begin_render` and MB12's `vendor_agree_to_part` already use.
     * `tests/db/the-events-update-policy-does-not-move.db.test.ts` reads the
     * live policy out of pg_policies and fails on a diff in either direction.
     *
     * ⚠ TWO GRANT TABLES, AND THE SPLIT IS REFERENTIAL. A vendor's subject is a
     * BOOKING (`event_vendors.vendor_id`); a coordinator's is a PERSON, and
     * specifically their `event_members` row — so
     * `event_colour_grants_coordinator` FKs the composite `(event_id, user_id)` and
     * `sync_delegate_membership`'s DELETE cascades their colour access away
     * with no code performing that revoke. One polymorphic table could FK
     * neither.
     *
     * ⚠ THREE CONTROLS, NONE TOUCHING ANOTHER. The switch (`is_active`), the
     * notification (`colour_changed_in_lane`, on the EMAIL allowlist) and the
     * reject (`reverted_at`) are independent by construction, not by
     * convention: `reject_colour_change`'s body never names a grant table and
     * `set_vendor_colour_access`'s never names the change log. J48 claims that.
     *
     * ⚠ THE COUNT IS EVERY LIVE GRANT ROW — vendors and coordinators together,
     * one row per DOMAIN. A stylist's single on-screen switch is TWO rows
     * (decor + main_colours), on purpose: the grant stores the lane that was
     * actually given, so re-categorising a booking later cannot widen it. For
     * "how many people hold access", count distinct subjects.
     */
    id: 'TYPE-COLOURGRANT',
    type: 'colourgrant',
    name: 'Colour access',
    blurb: 'somebody other than the couple may move one part of the palette',
    countKey: 'colourgrant',
    icon: 'key',
    color: 'var(--ug-e-colourgrant)',
    colorBg: 'var(--ug-e-colourgrant-bg)',
    table: 'event_colour_grants',
    x: 660,
    y: 260,
    fields: [
      { key: 'pk', name: 'event_id + vendor_id + domain', note: 'composite — one row per DOMAIN, so a stylist’s one switch is two rows' },
      { key: '', name: 'domain', note: 'main_colours · decor · florals · attire — resolved from event_vendors.category IN SQL, never passed in by a caller who could widen it' },
      { key: '', name: 'is_active', note: 'the couple’s switch. FALSE is refused at apply_colour_change itself, not merely hidden in the UI' },
      { key: '', name: 'revoked_at', note: 'revocation is a FLIP, never a delete — the change log has to stay explainable' },
    ],
    edges: [
      { verb: 'permits a write to', to: 'TYPE-EVENTS' },
      { verb: 'held by', to: 'TYPE-VENDORS' },
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
  gallery: {
    label: 'Library photo',
    icon: 'image',
    color: 'var(--ug-e-gallery)',
    colorBg: 'var(--ug-e-gallery-bg)',
  },
  signoff: {
    label: 'Design sign-off',
    icon: 'lock',
    color: 'var(--ug-e-signoff)',
    colorBg: 'var(--ug-e-signoff-bg)',
  },
  colourgrant: {
    label: 'Colour access',
    icon: 'key',
    color: 'var(--ug-e-colourgrant)',
    colorBg: 'var(--ug-e-colourgrant-bg)',
  },
  community: {
    label: 'Samahan',
    icon: 'group',
    color: 'var(--ug-e-community)',
    colorBg: 'var(--ug-e-community-bg)',
  },
  papic: {
    label: 'Papic',
    icon: 'camera',
    color: 'var(--ug-e-papic)',
    colorBg: 'var(--ug-e-papic-bg)',
  },
  person: {
    label: 'Person',
    icon: 'user',
    color: 'var(--ug-e-person)',
    colorBg: 'var(--ug-e-person-bg)',
  },
  package: {
    label: 'Package',
    icon: 'layers',
    color: 'var(--ug-e-deal)',
    colorBg: 'var(--ug-e-deal-bg)',
  },
  proposal: {
    label: 'Proposal',
    icon: 'tag',
    color: 'var(--ug-e-deal)',
    colorBg: 'var(--ug-e-deal-bg)',
  },
  contract: {
    label: 'Contract',
    icon: 'receipt',
    color: 'var(--ug-e-deal)',
    colorBg: 'var(--ug-e-deal-bg)',
  },
  availability: {
    label: 'Availability',
    icon: 'link',
    color: 'var(--ug-e-avail)',
    colorBg: 'var(--ug-e-avail-bg)',
  },
  geography: {
    label: 'Geography',
    icon: 'globe',
    color: 'var(--ug-e-geo)',
    colorBg: 'var(--ug-e-geo-bg)',
  },
  seatplan: {
    label: 'Seat Plan',
    icon: 'layers',
    color: 'var(--ug-e-dayof)',
    colorBg: 'var(--ug-e-dayof-bg)',
  },
  runofshow: {
    label: 'Run of Show',
    icon: 'link',
    color: 'var(--ug-e-dayof)',
    colorBg: 'var(--ug-e-dayof-bg)',
  },
  livestudio: {
    label: 'Live Studio',
    icon: 'camera',
    color: 'var(--ug-e-studio)',
    colorBg: 'var(--ug-e-studio-bg)',
  },
  render: {
    label: 'Mood Board render',
    icon: 'sparkles',
    color: 'var(--ug-e-render)',
    colorBg: 'var(--ug-e-render-bg)',
  },
};

/* ── inline Lucide-style icon paths (no network; SVG innerHTML) ── */
export const UGAT_ICON_PATHS: Record<string, string> = {
  // ⚠ A MISSING KEY RENDERS AS NOTHING, SILENTLY — the consumer is
  // `UGAT_ICON_PATHS[n.icon] ?? ''`. A node whose icon is not in this record
  // draws a blank circle that looks like a styling bug rather than a missing
  // entry, so add the path in the same commit as the node.
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
  // Samahan — three figures, distinct from `users` (Guests) so two nodes never
  // read as the same thing at a glance.
  group:
    '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M6.5 20a5.5 5.5 0 0 1 11 0"/><path d="M1.5 18a4 4 0 0 1 4-3.5"/><path d="M22.5 18a4 4 0 0 0-4-3.5"/>',
  camera:
    '<path d="M3 8.5A2 2 0 0 1 5 6.5h2l1.2-2h7.6l1.2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
  // Mood Board library (MB10) — a framed photograph, distinct from `camera`
  // (Papic, which is an act of shooting) and from `sparkles` (a paid render).
  // ⚠ AN UNKNOWN ICON KEY DOES NOT FAIL, IT FALLS BACK TO `tag` — so a node
  // added without its path here draws a price label and nobody notices.
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M17 12v3"/><path d="M20.5 12v2"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 17 5-5 3.5 3.5L16 12l4 4"/>',
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
      ['New since 07-05', 'Pay-activation stamps tier_expires_at = now+28d; a login-driven sweep fires from vendor-dashboard/layout.tsx:238 (write guard 20270920020000)'],
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
  /**
   * Structural assertions this joint makes about the schema, checked against a
   * migration replay by tests/db/ugat-schema-claims.db.test.ts.
   *
   * REQUIRED, not optional — an unclaimed joint is the loophole. Three
   * references to non-existent columns (events.qr_revoked_at,
   * payment_inbox_messages, order_ledger_entries) sat in this registry looking
   * authoritative for 25 days precisely because nothing was checking.
   *
   * Author claims from the prod snapshot or the replay, NEVER from the prose
   * above — the prose is the thing that goes stale.
   */
  claims: UgatSchemaClaim[];
}

export const UGAT_JOINTS: UgatJoint[] = [
  {
    id: 'J1',
    claims: [
      { kind: 'table', table: 'event_members' },
      { kind: 'column', table: 'event_members', column: 'guest_id' },
      { kind: 'column', table: 'event_members', column: 'member_type' },
      // The trap: vendor_id exists as a column but is dead (no FK).
      { kind: 'no_fk', table: 'event_members', column: 'vendor_id' },
    ],
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
    claims: [
      { kind: 'table', table: 'guest_claims' },
      { kind: 'column', table: 'guest_claims', column: 'claimer_user_id' },
      { kind: 'column', table: 'guest_claims', column: 'target_guest_id' },
      // The whole point of this joint: a guest is NOT a user until they claim.
      { kind: 'no_column', table: 'guests', column: 'user_id' },
    ],
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
    claims: [{ kind: 'fk', table: 'guests', column: 'event_id', references: 'events' }],
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
    claims: [
      { kind: 'table', table: 'vendor_team_members' },
      // vendor_profile_id, NOT vendor_id — the obvious guess is wrong here.
      { kind: 'column', table: 'vendor_team_members', column: 'vendor_profile_id' },
      { kind: 'column', table: 'vendor_team_members', column: 'user_id' },
    ],
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
    claims: [
      { kind: 'table', table: 'chat_threads' },
      { kind: 'column', table: 'chat_threads', column: 'event_id' },
      { kind: 'column', table: 'chat_threads', column: 'vendor_profile_id' },
      // Still present, but NO LONGER the reveal gate — see F5. The column
      // outliving its meaning is why the trap prose needed correcting.
      { kind: 'column', table: 'chat_threads', column: 'vendor_first_reply_at' },
    ],
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
    /**
     * RESTORED 2026-07-30. This joint was in the corpus prototype and absent
     * from the slice-1 port; nothing in the code or git history explained why.
     * Three independent design reviews flagged the gap.
     *
     * ⚠ The brief that asked for its restoration described it as the
     * "VENDORS↔THREADS money side". That is WRONG — verified against live prod,
     * the foreign keys go to `events` and `vendor_profiles`. It is a
     * vendor↔EVENT bond. Restored against the schema, not against the request.
     */
    id: 'J6',
    claims: [
      { kind: 'table', table: 'vendor_event_unlocks' },
      { kind: 'fk', table: 'vendor_event_unlocks', column: 'event_id', references: 'events' },
      {
        kind: 'fk',
        table: 'vendor_event_unlocks',
        column: 'vendor_profile_id',
        references: 'vendor_profiles',
      },
      {
        kind: 'unique',
        table: 'vendor_event_unlocks',
        columns: ['vendor_profile_id', 'event_id'],
      },
      { kind: 'column', table: 'vendor_event_unlocks', column: 'tokens_burned' },
      { kind: 'column', table: 'vendor_event_unlocks', column: 'comp_reason' },
    ],
    chain: 6,
    pair: ['TYPE-VENDORS', 'TYPE-EVENTS'],
    title: 'Vendor → Event (paid unlock)',
    joint: 'vendor_event_unlocks',
    cardinality:
      'One unlock per pair · UNIQUE(vendor_profile_id, event_id) — a vendor unlocks a given event once, ever',
    implementedBy:
      'vendor_event_unlocks — the money side of vendor↔event access, distinct from J5 (the conversation) and J7 (the booking). Carries tokens_burned, a full refund path (refunded_at · refunded_tokens · refund_reason) and a separate comp_reason for admin-granted access. region_slug + band record the pricing tier at unlock time rather than re-deriving it later.',
    writtenBy: 'Vendor lead-unlock flow (dormant) · admin comp grants',
    guardedBy: 'current_vendor_ids() — the vendor-scoped RLS spine',
    traps:
      '🚫 DORMANT, and the prose that described this joint predated its retirement. Vendor token PURCHASE was retired 2026-07-21 and the wallet has always had zero real purchases, so tokens_burned is a currency nobody holds: prod carries 0 unlock rows, 0 burns, 0 comps. The table is live plumbing for a mechanism that is switched off — do NOT read a token cost here as a current price, and do not treat an empty unlock table as "no vendor has access". Access today comes from elsewhere; this path simply is not the one being used.',
  },
  {
    id: 'J7',
    claims: [
      { kind: 'table', table: 'event_vendors' },
      // THE trap this joint exists for: the column is NAMED vendor_id but holds
      // the BOOKING id, which is exactly why it carries no vendor FK.
      { kind: 'column', table: 'event_vendors', column: 'vendor_id' },
      { kind: 'column', table: 'event_vendors', column: 'category_key' },
    ],
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
    claims: [
      { kind: 'table', table: 'vendor_service_attributes' },
      { kind: 'column', table: 'vendor_service_attributes', column: 'vendor_profile_id' },
      { kind: 'column', table: 'vendor_service_attributes', column: 'canonical_service' },
      // F9's core assertion, now machine-checked in BOTH directions: the day a
      // real FK lands here, this claim fails and the trap prose must be deleted
      // rather than left warning about a problem someone already fixed.
      { kind: 'no_fk', table: 'vendor_services', column: 'category' },
    ],
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
    claims: [
      { kind: 'table', table: 'event_software_activations_v2' },
      { kind: 'column', table: 'event_software_activations_v2', column: 'event_id' },
      // service_code, NOT service_key — orders uses service_key, activations
      // uses service_code, and the two are joined by string.
      { kind: 'column', table: 'event_software_activations_v2', column: 'service_code' },
      { kind: 'no_fk', table: 'orders', column: 'service_key' },
    ],
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
    claims: [
      { kind: 'table', table: 'vendor_subscriptions' },
      { kind: 'column', table: 'vendor_subscriptions', column: 'vendor_id' },
      { kind: 'column', table: 'vendor_subscriptions', column: 'tier' },
      { kind: 'column', table: 'vendor_subscriptions', column: 'status' },
    ],
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
    claims: [
      { kind: 'table', table: 'onboarding_refinements' },
      // ⚠ CORRECTED 2026-07-30 by this very check, on its first run. The
      // registry said tile_id was an FK into `canonical_service_taxonomy`. It
      // is not, and could not be: that table's PK is on `canonical_service`,
      // and NOTHING in the schema references it at all. The real FK targets
      // `service_categories`. The joint's POINT still stands — couple picks are
      // FK-anchored where vendor cards are string-glued — but it was anchored
      // to a different table than the prose claimed for 25 days.
      {
        kind: 'fk',
        table: 'onboarding_refinements',
        column: 'tile_id',
        references: 'service_categories',
      },
    ],
    chain: 11,
    pair: ['TYPE-EVENTS', 'TYPE-TAXONOMY'],
    title: 'Event → Taxonomy (preferences)',
    joint: 'onboarding_refinements',
    cardinality: 'Many per event — one row per refinement pick made in onboarding',
    implementedBy:
      'onboarding_refinements.tile_id IS a real FK — into service_categories, NOT canonical_service_taxonomy (corrected 2026-07-30; the registry named the wrong table for 25 days). Preference picks land here and drive the leaf-match engine.',
    writtenBy: 'Couple onboarding quiz · preference picker on the dashboard',
    guardedBy: 'current_event_ids() — the event-scoped RLS spine',
    traps:
      'The two halves of matching have UNEQUAL integrity: couple picks are FK-anchored (this joint); vendor cards are string-glued (chain 8 · F9). ⚠ And the anchor is service_categories, NOT canonical_service_taxonomy, whose PK is on canonical_service, not tile_id. ⚠ CORRECTED 2026-08-28 (C2): "nothing references canonical_service_taxonomy" is no longer true — canonical_service_aliases.canonical_service now carries a real RESTRICT FK into it, the first anywhere in the schema. That does NOT soften F9: vendor_services.category is still bare, unvalidated TEXT with no FK of its own.',
  },
  {
    id: 'J14',
    claims: [
      { kind: 'table', table: 'community_members' },
      { kind: 'column', table: 'community_members', column: 'community_id' },
      { kind: 'column', table: 'community_members', column: 'role' },
      { kind: 'unique', table: 'community_members', columns: ['community_id', 'user_id'] },
      { kind: 'table', table: 'community_invite_tokens' },
    ],
    chain: 12,
    pair: ['TYPE-SAMAHAN', 'TYPE-USERS'],
    title: 'Samahan ↔ User (membership)',
    joint: 'community_members',
    cardinality:
      'Many-to-many · UNIQUE(community_id, user_id) — one membership row per (person, samahan)',
    implementedBy:
      'community_members — role ∈ organizer / member. Both FKs CASCADE: deleting the samahan or the auth user removes the row outright (no tombstone).',
    writtenBy:
      'Samahan create (creator seeded as organizer) · invite-token redemption at /samahan/join/[token]',
    guardedBy:
      'current_organizer_community_ids() — the organizer-scoped helper introduced with this cluster',
    traps:
      'The roster is PERSONAL DATA about third parties (RA 10173): an admin surface may show member TALLIES but must not enumerate identities without a stated basis. Note community_invite_tokens is UNIQUE per community and carries NO expiry — one live token per samahan, forever, until rotated.',
  },
  {
    id: 'J15',
    claims: [
      { kind: 'fk', table: 'events', column: 'community_id', references: 'communities' },
      { kind: 'table', table: 'communities' },
      // The rule that keeps a wedding owned by its couple. `mentions` pins the
      // column the constraint actually tests — the prose here said "event
      // class" for a column that has never existed, and nothing caught it
      // because no claim kind covered CHECKs until this one.
      {
        kind: 'check',
        table: 'events',
        name: 'events_community_class_consistency',
        mentions: 'event_type',
      },
    ],
    chain: 13,
    pair: ['TYPE-SAMAHAN', 'TYPE-EVENTS'],
    title: 'Samahan → Event (ownership)',
    joint: null,
    cardinality: 'One-to-many · direct FK, no joint table — events.community_id',
    implementedBy:
      'events.community_id REFERENCES communities(community_id) ON DELETE SET NULL. NULL = an event owned by its people rather than by a group — the default and the overwhelming majority. A WEDDING is owned by the couple, never by a samahan, and the CHECK below enforces that rather than leaving it to convention.',
    writtenBy: 'Event creation when the host picks a community-class event',
    guardedBy:
      'CHECK events_community_class_consistency — allows community_id only when event_type ∈ simple_event · corporate · travel · celebration · tournament · reunion · anniversary. A DB-level backstop the app gate cannot bypass. (Corrected 2026-07-30: this previously said "the event class"; there is no event_class column — the rule tests event_type.)',
    traps:
      'ON DELETE SET NULL means deleting a samahan SILENTLY orphans its events into personal ones rather than failing — the events survive, their ownership does not. The CHECK is the bypass-proof half; the app gate alone is not.',
  },
  {
    id: 'J16',
    claims: [
      { kind: 'table', table: 'paparazzi_seats' },
      { kind: 'fk', table: 'paparazzi_seats', column: 'event_id', references: 'events' },
      { kind: 'table', table: 'papic_photos' },
      { kind: 'fk', table: 'papic_photos', column: 'event_id', references: 'events' },
      {
        kind: 'fk',
        table: 'papic_photos',
        column: 'paparazzi_seat_id',
        references: 'paparazzi_seats',
      },
    ],
    chain: 14,
    pair: ['TYPE-PAPIC', 'TYPE-EVENTS'],
    title: 'Papic → Event (scoping)',
    joint: 'paparazzi_seats',
    cardinality: 'One-to-many · every seat, capture and mission is event-scoped',
    implementedBy:
      'paparazzi_seats is the HUB of the 17-table Papic cluster (6 inbound FKs) — not papic_photos. A SEAT is the unit of entitlement; captures hang off it. Both seats and papic_photos carry event_id ON DELETE CASCADE.',
    writtenBy:
      'Seat provisioning on SKU activation (provisionPapicSeats) · seat re-issue · the capture upload path',
    guardedBy: 'current_event_ids() — the event-scoped RLS spine',
    traps:
      'Event deletion CASCADEs the entire Papic cluster — seats, captures, missions, usage counters — in one shot. There is no tombstone and no soft-delete: capture metadata is gone, not archived, which sits awkwardly beside the 5-year originals-retention promise.',
  },
  {
    id: 'J17',
    claims: [
      { kind: 'fk', table: 'paparazzi_seats', column: 'claimer_user_id', references: 'users' },
    ],
    chain: 15,
    pair: ['TYPE-PAPIC', 'TYPE-USERS'],
    title: 'Papic ↔ User (seat claim)',
    joint: 'paparazzi_seats',
    cardinality: 'One claimer per seat · a user may hold seats across several events',
    implementedBy:
      'paparazzi_seats.claimer_user_id REFERENCES users. A seat is claimed via a QR flow rather than username/password, so the claimer is bound at claim time, not at provisioning.',
    writtenBy: 'The seat-claim QR flow',
    guardedBy: 'Event-scoped seat tokens — a seat token only works for its bound event',
    traps:
      'ON DELETE NO ACTION, unlike event_id’s CASCADE: deleting a user who holds a seat FAILS rather than orphaning the seat. That is the safer default, but it is one of the FK classes behind the broken admin "Delete user" action.',
  },
  {
    id: 'J18',
    claims: [
      { kind: 'table', table: 'papic_guest_captures' },
      { kind: 'fk', table: 'papic_guest_captures', column: 'guest_id', references: 'guests' },
      { kind: 'fk', table: 'paparazzi_seats', column: 'guest_id', references: 'guests' },
      // `no_column`, NOT `no_fk`: the column does not exist at all, so a
      // "has no FK" claim would be vacuous — and the guard says so, which is how
      // this line got corrected. Asserting the ABSENCE is the real point (see
      // the trap below: papic_photos carries no guest bond whatsoever).
      { kind: 'no_column', table: 'papic_photos', column: 'guest_id' },
    ],
    chain: 16,
    pair: ['TYPE-PAPIC', 'TYPE-GUESTS'],
    title: 'Papic ↔ Guest (capture + seat holding)',
    joint: 'papic_guest_captures',
    cardinality: 'Many captures per guest · a guest may also hold a seat',
    implementedBy:
      'Two distinct bonds. papic_guest_captures.guest_id (CASCADE) is the guest-own-camera side — a guest’s own captures. paparazzi_seats.guest_id (NO ACTION) is a guest HOLDING a shooting seat. NOTE there is ONE product, Papic (owner-locked 2026-08-11, restated 2026-08-26); the `papic_guest_*` and `papic_one_*` table names predate that lock and are not product names.',
    writtenBy: 'Guest capture upload · seat assignment to a guest',
    guardedBy: 'current_event_ids() plus guest-scoped policies — guest scope is NOT couple scope',
    traps:
      'papic_photos has NO guest_id: tagging a photo to a guest is a SEPARATE relation, not a column on the photo. Reading papic_photos expecting a guest bond finds nothing. Also the two guest bonds disagree on delete behaviour — captures CASCADE, seats do not.',
  },
  {
    id: 'J19',
    claims: [
      { kind: 'fk', table: 'paparazzi_seats', column: 'paid_order_id', references: 'orders' },
      { kind: 'table', table: 'papic_one_orders' },
      { kind: 'fk', table: 'papic_one_orders', column: 'order_id', references: 'orders' },
      { kind: 'table', table: 'papic_guest_orders' },
      { kind: 'table', table: 'papic_event_point_grants' },
    ],
    chain: 17,
    pair: ['TYPE-PAPIC', 'TYPE-ORDERS'],
    title: 'Papic → Order (entitlement)',
    joint: 'papic_one_orders',
    cardinality:
      'One paying order per seat/grant · several order tables, one per purchase shape',
    implementedBy:
      'THREE parallel order bonds, one per purchase shape: paparazzi_seats.paid_order_id (a bought seat), papic_one_orders (a camera given its own shots — the table name predates the one-product lock), papic_guest_orders (the guest-purchased shape). papic_event_point_grants carries the capture-point allowance an order buys.',
    writtenBy: 'SKU activation on admin payment approval — never on purchase alone',
    guardedBy: 'requireAdmin on the activation path; order_ledger rows as idempotency guards',
    traps:
      'Entitlement activates on ADMIN APPROVAL, not on order creation — an ownership reader is not an active reader. And three separate order tables means "is Papic paid for?" has three answers depending on shape; there is no single column to read.',
  },
  {
    id: 'J20',
    claims: [
      { kind: 'table', table: 'papic_missions' },
      { kind: 'fk', table: 'papic_missions', column: 'vendor_id', references: 'event_vendors' },
      { kind: 'table', table: 'papic_photo_challenge_sponsorships' },
      {
        kind: 'fk',
        table: 'papic_photo_challenge_sponsorships',
        column: 'vendor_profile_id',
        references: 'vendor_profiles',
      },
    ],
    chain: 18,
    pair: ['TYPE-PAPIC', 'TYPE-VENDORS'],
    title: 'Papic ↔ Vendor (missions + sponsorship)',
    joint: 'papic_missions',
    cardinality: 'Many missions per booked vendor · sponsorships per vendor org',
    implementedBy:
      'Two bonds at DIFFERENT grains. papic_missions.vendor_id references event_vendors — the BOOKING, not the vendor org (the same misleading column name as J7). papic_photo_challenge_sponsorships.vendor_profile_id references the org directly.',
    writtenBy: 'Vendor mission authoring · sponsored-challenge purchase',
    guardedBy: 'current_vendor_ids() for the vendor side; event scope for the mission side',
    traps:
      '🔴 papic_missions.vendor_id is named like a vendor reference but points at event_vendors — a BOOKING id, exactly the J7 trap repeated. The two vendor bonds are at different grains (booking vs org), so they are NOT interchangeable and a join written against the wrong one silently returns nothing.',
  },
  {
    /**
     * A SUPPLIER'S OWN Papic — three tables, one meter, and it is not the host's.
     *
     * Owner 2026-09-05: *"vendors get 5% of the amount they paid for on booking
     * fee … they pay 500 pesos for 25 papic credits"*, and, asked what the
     * credits are for, *"base it all from the supplier's shots per event not from
     * what the host gives them."* So the supplier's credits are a DIFFERENT
     * ledger from the couple's pool (J-papic ↔ orders, papic_event_point_grants):
     * a grant here never reaches papic_event_pool_status and a host-side grant
     * never reaches here — tests/db/vendor-papic-credits-are-the-suppliers.db.test.ts.
     *
     * ⚠ GRANTS ARE APPEND-ONLY AND ALWAYS POSITIVE; THE SPEND SIDE IS NOT A
     * COUNTER HERE. What the supplier has spent is their own captures
     * (vendor_papic_captures, 1 point per photo, 8 per clip) — the same meter
     * the capture route charges — so there is no second table to drift from
     * it. G3's portfolio imports must count against the same meter.
     *
     * ⚠ vendor_papic_capture_grants is the TIER row (one per vendor×event,
     * UNIQUE on the pair — free/ltd/unli, admin-comped), not the credit ledger.
     * It could not hold a second pack for the same event, which is why the
     * ledger is a table of its own rather than a `source` value on it.
     *
     * ⚠ NO WRITE POLICY ON THE LEDGER. A supplier that could INSERT a grant
     * could grant itself the pack. Writes are service-role only, from
     * lib/sku-activation.ts on admin payment approval (*"when we approve the
     * payment"*) — the booking-fee hook (5%, cap 1,000, no floor) and the
     * vendor_papic_portfolio_pack hook (25). Idempotent per (order_id, source)
     * by a partial UNIQUE INDEX.
     */
    id: 'J49',
    claims: [
      { kind: 'table', table: 'vendor_papic_portfolio_credit_grants' },
      { kind: 'table', table: 'vendor_papic_capture_grants' },
      { kind: 'table', table: 'vendor_papic_captures' },
      {
        kind: 'fk',
        table: 'vendor_papic_portfolio_credit_grants',
        column: 'vendor_profile_id',
        references: 'vendor_profiles',
      },
      {
        kind: 'fk',
        table: 'vendor_papic_portfolio_credit_grants',
        column: 'event_id',
        references: 'events',
      },
      {
        kind: 'fk',
        table: 'vendor_papic_portfolio_credit_grants',
        column: 'order_id',
        references: 'orders',
      },
      { kind: 'column', table: 'vendor_papic_portfolio_credit_grants', column: 'credits' },
      { kind: 'column', table: 'vendor_papic_portfolio_credit_grants', column: 'source' },
      {
        kind: 'check',
        table: 'vendor_papic_portfolio_credit_grants',
        name: 'vendor_papic_portfolio_credit_grants_credits_positive',
        mentions: 'credits',
      },
      {
        kind: 'check',
        table: 'vendor_papic_portfolio_credit_grants',
        name: 'vendor_papic_portfolio_credit_grants_source_allowed',
        mentions: 'source',
      },
      // The ₱ price is NOT on the ledger — it is a vendor_billing_catalog row
      // (sku_code vendor_papic_portfolio_pack), admin-managed.
      { kind: 'no_column', table: 'vendor_papic_portfolio_credit_grants', column: 'price_php' },
      // The tier row: one per vendor×event, and the spend side's columns.
      { kind: 'unique', table: 'vendor_papic_capture_grants', columns: ['vendor_profile_id', 'event_id'] },
      { kind: 'column', table: 'vendor_papic_capture_grants', column: 'tier' },
      { kind: 'fk', table: 'vendor_papic_captures', column: 'event_id', references: 'events' },
      { kind: 'column', table: 'vendor_papic_captures', column: 'media_type' },
      { kind: 'column', table: 'vendor_papic_captures', column: 'hidden_at' },
    ],
    chain: 18,
    pair: ['TYPE-PAPIC', 'TYPE-VENDORS'],
    title: 'Papic ↔ Vendor (the supplier’s own credits, tier and captures)',
    joint: 'vendor_papic_portfolio_credit_grants',
    cardinality:
      'Many grant rows per (vendor, event) — one per approved booking-fee order, one per approved pack, any number of admin/comp rows · exactly one tier row per (vendor, event) · many captures',
    implementedBy:
      'vendor_papic_portfolio_credit_grants.(vendor_profile_id, event_id) → vendor_profiles + events, order_id → orders for the purchase; allowance = MAX(tier gift, SUM(grants.credits)) − points(vendor_papic_captures), computed only by allowancePointsFor / captureAllowance in lib/vendor-papic-tier.ts, fed by fetchVendorPapicCreditsGranted in lib/vendor-papic-grants.ts',
    writtenBy:
      'lib/sku-activation.ts on admin payment approval — grantVendorPapicCreditsForBookingFee inside the vendor_booking_fee__ hook (floor(fee × 5%), cap 1,000, no floor; only a status=paid charge earns) and grantVendorPapicPortfolioPack for vendor_papic_portfolio_pack (25) — SHIPPED 2026-09-05; the tier row by admin comp; captures by /api/vendor/papic-capture',
    guardedBy:
      'ledger: SELECT for the owning vendor (current_vendor_profile_ids) or admin, NO write policy, anon revoked, authenticated holds SELECT only; partial UNIQUE (order_id, source) WHERE order_id IS NOT NULL; the couple has no read on it at all — a supplier’s credits are not the host’s to see',
    traps:
      'The partial UNIQUE on (order_id, source) is an INDEX, not a constraint, so it is invisible to pg_constraint and cannot be claimed above — verify with \\d vendor_papic_portfolio_credit_grants. fetchVendorPapicCreditsGranted returns NULL on a failed read and allowancePointsFor treats null as "unproven" (falls back to the tier gift): a reader that coalesces null to 0 is wrong in the same way, but a reader that shows null as "0 credits" tells a supplier who earned 1,000 that they hold nothing. The 50-point Lite gift is a 2026-07-22 lock the 2026-09-05 "no floor" ruling did not mention — allowancePointsFor keeps it as a MAX and the PR body asks the owner; do not treat the tier number as the credit balance. The video-at-800 threshold (2026-08-26) was priced against the retired ₱5/point rate and is UNCHANGED pending an owner answer.',
  },
  {
    /**
     * The person graph's own edge: a relation between two PEOPLE, not between
     * two guests and not between two accounts. It survives the event that
     * created it — `created_by_event_id` records provenance, it does not scope
     * the bond. That is the difference between a family tree and a guest list.
     */
    id: 'J21',
    claims: [
      { kind: 'table', table: 'person_connections' },
      { kind: 'fk', table: 'person_connections', column: 'from_person_id', references: 'people' },
      { kind: 'fk', table: 'person_connections', column: 'to_person_id', references: 'people' },
      { kind: 'column', table: 'person_connections', column: 'relation' },
    ],
    chain: 1,
    pair: ['TYPE-PERSON', 'TYPE-PERSON'],
    title: 'Person ↔ Person',
    joint: 'person_connections',
    cardinality: 'Many-to-many, directed — `relation` names the direction (parent-of, not sibling-of)',
    implementedBy: 'person_connections — from_person_id → to_person_id with a named relation',
    writtenBy: 'generate_event_connections · the people surface',
    guardedBy: 'person-connection forgery test (tests/db/person-connections-forgery.db.test.ts)',
    traps:
      'created_by_event_id is PROVENANCE, not scope. Filtering the graph by it turns a durable family tree back into a per-event guest list.',
  },
  {
    /**
     * Stewardship: an ACCOUNT looks after a BRANCH of the person graph. The
     * steward is a user; the thing stewarded is a person. Both ends differ from
     * ownership, and neither end is a guest.
     */
    id: 'J22',
    claims: [
      { kind: 'table', table: 'person_stewardships' },
      { kind: 'fk', table: 'person_stewardships', column: 'steward_user_id', references: 'users' },
      { kind: 'fk', table: 'person_stewardships', column: 'branch_person_id', references: 'people' },
      { kind: 'column', table: 'person_stewardships', column: 'kind' },
    ],
    chain: 2,
    pair: ['TYPE-USERS', 'TYPE-PERSON'],
    title: 'User ↔ Person (stewardship)',
    joint: 'person_stewardships',
    cardinality: 'Many-to-many — a user may steward several branches; a branch may have several stewards',
    implementedBy: 'person_stewardships — steward_user_id looks after branch_person_id',
    writtenBy: 'the people surface',
    guardedBy: 'RLS on person_stewardships',
    traps:
      'Stewarding a branch is NOT owning the people in it. A steward may curate; the claim bond (people.claimed_by_user_id) is what makes a person someone.',
  },
  {
    /**
     * Guardian-held dependents — an account holds a record for someone who has
     * no account of their own (a child, an elder).
     *
     * ⚠ THE TRAP IS THE CASCADE, NOT A MISSING KEY.
     * `owner_user_id` DOES have a foreign key — to `auth.users(id)`, with
     * **ON DELETE CASCADE**. Deleting the guardian's account therefore DELETES
     * every dependent record they hold. For a guardian-held record about a
     * child or an elder that is a destructive default, and it is invisible from
     * the `public` schema: a constraint scan filtered to `table_schema='public'`
     * returns nothing for this table and reads as "no integrity at all".
     *
     * That is exactly the mistake this joint's first draft made — it asserted
     * `no_fk` and the claim guard rejected it against the replayed schema. The
     * annotation now records the real shape, and the `column` claims below fail
     * if either column is renamed away.
     */
    id: 'J23',
    claims: [
      { kind: 'table', table: 'dependents' },
      { kind: 'column', table: 'dependents', column: 'dependent_id' },
      { kind: 'column', table: 'dependents', column: 'relationship' },
      { kind: 'column', table: 'dependents', column: 'owner_user_id' },
    ],
    chain: 2,
    pair: ['TYPE-USERS', 'TYPE-PERSON'],
    title: 'User → Dependent (guardian-held)',
    joint: 'dependents',
    cardinality: 'One-to-many — a guardian holds several dependents; a dependent has one owner',
    implementedBy: 'dependents — owner_user_id holds the record, relationship names the tie',
    writtenBy: 'the dependents surface',
    guardedBy: 'RLS, plus an FK to auth.users — see the trap for what that FK does on delete',
    traps:
      'owner_user_id → auth.users ON DELETE CASCADE: deleting the guardian DELETES the dependent records. A constraint scan scoped to schema `public` shows none of this and reads as "no integrity at all".',
  },
  {
    /** A package is a TREE: items hang off the package, options off an item, and
     *  an item can hang off an option (`parent_option_id`). That recursion is
     *  the "pick a lunch, then pick its drink" shape. */
    id: 'J24',
    claims: [
      { kind: 'table', table: 'vendor_package_items' },
      { kind: 'fk', table: 'vendor_package_items', column: 'package_id', references: 'vendor_packages' },
      { kind: 'table', table: 'vendor_package_item_options' },
      { kind: 'fk', table: 'vendor_package_item_options', column: 'item_id', references: 'vendor_package_items' },
      { kind: 'fk', table: 'vendor_package_items', column: 'parent_option_id', references: 'vendor_package_item_options' },
    ],
    chain: 1,
    pair: ['TYPE-PACKAGE', 'TYPE-PACKAGE'],
    title: 'Package → items → options',
    joint: 'vendor_package_items',
    cardinality: 'Tree — a package has items, an item has options, an option can carry further items',
    implementedBy: 'vendor_package_items.package_id + .parent_option_id · vendor_package_item_options.item_id',
    writtenBy: 'the vendor package builder',
    guardedBy: 'package-option-branching.db.test.ts',
    traps: 'Flattening this to a list loses the branch. An item reached via parent_option_id is CONDITIONAL on that option being chosen.',
  },
  {
    /** The ONLY path from a package to a proposal, and it is optional. */
    id: 'J25',
    claims: [
      { kind: 'table', table: 'vendor_proposal_templates' },
      { kind: 'fk', table: 'vendor_proposal_templates', column: 'default_package_id', references: 'vendor_packages' },
      { kind: 'fk', table: 'vendor_proposals', column: 'template_id', references: 'vendor_proposal_templates' },
    ],
    chain: 2,
    pair: ['TYPE-PACKAGE', 'TYPE-PROPOSAL'],
    title: 'Package → Proposal (via template)',
    joint: 'vendor_proposal_templates',
    cardinality: 'Optional many-to-one — template_id is NULLABLE, so a proposal may have no package at all',
    implementedBy: 'vendor_proposals.template_id → vendor_proposal_templates.default_package_id → vendor_packages',
    writtenBy: 'the proposal maker',
    guardedBy: 'nothing enforces that a proposal HAS a package — by design',
    traps: 'A freehand proposal is first-class. Code that assumes every proposal has a package behind it is wrong for the nullable case.',
  },
  {
    /** A proposal keeps changing after it is sent. */
    id: 'J26',
    claims: [
      { kind: 'table', table: 'proposal_amendments' },
      { kind: 'fk', table: 'proposal_amendments', column: 'base_proposal_id', references: 'vendor_proposals' },
      { kind: 'table', table: 'proposal_amendment_items' },
      { kind: 'fk', table: 'proposal_amendment_items', column: 'amendment_id', references: 'proposal_amendments' },
    ],
    chain: 2,
    pair: ['TYPE-PROPOSAL', 'TYPE-PROPOSAL'],
    title: 'Proposal → Amendment',
    joint: 'proposal_amendments',
    cardinality: 'One-to-many — a proposal accrues amendments, each with its own line items',
    implementedBy: 'proposal_amendments.base_proposal_id + proposal_amendment_items.amendment_id',
    writtenBy: 'the proposal maker',
    guardedBy: 'RLS on both tables',
    traps: 'The BASE proposal row is not the agreement — the agreement is the base plus every amendment. Reading the base alone understates it.',
  },
  {
    /**
     * 🚨 THE BREAK IN THE DEAL CHAIN.
     *
     * A contract binds to the BOOKING and the MONEY and carries no reference to
     * the proposal it came from. The `no_column` claim below asserts that
     * absence, so this annotation fails the day a link is added — which the
     * owner has decided it should be (2026-08-01).
     */
    id: 'J27',
    claims: [
      { kind: 'table', table: 'vendor_contracts' },
      { kind: 'fk', table: 'vendor_contracts', column: 'event_vendor_id', references: 'event_vendors' },
      { kind: 'fk', table: 'vendor_contracts', column: 'order_id', references: 'orders' },
      { kind: 'no_column', table: 'vendor_contracts', column: 'proposal_id' },
    ],
    chain: 3,
    pair: ['TYPE-PROPOSAL', 'TYPE-CONTRACT'],
    title: 'Proposal → Contract (MISSING)',
    joint: 'vendor_contracts',
    cardinality: 'NOT IMPLEMENTED — there is no column joining these two',
    implementedBy: 'nothing. The contract reaches the booking (event_vendor_id) and the order (order_id) only.',
    writtenBy: 'the contract upload / e-sign flow',
    guardedBy: 'nothing — the bond does not exist to guard',
    traps: 'Proposals are AMENDABLE after sending, so "what did they agree to?" is unanswerable from a signed contract. The order amount is the only trace and cannot tell an original package from an amended one that totals the same.',
  },
  {
    /** Reviews fold under Vendor rather than standing alone (owner, 2026-08-01). */
    id: 'J28',
    claims: [
      { kind: 'table', table: 'vendor_reviews' },
      { kind: 'fk', table: 'vendor_reviews', column: 'vendor_profile_id', references: 'vendor_profiles' },
      { kind: 'fk', table: 'vendor_reviews', column: 'event_id', references: 'events' },
    ],
    chain: 2,
    pair: ['TYPE-VENDORS', 'TYPE-EVENTS'],
    title: 'Vendor ↔ Event (review)',
    joint: 'vendor_reviews',
    cardinality: 'One review per (vendor, event) — the event is what earns the right to review',
    implementedBy: 'vendor_reviews — scoped to the event the couple actually booked',
    writtenBy: 'the couple, post-event',
    guardedBy: 'RLS + vendor-verified-stamp-integrity.db.test.ts',
    traps: 'override_admin_id exists — an admin can override a review. Any rating average that ignores it reports something the vendor page does not show.',
  },
  {
    /**
     * 🚨 THE POOL SWITCH. `is_active` is what an operator flips to close a pool,
     * and until 2026-08-01 `acquire_schedule_pools()` filtered on it in the
     * VALIDATION loop but not in the INSERT — so a closed pool skipped every
     * gate and still took bookings. Fixed in migration 20271028166046.
     *
     * ⚠ `daily_booking_capacity` is checked ONLY inside that function. No
     * constraint and no exclusion index enforces it, so any write that does not
     * route through the function is unbounded.
     */
    id: 'J29',
    claims: [
      { kind: 'table', table: 'vendor_schedule_pools' },
      { kind: 'column', table: 'vendor_schedule_pools', column: 'is_active' },
      { kind: 'column', table: 'vendor_schedule_pools', column: 'daily_booking_capacity' },
      { kind: 'fk', table: 'vendor_calendar_day_states', column: 'pool_id', references: 'vendor_schedule_pools' },
      { kind: 'fk', table: 'vendor_calendar_blocks', column: 'pool_id', references: 'vendor_schedule_pools' },
      { kind: 'table', table: 'vendor_schedule_pool_categories' },
      { kind: 'table', table: 'vendor_schedule_calendar_services' },
    ],
    chain: 1,
    pair: ['TYPE-AVAILABILITY', 'TYPE-VENDORS'],
    title: 'Pool → gates (blocks · day states)',
    joint: 'vendor_schedule_pools',
    cardinality: 'One-to-many — a pool accrues blocks and day states that close its dates',
    implementedBy: 'vendor_calendar_blocks.pool_id + vendor_calendar_day_states.pool_id',
    writtenBy: 'the vendor calendar surface · acquire_schedule_pools()',
    guardedBy: 'pool-bypass-and-oauth-block.db.test.ts (the is_active half)',
    traps: 'blocks.pool_id is ON DELETE SET NULL and NULL means ORG-WIDE — deleting a pool converts its scoped blocks into blocks that close the date for ALL of the vendor\u2019s pools. day_states cascades instead. The two differ.',
  },
  {
    /**
     * 🚨 THE DATE IS COPIED, NOT DERIVED. `booked_date` duplicates
     * `events.event_date` with no FK, no trigger and no generated column keeping
     * them in step. The project's own fixture instructions are the proof: moving
     * the test event's date needs TWO updates, one per table.
     */
    id: 'J30',
    claims: [
      { kind: 'table', table: 'vendor_schedule_pool_bookings' },
      { kind: 'column', table: 'vendor_schedule_pool_bookings', column: 'booked_date' },
      { kind: 'fk', table: 'vendor_schedule_pool_bookings', column: 'event_id', references: 'events' },
      { kind: 'fk', table: 'vendor_schedule_pool_bookings', column: 'event_vendor_id', references: 'event_vendors' },
    ],
    chain: 2,
    pair: ['TYPE-AVAILABILITY', 'TYPE-EVENTS'],
    title: 'Booking ↔ Event (the held date)',
    joint: 'vendor_schedule_pool_bookings',
    cardinality: 'One booking per (pool, event_vendor) while released_at IS NULL',
    implementedBy: 'vendor_schedule_pool_bookings — the row that holds the day',
    writtenBy: 'acquire_schedule_pools() · release_schedule_pools()',
    guardedBy: 'the partial unique index on (pool_id, event_vendor_id) WHERE released_at IS NULL',
    traps: 'booked_date drifts from events.event_date whenever a couple reschedules by any path that does not release+acquire. ALSO: event_vendor_id references event_vendors(VENDOR_ID) \u2014 the column name and the target PK name differ, so joining on matching names is wrong.',
  },
  {
    /**
     * GEOGRAPHY's only enforced edge — the one FK in the whole database that
     * points at `regions`. Asserted precisely because it is the exception: if a
     * second one ever lands, that is good news worth noticing.
     */
    id: 'J31',
    claims: [
      { kind: 'table', table: 'regions' },
      { kind: 'column', table: 'regions', column: 'burn_band' },
      { kind: 'fk', table: 'wedding_destinations', column: 'region_code', references: 'regions' },
    ],
    chain: 1,
    pair: ['TYPE-GEOGRAPHY', 'TYPE-EVENTS'],
    title: 'Region → destinations (the only enforced region link)',
    joint: 'wedding_destinations',
    cardinality: 'Many-to-one — destinations sit in a region',
    implementedBy: 'wedding_destinations.region_code → regions.slug ON UPDATE CASCADE',
    writtenBy: 'the destinations seed',
    guardedBy: 'the FK itself — and it is the ONLY one',
    traps: 'Every other region reference in the schema is unenforced TEXT (events.region, vendor_profiles.hq_region, the market and pricing bands). Slugs are SHORT form (c-luzon, davao, car); long form (central_luzon, davao_region) matches nothing and is what mis-keyed the retired token_burn_bands.',
  },
  {
    /**
     * 🚨 THE BADGE IS NOT IN THE VERIFICATION TABLES. What the product reads is
     * `vendor_profiles.verification_state`; nothing syncs it from either
     * verification table, and the three carry three different status
     * vocabularies. Same shape as tiles-vs-categories, on the trust surface.
     *
     * ⚠ Deleting an account CASCADES BOTH TABLES AWAY — auth.users → users →
     * vendor_profiles → here, with no soft-delete column anywhere. The KYC
     * record does not survive the account, which collides with the retention
     * obligation.
     */
    id: 'J32',
    claims: [
      { kind: 'table', table: 'vendor_verification_applications' },
      { kind: 'table', table: 'vendor_verifications' },
      { kind: 'column', table: 'vendor_profiles', column: 'verification_state' },
    ],
    chain: 2,
    pair: ['TYPE-VENDORS', 'TYPE-VENDORS'],
    title: 'Vendor → verification (badge lives elsewhere)',
    joint: 'vendor_verification_applications',
    cardinality: 'Unbounded — NEITHER table is unique on vendor_profile_id, so "the vendor\u2019s application" is undefined',
    implementedBy: 'two generations of the same flow coexisting with no link between them',
    writtenBy: 'the vendor verification surface',
    guardedBy: 'nothing syncs verification_state — it is set by application code',
    traps: 'A .single() on vendor_profile_id will start throwing the moment a vendor submits twice. Neither table is the badge; vendor_profiles.verification_state is.',
  },
  {
    /**
     * Instagram folds under VENDOR (no node of its own: 3 tables, zero
     * connections, one never-completed handshake — mapping it would be mapping
     * speculation). Recorded because two of its shapes bite.
     */
    id: 'J33',
    claims: [
      { kind: 'table', table: 'vendor_ig_connections' },
      { kind: 'table', table: 'vendor_ig_media' },
      { kind: 'no_column', table: 'vendor_ig_media', column: 'vendor_ig_connection_id' },
      { kind: 'fk', table: 'vendor_ig_oauth_state', column: 'initiated_by', references: 'users' },
    ],
    chain: 3,
    pair: ['TYPE-VENDORS', 'TYPE-VENDORS'],
    title: 'Vendor → Instagram (media outlives the connection)',
    joint: 'vendor_ig_connections',
    cardinality: 'One connection per vendor — but NOT one vendor per Instagram account',
    implementedBy: 'vendor_ig_connections, with media hanging off the vendor rather than the connection',
    writtenBy: 'the Instagram connect flow',
    guardedBy: 'a unique index on vendor_profile_id only',
    traps: 'Revoking or deleting a connection unpublishes NOTHING \u2014 vendor_ig_media has no link to it (asserted above), so every synced post keeps rendering. And ig_user_id has no unique constraint, so two vendors can claim the same Instagram account.',
  },
  {
    /**
     * Branches, coverage and services fold under VENDOR — no node of their own.
     * Two of the three are empty and none carries a lifecycle VENDOR lacks.
     *
     * 🚨 'COVERAGE' HOLDS NO GEOGRAPHY. Despite the name it is
     * `canonical_service` + `event_types[]` + `faiths[]` — the matching
     * vocabulary, not a service area. The `no_column` claim below pins that,
     * because filing it next to branches under a "coverage area" heading is the
     * obvious and wrong reading, and the name invites it.
     *
     * ⚠ SILENT UNTYPING. `vendor_services.coverage_id` is NULLABLE with ON
     * DELETE SET NULL, and `vendor_services` has no canonical_service column —
     * so the coverage row IS the service's type. Delete a coverage and every
     * service under it survives as a TYPELESS row rather than raising.
     */
    id: 'J34',
    claims: [
      { kind: 'table', table: 'vendor_branches' },
      { kind: 'table', table: 'vendor_coverages' },
      { kind: 'table', table: 'vendor_services' },
      { kind: 'no_column', table: 'vendor_coverages', column: 'region_slug' },
      { kind: 'fk', table: 'vendor_branches', column: 'parent_vendor_profile_id', references: 'vendor_profiles' },
      { kind: 'fk', table: 'vendor_coverages', column: 'vendor_profile_id', references: 'vendor_profiles' },
    ],
    chain: 2,
    pair: ['TYPE-VENDORS', 'TYPE-SERVICES'],
    title: 'Vendor → branches · coverage · services',
    joint: 'vendor_coverages',
    cardinality: 'One vendor, many branches and coverage rows; UNIQUE (vendor_profile_id, canonical_service) on coverage',
    implementedBy: 'vendor_branches + vendor_coverages, both hanging off vendor_profiles',
    writtenBy: 'the vendor profile + branches surfaces',
    guardedBy: 'RLS — there is no public read policy on either, so neither is visible to discovery',
    traps: 'vendor_coverages is WHAT a vendor serves, not WHERE. Geography lives on vendor_profiles (hq_region, radii) and vendor_branches (city, lat/lon, radius) \u2014 two parallel copies nothing reconciles. Also: branch_subscription_active defaults to TRUE, so any direct INSERT creates a fully active PAID branch for free.',
  },
  {
    /**
     * The seam between the roster and the room — and where the soft-delete
     * asymmetry lives.
     *
     * 🚨 `guests` is SOFT-deleted (`deleted_at`); `event_seat_assignments` has
     * NO such column (both verified). The FK is ON DELETE CASCADE, so it never
     * fires on a soft delete, and the only automatic seat-release trigger fires
     * on `rsvp_status = 'declined'` — not on removal. A removed guest therefore
     * leaves an assignment the editor's guest list cannot account for, while the
     * chair-uniqueness index keeps that chair permanently occupied.
     *
     * LATENT, NOT LIVE: 4 soft-deleted guests exist and none holds a seat.
     */
    id: 'J35',
    claims: [
      { kind: 'table', table: 'event_seat_assignments' },
      { kind: 'fk', table: 'event_seat_assignments', column: 'guest_id', references: 'guests' },
      { kind: 'fk', table: 'event_seat_assignments', column: 'table_id', references: 'event_tables' },
      { kind: 'no_column', table: 'event_seat_assignments', column: 'deleted_at' },
      { kind: 'column', table: 'guests', column: 'deleted_at' },
    ],
    chain: 2,
    pair: ['TYPE-SEATPLAN', 'TYPE-GUESTS'],
    title: 'Seat ↔ Guest (the soft-delete seam)',
    joint: 'event_seat_assignments',
    cardinality: 'One guest per chair — UNIQUE (event_id, table_id, seat_number)',
    implementedBy: 'event_seat_assignments — the row that puts a person in a chair',
    writtenBy: 'the seating editor · auto-arrange',
    guardedBy: 'the chair-uniqueness index; NOT by anything that reacts to a soft delete',
    traps: 'Removing a guest is a SOFT delete, so the CASCADE never fires and the chair stays occupied by someone the guest list no longer shows. Also: nothing requires the assignment\u2019s event_id to match its table\u2019s event_id — no composite FK, no CHECK — and the chair-uniqueness index is keyed on event_id, so a divergent one would defeat it.',
  },
  {
    /**
     * The room itself, and the publish gate that decides whether a guest sees
     * any of it. Enforcement lives in RPC bodies, never in a policy.
     */
    id: 'J36',
    claims: [
      { kind: 'table', table: 'event_floor_plan' },
      { kind: 'column', table: 'event_floor_plan', column: 'published_at' },
      { kind: 'table', table: 'event_walkthrough_zones' },
      { kind: 'column', table: 'event_walkthrough_zones', column: 'published_at' },
      { kind: 'fk', table: 'event_tables', column: 'walkthrough_zone_id', references: 'event_walkthrough_zones' },
      { kind: 'table', table: 'event_floor_booths' },
      { kind: 'table', table: 'event_floor_signs' },
      { kind: 'table', table: 'event_seating_constraints' },
      { kind: 'table', table: 'seating_editor_locks' },
      { kind: 'fk', table: 'seating_editor_locks', column: 'holder_user_id', references: 'users' },
    ],
    chain: 1,
    pair: ['TYPE-SEATPLAN', 'TYPE-EVENTS'],
    title: 'Seat Plan → the room (geometry · zones · locks)',
    joint: 'event_floor_plan',
    cardinality: 'One floor plan per event; many zones, booths, signs and tables within it',
    implementedBy: 'event_floor_plan + event_walkthrough_zones + event_floor_booths/signs',
    writtenBy: 'the seating editor (one file writes geometry AND placement)',
    guardedBy: 'published_at, checked ONLY inside public_seat_lookup / public_venue_scene',
    traps: 'TWO publish gates, not one, and neither is enforced by any RLS policy \u2014 a new reader that forgets the check fails OPEN. seating_editor_locks.holder_user_id references auth.users (CROSS-SCHEMA): a constraint scan filtered to schema public reports this table as having one FK and misses a CASCADE onto a user.',
  },
  {
    /**
     * Blocks nest, and one deletion reaches further than the prefix suggests.
     */
    id: 'J37',
    claims: [
      { kind: 'table', table: 'event_schedule_blocks' },
      { kind: 'fk', table: 'event_schedule_blocks', column: 'parent_block_id', references: 'event_schedule_blocks' },
      { kind: 'table', table: 'event_schedule_suggestions' },
      { kind: 'fk', table: 'event_schedule_suggestions', column: 'block_id', references: 'event_schedule_blocks' },
      { kind: 'fk', table: 'event_schedule_suggestions', column: 'vendor_profile_id', references: 'vendor_profiles' },
      { kind: 'fk', table: 'vendor_block_scripts', column: 'block_id', references: 'event_schedule_blocks' },
    ],
    chain: 2,
    pair: ['TYPE-RUNOFSHOW', 'TYPE-VENDORS'],
    title: 'Block → suggestions · scripts',
    joint: 'event_schedule_blocks',
    cardinality: 'A tree of blocks; vendors attach suggestions and scripts to a block',
    implementedBy: 'parent_block_id for nesting; suggestions + vendor_block_scripts hang off a block',
    writtenBy: 'the run-of-show editor · advance_schedule_block (SECURITY DEFINER)',
    guardedBy: 'a DB-enforced single-live-block invariant; six RLS policies, ~one per role',
    traps: 'Deleting a block CASCADES INTO vendor_block_scripts \u2014 the emcee\u2019s written script for that moment is destroyed, and blocks have no soft-delete. event_floor_plan.cocktail_schedule_block_id merely SET NULLs, so the two behave differently. An audit scoped to the event_schedule_% prefix sees neither.',
  },
  {
    /**
     * 🔑 THE BOND THAT PROVES PANOOD AND LIVE STUDIO ARE ONE SYSTEM.
     * A COMPOSITE foreign key — unusual in this schema — pinning a roam zone to
     * a camera operator AND the event together, so a zone can never point at an
     * operator on a different event. It is also the family's only inbound bond,
     * and it crosses the two name prefixes. Asserted because if the rename is
     * ever finished, this claim is what tells whoever does it that the two
     * halves are joined.
     */
    id: 'J38',
    claims: [
      { kind: 'table', table: 'panood_camera_operators' },
      { kind: 'table', table: 'live_studio_roam_zones' },
      { kind: 'fk', table: 'live_studio_roam_zones', column: 'event_id', references: 'events' },
      { kind: 'column', table: 'panood_camera_operators', column: 'camera_index' },
      { kind: 'no_fk', table: 'panood_camera_operators', column: 'claimer_user_id' },
    ],
    chain: 1,
    pair: ['TYPE-LIVESTUDIO', 'TYPE-LIVESTUDIO'],
    title: 'Camera operator ↔ roam zone (across the rename)',
    joint: 'live_studio_roam_zones',
    cardinality: 'Composite — (camera_operator_id, event_id), so a zone cannot borrow an operator from another event',
    implementedBy: 'live_studio_roam_zones.(camera_operator_id, event_id) → panood_camera_operators.(id, event_id)',
    writtenBy: 'the roam zone editor',
    guardedBy: 'the composite FK itself — event scoping is enforced, not merely conventional',
    traps: 'The panood_/live_studio_ split is a RENAME, not a boundary. claimer_user_id is a data-subject key with NO FK and no erasure coverage \u2014 it is named in export-coverage-guardrail.test.ts as TODO(RA10173-backlog). Do NOT drop this table on a name grep; it is a canary in two security suites.',
  },
  {
    /**
     * The control plane, and the two things it routes by that nothing enforces.
     *
     * ⚠ CAMERA IDENTITY IS FREE TEXT. `program_source` / `preview_source` hold
     * `'cam' || camera_index` with no FK and no CHECK (verified), so nothing at
     * the database level keeps a routed source pointing at a camera that
     * exists. Latent, not live: every one of the 16 live moments was joined
     * against the operators and all resolve on their own event. It stays latent
     * only because both allocators ever APPEND — camera_index is never
     * renumbered and never hard-deleted.
     *
     * ⚠ THE CHANNEL POOL IS SETNAYAN-OWNED (owner-locked 2026-07-26, reversing
     * the couple-owns-the-channel model). `checked_out_event_id` SET NULLs on
     * event delete, which returns the channel to the pool rather than orphaning
     * it — the right behaviour for a shared resource.
     */
    id: 'J39',
    claims: [
      { kind: 'table', table: 'panood_control_state' },
      { kind: 'fk', table: 'panood_control_state', column: 'active_moment_id', references: 'panood_moments' },
      { kind: 'no_fk', table: 'panood_control_state', column: 'program_source' },
      { kind: 'table', table: 'live_studio_roam_channel_pool' },
      { kind: 'fk', table: 'live_studio_roam_channel_pool', column: 'checked_out_event_id', references: 'events' },
      { kind: 'table', table: 'panood_broadcasts' },
      { kind: 'table', table: 'panood_screens' },
      { kind: 'table', table: 'panood_moments' },
      { kind: 'table', table: 'live_studio_channel_grants' },
      { kind: 'table', table: 'live_studio_highlights' },
      { kind: 'table', table: 'live_studio_overlay_settings' },
      { kind: 'table', table: 'live_studio_roam_streams' },
      { kind: 'table', table: 'live_studio_channel_oauth_state' },
      // S8 (build-sessions/encoder/S8.md): single-use nonce for the desktop
      // encoder's hosted-channel stream-key handoff. Same shape and posture as
      // live_studio_channel_oauth_state above — added here rather than as a
      // new joint, since it is one more artifact of this same control-room →
      // channel-pool relationship, not a new subsystem.
      { kind: 'table', table: 'live_studio_encoder_claims' },
      { kind: 'fk', table: 'live_studio_encoder_claims', column: 'broadcast_id', references: 'panood_broadcasts' },
    ],
    chain: 2,
    pair: ['TYPE-LIVESTUDIO', 'TYPE-EVENTS'],
    title: 'Control room → cameras · moments · the channel pool',
    joint: 'panood_control_state',
    cardinality: 'One control state per event; one channel checked out of a shared Setnayan-owned pool',
    implementedBy: 'panood_control_state routes program/preview; the pool lends a channel per event',
    writtenBy: 'the control room (control-room.tsx) · the setup flow',
    guardedBy: 'RLS per event; the routed source is guarded by NOTHING',
    traps: 'panood_broadcasts has held ZERO rows for its entire existence while control_state shows the room driven live twice \u2014 the YouTube leg has never completed in prod. Its only writer sits behind three YouTube API calls that must all succeed. Downstream readers handle the empty table correctly and none mis-bills.',
  },
  {
    id: 'J40',
    claims: [
      { kind: 'table', table: 'samahan_stories' },
      { kind: 'fk', table: 'samahan_stories', column: 'community_id', references: 'communities' },
      {
        kind: 'unique',
        table: 'samahan_stories',
        columns: ['community_id', 'user_id', 'hour_bucket'],
      },
      { kind: 'column', table: 'samahan_stories', column: 'expires_at' },
      { kind: 'column', table: 'samahan_stories', column: 'screened_at' },
    ],
    chain: 12,
    pair: ['TYPE-SAMAHAN', 'TYPE-USERS'],
    title: 'Samahan \u2194 User (24-hour stories)',
    joint: 'samahan_stories',
    cardinality:
      'Many-to-many, rate-shaped: UNIQUE(community_id, user_id, hour_bucket) \u2014 one story per member per samahan per clock hour (the Setlog rhythm, owner 2026-08-24)',
    implementedBy:
      'samahan_stories \u2014 browser-transcoded web720 clip + poster frame in R2, expires_at = created_at + 24h. The read policy carries expires_at > now(), so expiry is enforced by RLS the moment the clock passes; the cron-free samahan-story-sweep (lib/samahan-stories.ts) then deletes the R2 objects FIRST and the row LAST.',
    writtenBy:
      'POST /api/samahan/story only (service role, after a member check through the caller\u2019s own session and a SYNCHRONOUS NSFW screen of the poster frame \u2014 a flagged post never gets a row)',
    guardedBy:
      'No authenticated INSERT/UPDATE/DELETE \u2014 grants revoked, no policies. Author take-down goes through DELETE /api/samahan/story so files and row move together.',
    traps:
      'Rows are PRE-screened by construction (screened_at NOT NULL) \u2014 do not add an unscreened state or an async screen here; the whole design is that no unscreened row can exist. And a failed R2 delete keeps the row on purpose (the sweep retries) \u2014 \u201crow present past expiry\u201d is the retry queue, not a bug.',
  },
  {
    id: 'J41',
    claims: [
      { kind: 'table', table: 'samahan_messages' },
      { kind: 'fk', table: 'samahan_messages', column: 'community_id', references: 'communities' },
      { kind: 'column', table: 'samahan_messages', column: 'deleted_at' },
    ],
    chain: 12,
    pair: ['TYPE-SAMAHAN', 'TYPE-USERS'],
    title: 'Samahan \u2194 User (Usapan \u2014 the group chat)',
    joint: 'samahan_messages',
    cardinality: 'Many-to-many \u00b7 one row per message; no thread table \u2014 a samahan IS the room',
    implementedBy:
      'samahan_messages \u2014 body + soft `deleted_at`. \u26d4 Deliberately NOT chat_threads: that table is a couple\u2013vendor BOOKING NEGOTIATION (event_id NOT NULL, vendor_profile_id NOT NULL, inquiry_status, agreed_price_centavos, locked_at), and a samahan has neither an event nor a vendor. The 2026-07-15 plan owner-locked \u201creuse 0019 chat\u201d; reading the live table out of prod is what overturned it.',
    writtenBy:
      'postSamahanMessage / deleteSamahanMessage (samahan actions) \u2014 user-scoped client, RLS is the gate',
    guardedBy:
      'INSERT policy demands user_id = auth.uid() AND membership (nobody posts in another member\u2019s voice); UPDATE policy scopes take-down to the author; samahan_messages_author_field_guard freezes every field except deleted_at.',
    traps:
      'Take-down is SOFT \u2014 readers MUST filter `deleted_at IS NULL`; a query that forgets shows messages their authors withdrew. Retention follows the 5-year CHAT rule via purge_expired_chat \u2014 no new sweep was added, and adding one would be a second definition of when a message is old.',
  },
  {
    /**
     * The render itself \u2014 one row per "Make it real" image.
     *
     * \u26a0 THE ONE THING TO UNDERSTAND HERE IS THAT `reusable` IS GENERATED.
     * Every other flag on the platform is a boolean somebody sets. This one
     * cannot be: it is the admission test for a POOL SHARED ACROSS COUPLES, and
     * a flag that can be set can be set wrong, with no visible symptom on
     * either side of the mistake. It reads note IS NULL AND image_key IS NOT
     * NULL AND failed_at IS NULL AND NOT reuse_blocked, and the cache index is
     * PARTIAL on it \u2014 so a note-bearing render is not merely filtered out of a
     * library match, it is not in the index the match reads.
     *
     * \u26a0 part_id IS SHAPE-CHECKED, NOT ENUMERATED, ON PURPOSE. The vocabulary
     * is DERIVED at runtime from RECEPTION_PARTS + the PaletteKey attire roles
     * + the inspiration slot keys (lib/moodboard-render-parts.ts). An IN-list
     * in the CHECK would have to be migrated every time a zone is added, and
     * the failure of forgetting is silent: the couple designs the zone and
     * section 04 never offers to render it.
     */
    id: 'J42',
    claims: [
      { kind: 'table', table: 'event_renders' },
      { kind: 'fk', table: 'event_renders', column: 'event_id', references: 'events' },
      { kind: 'column', table: 'event_renders', column: 'part_id' },
      { kind: 'column', table: 'event_renders', column: 'config_digest' },
      { kind: 'column', table: 'event_renders', column: 'note' },
      { kind: 'column', table: 'event_renders', column: 'reusable' },
      { kind: 'column', table: 'event_renders', column: 'reuse_blocked' },
      { kind: 'column', table: 'event_renders', column: 'credits_debited' },
      { kind: 'column', table: 'event_renders', column: 'inspiration_asset_ids' },
      {
        kind: 'check',
        table: 'event_renders',
        name: 'event_renders_part_id_shape',
        mentions: 'part_id',
      },
      {
        kind: 'check',
        table: 'event_renders',
        name: 'event_renders_config_digest_versioned',
        mentions: 'config_digest',
      },
      {
        kind: 'check',
        table: 'event_renders',
        name: 'event_renders_note_shape',
        mentions: 'note',
      },
      // The inspirations that conditioned a render are an ARRAY, not a child
      // table \u2014 so there is deliberately no FK here to go looking for.
      { kind: 'no_fk', table: 'event_renders', column: 'inspiration_asset_ids' },
      // MB8's admin curation. featured_at is set ONLY by
      // moodboard_set_render_featured, which refuses a render whose event has
      // not given share consent \u2014 so the featured set is consent-clean by
      // construction and no read path has to remember to filter.
      { kind: 'column', table: 'event_renders', column: 'featured_at' },
      { kind: 'column', table: 'event_renders', column: 'failed_at' },
      { kind: 'column', table: 'event_renders', column: 'failure_reason' },
      // MB9. The WATERMARKED copy, at a key that is not image_key. The
      // inspiration pool selects THIS column and never image_key, which is what
      // makes "an unmarked render cannot reach another couple" structural
      // rather than a promise \u2014 there is no flag claiming the mark was applied,
      // and the couple's own copy stays unmarked because they paid for it.
      { kind: 'column', table: 'event_renders', column: 'gallery_image_key' },
      {
        kind: 'check',
        table: 'event_renders',
        name: 'event_renders_gallery_image_key_not_blank',
        mentions: 'gallery_image_key',
      },
    ],
    chain: 19,
    pair: ['TYPE-RENDERS', 'TYPE-EVENTS'],
    title: 'Mood Board render \u2194 Event (the paid photoreal image)',
    joint: 'event_renders',
    cardinality:
      'Many per event \u00b7 one row per render, including regenerations of the same part \u2014 a couple may re-render a part as often as they hold credits',
    implementedBy:
      'event_renders.event_id \u2192 events, with part_id naming WHICH part (room:/people:/place:/whole_look). \u26d4 config_digest was built to key a cross-event render CACHE and NOTHING READS IT: the owner cancelled that design on 2026-09-03 (\u201calways charge for renders\u201d). The cross-event surface that shipped instead is MB9\u2019s inspiration POOL \u2014 moodboard_inspiration_pool, which matches nothing and returns reference photos, not substitute outputs.',
    writtenBy:
      'moodboard_begin_render inserts the row (in flight, image_key NULL) \u00b7 moodboard_finish_render attaches the R2 key \u00b7 moodboard_fail_render marks it failed AND refunds \u00b7 moodboard_set_render_featured curates \u2014 SHIPPED in MB8; moodboard_attach_gallery_copy records the watermarked copy \u2014 SHIPPED in MB9, and it is the ONLY writer of gallery_image_key',
    guardedBy:
      'RLS Pattern B (members read \u00b7 couples/coordinators + admin write, the write half REVOKED from authenticated in MB8 so every write goes through a SECURITY DEFINER function); cross-event reads go ONLY through moodboard_inspiration_pool, which requires reusable AND the event\u2019s share consent AND a watermarked gallery_image_key \u2014 three independently droppable predicates, one per row constructed in tests/db/the-inspiration-pool-shows-only-what-was-shared.db.test.ts',
    traps:
      'design_snapshot is a HISTORICAL copy, not a live join \u2014 a render must stay explicable after the couple redesigns, so reading the event\u2019s current design to explain an old render is wrong. inspiration_asset_ids is a UUID[] with NO foreign key: inspirations are soft-deleted (removed_at), so the ids keep resolving, but nothing at the database level stops an id from a different event landing there.',
  },
  {
    /**
     * The money. Two tables, and the split between them is the whole design.
     *
     * \u26a0 GRANTS ARE APPEND-ONLY AND ALWAYS POSITIVE; SPEND IS A COUNTER.
     * A spend is NOT a negative grant row. The balance has to be checked and
     * decremented atomically, and there is nothing to lock in an append-only
     * ledger \u2014 two concurrent renders would both read "one credit left" and
     * both take it. event_render_credit_usage is one row per event precisely so
     * SELECT \u2026 FOR UPDATE has something to hold.
     *
     * \u26a0 RESERVE-THEN-RELEASE, NOT DEBIT-ON-SUCCESS. moodboard_reserve_render_
     * credits runs BEFORE the model call and moodboard_release_render_credits
     * unwinds it when no image arrives. A credit spent on nothing is this
     * repo\u2019s signature failure \u2014 an outcome that looks identical whether it
     * worked or not.
     *
     * \u26a0 NEITHER TABLE HAS A WRITE POLICY. A couple that could INSERT a grant
     * could grant itself the pack. Writes are service-role / SECURITY DEFINER
     * only; the READ policies exist so the balance is visible, because a
     * balance nobody can see is the invisible-state failure the whole arc is
     * about.
     */
    id: 'J43',
    claims: [
      { kind: 'table', table: 'event_render_credit_grants' },
      { kind: 'table', table: 'event_render_credit_usage' },
      { kind: 'table', table: 'moodboard_render_config' },
      {
        kind: 'fk',
        table: 'event_render_credit_grants',
        column: 'event_id',
        references: 'events',
      },
      {
        kind: 'fk',
        table: 'event_render_credit_grants',
        column: 'order_id',
        references: 'orders',
      },
      {
        kind: 'fk',
        table: 'event_render_credit_usage',
        column: 'event_id',
        references: 'events',
      },
      {
        kind: 'fk',
        table: 'moodboard_render_config',
        column: 'pack_service_code',
        references: 'platform_retail_catalog_v2',
      },
      // ONE row per event on the spend side \u2014 this is what makes the counter
      // lockable, and it is the primary key, not a convention.
      { kind: 'unique', table: 'event_render_credit_usage', columns: ['event_id'] },
      { kind: 'column', table: 'event_render_credit_usage', column: 'credits_used' },
      { kind: 'column', table: 'moodboard_render_config', column: 'credits_per_part' },
      { kind: 'column', table: 'moodboard_render_config', column: 'credits_whole_look' },
      { kind: 'column', table: 'moodboard_render_config', column: 'credits_per_pack' },
      // The peso price is NOT here \u2014 the config points at the catalog instead.
      { kind: 'no_column', table: 'moodboard_render_config', column: 'price_php' },
      {
        kind: 'check',
        table: 'event_render_credit_grants',
        name: 'event_render_credit_grants_credits_positive',
        mentions: 'credits',
      },
      {
        kind: 'check',
        table: 'event_render_credit_usage',
        name: 'event_render_credit_usage_nonneg',
        mentions: 'credits_used',
      },
    ],
    chain: 19,
    pair: ['TYPE-RENDERS', 'TYPE-ORDERS'],
    title: 'Render credits \u2194 Order (one pack, 50 credits)',
    joint: 'event_render_credit_grants',
    cardinality:
      'One grant row per paid pack (partial UNIQUE on order_id, so re-running fulfilment cannot double-grant) \u00b7 exactly one usage row per event',
    implementedBy:
      'event_render_credit_grants.order_id \u2192 orders for the purchase; balance = SUM(grants.credits) \u2212 usage.credits_used, computed only by moodboard_render_balance',
    writtenBy:
      'moodboard_begin_render (spend \u2014 it calls reserve INSIDE the same transaction as the event_renders INSERT, so a debit without a render row is unrepresentable) \u00b7 moodboard_fail_render (refund) \u00b7 the pack-fulfilment path and moodboard_set_share_consent (grant) \u2014 SHIPPED in MB8',
    guardedBy:
      'no write policy on either table (service-role / SECURITY DEFINER only); moodboard_render_caller_may_act gates every function; `anon` is granted EXECUTE on none of them',
    traps:
      'The partial UNIQUE on order_id is an INDEX, not a constraint, so it is invisible to pg_constraint and cannot be claimed above \u2014 verify it with \\d event_render_credit_grants, not by trusting this list. moodboard_render_balance returns ZERO ROWS (not a zero balance) to a caller who may not ask: a reader that coalesces the two together tells a couple who bought a pack that they hold nothing.',
  },
  {
    /**
     * Share consent \u2014 the +1 bonus render, and the ONE thing consent gates.
     *
     * \ud83d\udd12 CONSENT GATES SHOWCASE ELIGIBILITY ONLY. It does NOT gate whether
     * the admin can see or keep a render. Owner lock 2026-06-09, re-affirmed
     * 2026-09-03: admin visibility of every render exists so Setnayan can
     * compile its own content database, and a non-consented render is still
     * retained and still admin-visible. Anyone reading
     * moodboard_admin_all_renders and reaching for a `WHERE consented` clause
     * would be undoing an owner decision while believing they were closing a
     * leak \u2014 the leak they are imagining is closed at the WRITE, in
     * moodboard_set_render_featured.
     *
     * \u26a0 THE CONSENT AND THE BONUS MOVE TOGETHER. moodboard_set_share_consent
     * sets the flag AND grants the +1, so a couple can never end up consenting
     * without the render they were promised. Once-per-event is enforced by a
     * PARTIAL UNIQUE INDEX on (event_id) WHERE source = 'consent_bonus' \u2014 not
     * by a check-then-insert, which two concurrent toggles both pass.
     *
     * \u26a0 THE BONUS IS PRICED FROM CONFIG (credits_per_part), NOT WRITTEN AS 1.
     * The lock's "6 total" was arithmetic against the retired 5-render pack;
     * the surviving pack is 50, so the RATIO was never the decision \u2014 "one
     * extra render" was.
     *
     * \u26a0 WITHDRAWAL IS NOT A DELETE. `consented` flips to FALSE and
     * withdrawn_at is stamped, so the fact that permission once existed
     * survives \u2014 a render featured while consent stood is a thing that
     * happened. Withdrawal un-features every render of the event and
     * deliberately does NOT claw back the bonus: withdrawal must not cost money.
     */
    id: 'J44',
    claims: [
      { kind: 'table', table: 'event_render_share_consent' },
      {
        kind: 'fk',
        table: 'event_render_share_consent',
        column: 'event_id',
        references: 'events',
      },
      // ONE row per event \u2014 the primary key, not a convention.
      { kind: 'unique', table: 'event_render_share_consent', columns: ['event_id'] },
      { kind: 'column', table: 'event_render_share_consent', column: 'consented' },
      { kind: 'column', table: 'event_render_share_consent', column: 'consented_at' },
      { kind: 'column', table: 'event_render_share_consent', column: 'withdrawn_at' },
      {
        kind: 'check',
        table: 'event_render_share_consent',
        name: 'event_render_share_consent_timestamped',
        mentions: 'consented',
      },
    ],
    chain: 19,
    pair: ['TYPE-RENDERS', 'TYPE-EVENTS'],
    title: 'Share consent \u2194 Event (the +1 bonus render, and what it does NOT gate)',
    joint: 'event_render_share_consent',
    cardinality:
      'Exactly one row per event, created on the first toggle either way \u00b7 at most ONE consent_bonus grant per event, ever',
    implementedBy:
      "event_render_share_consent.event_id \u2192 events (PK); the bonus is an event_render_credit_grants row with source='consent_bonus', made unique per event by a partial index",
    writtenBy:
      'moodboard_set_share_consent ONLY \u2014 there is no write policy on the table, because writing consent also GRANTS CREDITS and the two must not be separable by a client that can issue an UPDATE',
    guardedBy:
      "RLS Pattern B read half (members + admin read; no write policy) \u00b7 the partial UNIQUE index makes a second bonus unrepresentable \u00b7 moodboard_set_render_featured refuses on a non-consented event, so the featured set is consent-clean at the write",
    traps:
      "The partial UNIQUE that makes the bonus once-per-event is an INDEX, not a constraint, so it is invisible to pg_constraint and cannot be claimed above \u2014 verify it with \\d event_render_credit_grants. And do NOT filter the admin all-creations read by consent: that is a locked owner decision, not an oversight (see the docblock). Withdrawing consent does not remove the bonus grant, so SUM(grants) can exceed what a currently-consenting event would have earned \u2014 that is correct, not drift.",
  },
  {
    /**
     * WHOSE PHOTO IS THIS \u2014 the half of the chain that makes the other half
     * worth building (MB10).
     *
     * \u26a0 `uploaded_by` IS NOT THE CREDIT. It is the user account that pushed
     * the bytes; a couple reads a SHOP ("Bloom & Vine"), and one user may hold
     * more than one shop. Deriving the shop from the uploader at read time
     * would be a guess that renders identically to a fact, so
     * `vendor_profile_id` is its own column and the CHECK below refuses a
     * gallery row without it.
     *
     * \u26a0 THE SLOT IS IN `asset_subtype` AND THERE IS DELIBERATELY NO
     * `slot_key` COLUMN \u2014 claimed as a no_column, so a later "let us just add
     * slot_key" turns this joint red rather than quietly creating a second
     * source of truth for what a photo depicts.
     *
     * \u26a0 THE WARRANTY GATE IS KEYED ON `approved_at`, NOT ON INSERT. Public
     * read is `approved_at IS NOT NULL AND retired_at IS NULL`, so the CHECK
     * and the policy open the same door: an un-warranted draft may exist and
     * can never become publicly readable. MB11 captures the warranty at
     * upload; the columns landed here so MB11 is not a second migration.
     */
    id: 'J45',
    claims: [
      { kind: 'table', table: 'moodboard_library_assets' },
      { kind: 'table', table: 'moodboard_asset_color_ranges' },
      {
        kind: 'fk',
        table: 'moodboard_library_assets',
        column: 'vendor_profile_id',
        references: 'vendor_profiles',
      },
      {
        kind: 'fk',
        table: 'moodboard_library_assets',
        column: 'uploaded_by',
        references: 'users',
      },
      {
        kind: 'fk',
        table: 'moodboard_asset_color_ranges',
        column: 'asset_id',
        references: 'moodboard_library_assets',
      },
      { kind: 'column', table: 'moodboard_library_assets', column: 'asset_type' },
      { kind: 'column', table: 'moodboard_library_assets', column: 'asset_subtype' },
      { kind: 'column', table: 'moodboard_library_assets', column: 'approved_at' },
      { kind: 'column', table: 'moodboard_library_assets', column: 'retired_at' },
      { kind: 'column', table: 'moodboard_library_assets', column: 'rights_warranted_at' },
      { kind: 'column', table: 'moodboard_library_assets', column: 'rights_warranty_version' },
      // The slot lives in asset_subtype. Claiming the ABSENCE is what stops a
      // second column for one fact from arriving unnoticed.
      { kind: 'no_column', table: 'moodboard_library_assets', column: 'slot_key' },
      {
        kind: 'check',
        table: 'moodboard_library_assets',
        name: 'moodboard_library_assets_asset_type_check_v3',
        mentions: 'asset_type',
      },
      {
        kind: 'check',
        table: 'moodboard_library_assets',
        name: 'moodboard_library_assets_supplier_gallery_shape',
        mentions: 'rights_warranted_at',
      },
      {
        kind: 'check',
        table: 'moodboard_library_assets',
        name: 'moodboard_library_assets_rights_warranty_paired',
        mentions: 'rights_warranty_version',
      },
    ],
    chain: 20,
    pair: ['TYPE-GALLERY', 'TYPE-VENDORS'],
    title: 'Library photo \u2194 Vendor (the credit a couple reads)',
    joint: 'moodboard_library_assets',
    cardinality:
      'Many photos per shop \u00b7 exactly one shop per supplier-gallery photo (the CHECK requires it); NULL shop on every other asset type, which is Setnayan\u2019s own imagery',
    implementedBy:
      'moodboard_library_assets.vendor_profile_id \u2192 vendor_profiles, with asset_type = \'supplier_gallery\' marking the creditable slice and asset_subtype carrying the inspiration slot',
    writtenBy:
      'the vendor upload page (app/vendor-dashboard/moodboard-library) \u2014 still gated to reception_decor as of this row; MB11 widens it to the supplying trades and captures the warranty',
    guardedBy:
      'RLS Pattern D \u2014 public read of approved-and-not-retired rows, vendor insert/update of their own (uploaded_by = auth.uid(), source = \'stylist_upload\'), admin all; plus moodboard_library_assets_supplier_gallery_shape, which refuses an approved gallery row with no shop, no real slot, or no rights warranty',
    traps:
      'asset_subtype means something DIFFERENT per asset_type (\'church\' for a venue_scene, \'bride\' for a figure_attire, an inspiration slot key for supplier_gallery), so every reader must pin asset_type first \u2014 grep `asset_type` under apps/web before adding one that does not. ON DELETE CASCADE on vendor_profile_id means deleting a shop deletes its gallery rows \u2014 SET NULL would fail the shape CHECK and, because users \u2192 vendor_profiles already cascades, would BLOCK account deletion. The storage objects are NOT swept by that cascade. The admin library page lists every asset_type and casts to its own three-value union; a fourth value reaching it renders the raw key.',
  },
  {
    /**
     * THE PICK \u2014 a library photo becomes a tile on one couple\u2019s board, and
     * the credit survives the copy (MB10).
     *
     * \u26a0 THIS ROW USED TO LIE, AND THE LIE WAS INVISIBLE. `applyMoodboardTemplate`
     * has copied library photos into inspiration slots since the theme gallery
     * shipped, writing them as `source_kind = 'url_paste'` \u2014 a Setnayan library
     * asset permanently recorded as something the couple pasted off the
     * internet \u2014 because \'url_paste\' was the closer of the only two modes that
     * existed. Nothing rendered differently, which is why it lasted.
     *
     * \u26a0 THE BICONDITIONAL IS THE WIRING GUARD.
     * `event_inspiration_assets_gallery_pick_has_provenance` asserts
     * `(source_kind = 'gallery_pick') = (library_asset_id IS NOT NULL)`. A
     * future edit that drops the id cannot merely lose the credit quietly \u2014 the
     * INSERT fails. A correct query and a correct component can each pass their
     * own tests while the line between them is cut; this is that line, held in
     * the database.
     *
     * \u26a0 THE BOARD ROW DOES NOT COPY THE SHOP. There is no
     * `vendor_profile_id` here and J46 claims that absence: the credit is
     * resolved THROUGH library_asset_id every time it is rendered, so a shop
     * that renames itself renames itself on every board at once.
     */
    id: 'J46',
    claims: [
      { kind: 'table', table: 'event_inspiration_assets' },
      {
        kind: 'fk',
        table: 'event_inspiration_assets',
        column: 'library_asset_id',
        references: 'moodboard_library_assets',
      },
      {
        kind: 'fk',
        table: 'event_inspiration_assets',
        column: 'event_id',
        references: 'events',
      },
      {
        kind: 'fk',
        table: 'event_inspiration_assets',
        column: 'added_by_user_id',
        references: 'users',
      },
      { kind: 'column', table: 'event_inspiration_assets', column: 'source_kind' },
      { kind: 'column', table: 'event_inspiration_assets', column: 'slot_key' },
      { kind: 'column', table: 'event_inspiration_assets', column: 'slot_position' },
      { kind: 'column', table: 'event_inspiration_assets', column: 'removed_at' },
      // The credit is resolved through the library asset, never denormalised
      // onto the board row \u2014 claimed so a "just copy the shop name" shortcut
      // fails here first.
      { kind: 'no_column', table: 'event_inspiration_assets', column: 'vendor_profile_id' },
      {
        kind: 'check',
        table: 'event_inspiration_assets',
        name: 'event_inspiration_assets_source_kind_check_v3',
        mentions: 'source_kind',
      },
      {
        kind: 'check',
        table: 'event_inspiration_assets',
        name: 'event_inspiration_assets_gallery_pick_has_provenance',
        mentions: 'library_asset_id',
      },
      // MB9's third provenance, built to the same biconditional shape: a
      // reference picked out of another couple's shared render.
      {
        kind: 'fk',
        table: 'event_inspiration_assets',
        column: 'source_render_id',
        references: 'event_renders',
      },
      {
        kind: 'check',
        table: 'event_inspiration_assets',
        name: 'event_inspiration_assets_render_pick_has_provenance',
        mentions: 'source_render_id',
      },
      {
        kind: 'check',
        table: 'event_inspiration_assets',
        name: 'event_inspiration_assets_slot_key_check_v3',
        mentions: 'slot_key',
      },
    ],
    chain: 20,
    pair: ['TYPE-GALLERY', 'TYPE-EVENTS'],
    title: 'Library photo \u2194 Event (the pick, and the credit that survives it)',
    joint: 'event_inspiration_assets',
    cardinality:
      'One row per (event, slot_key, slot_position) among ACTIVE rows \u2014 18 slots \u00d7 3 photos; removed rows do not count toward it, so a slot can be re-filled',
    implementedBy:
      'event_inspiration_assets.library_asset_id \u2192 moodboard_library_assets, paired with source_kind = \'gallery_pick\' by a CHECK biconditional',
    writtenBy:
      'applyGalleryPick (the couple\u2019s picker), applyRenderPick (MB9 \u2014 another couple\u2019s shared render, saved as a reference, costing nothing) and applyMoodboardTemplate (theme seeding) \u2014 all three in studio/mood-board/actions.ts; uploadMoodboardSlot writes the couple\u2019s OWN photos, which carry no id and no credit',
    guardedBy:
      'RLS Pattern B \u2014 event_members-scoped select/insert/update, admin all; plus the provenance biconditional and the 18-key slot CHECK',
    traps:
      'The one-row-per-cell rule is a PARTIAL UNIQUE INDEX (WHERE removed_at IS NULL), not a constraint, so it is invisible to pg_constraint and cannot be claimed above \u2014 verify with \\d event_inspiration_assets. Removal is SOFT (removed_at), so every read must filter it; a count that forgets tells a couple they saved photos they deleted. library_asset_id is ON DELETE CASCADE, so HARD-deleting a library photo (deleteAsset / deleteStylistAsset, which also remove the storage object) removes the tile from every board holding it. RETIRING one (retired_at) does not touch this FK at all and the tile keeps rendering, credited \u2014 the two paths behave completely differently and the UI copy for them must not be shared.',
  },
  {
    /**
     * THE SIGN-OFF AND THE FREEZE ARE ONE ACT (MB12).
     *
     * 🔑 THIS JOINT EXISTS TO CLAIM A WIRE, NOT A TABLE. Two separate writes —
     * “mark the row agreed” and “stop that part re-deriving” — have two seams,
     * and both are invisible:
     *
     *   · agreed with no freeze → the couple edits their five majors and the
     *     supplier’s agreed design quietly becomes a different design. Nothing
     *     renders differently. The supplier builds what they agreed to and it is
     *     wrong on the day.
     *   · frozen with no agreement → a role stops following the majors for a
     *     reason no surface can name.
     *
     * `vendor_agree_to_part` does both in one function body, i.e. one
     * transaction, and `vendor_answer_part_reopen` welds the release the same
     * way. `events_hold_part_finalization_freeze` is the backstop for every
     * OTHER writer of `events.role_palette` — the board’s debounced save, a
     * theme apply, the onboarding wizard, an admin repair — because a guard on
     * one writer is a guard on one writer.
     *
     * ⚠ THE FREEZE LIVES IN MB5’s MECHANISM, NOT A NEW ONE. Agreeing writes the
     * snapshot’s colours into `events.role_palette.touched_roles` and
     * `.room_dressing`, which `deriveBoard` and `resolveRoomDressing` already
     * refuse to overwrite. There is no second definition of “frozen” anywhere,
     * and that is deliberate: two definitions would each pass their own suite.
     *
     * ⚠ AND THE ONE-LIVE-HANDSHAKE RULE IS A PARTIAL UNIQUE INDEX, so it is
     * invisible to pg_constraint and cannot be claimed below — verify it with
     * \d moodboard_part_finalizations.
     */
    id: 'J47',
    claims: [
      { kind: 'table', table: 'moodboard_part_finalizations' },
      {
        kind: 'fk',
        table: 'moodboard_part_finalizations',
        column: 'event_id',
        references: 'events',
      },
      {
        kind: 'fk',
        table: 'moodboard_part_finalizations',
        column: 'vendor_id',
        references: 'event_vendors',
      },
      { kind: 'column', table: 'moodboard_part_finalizations', column: 'state' },
      { kind: 'column', table: 'moodboard_part_finalizations', column: 'design_snapshot' },
      { kind: 'column', table: 'moodboard_part_finalizations', column: 'expires_at' },
      { kind: 'column', table: 'moodboard_part_finalizations', column: 'reopen_state' },
      { kind: 'column', table: 'moodboard_part_finalizations', column: 'reopen_expires_at' },
      { kind: 'column', table: 'moodboard_part_finalizations', column: 'frozen_palette_keys' },
      { kind: 'column', table: 'moodboard_part_finalizations', column: 'frozen_dressing_fields' },
      // 🔑 CLAIMED AS AN ABSENCE. The finalized/frozen fact is NEVER a boolean
      // on this row: it is `state`, and the freeze it implies lives in
      // events.role_palette. A `is_frozen` column added here would be a second
      // source of truth that can disagree with the palette, so this claim turns
      // that edit red rather than letting it ship.
      { kind: 'no_column', table: 'moodboard_part_finalizations', column: 'is_frozen' },
      // 🔑 AND SO IS THIS ONE. Copying event_vendors.status onto the row is the
      // shape that would let “a booking outranks any marker” creep back in.
      { kind: 'no_column', table: 'moodboard_part_finalizations', column: 'status' },
      {
        kind: 'check',
        table: 'moodboard_part_finalizations',
        name: 'moodboard_part_finalizations_state_chk',
        mentions: 'state',
      },
      {
        kind: 'check',
        table: 'moodboard_part_finalizations',
        name: 'moodboard_part_finalizations_part_id_shape',
        mentions: 'part_id',
      },
      {
        kind: 'check',
        table: 'moodboard_part_finalizations',
        name: 'moodboard_part_finalizations_answer_coherent',
        mentions: 'agreed_at',
      },
      {
        kind: 'check',
        table: 'moodboard_part_finalizations',
        name: 'moodboard_part_finalizations_reopen_needs_agreement',
        mentions: 'reopen_state',
      },
    ],
    chain: 21,
    pair: ['TYPE-SIGNOFF', 'TYPE-EVENTS'],
    title: 'Design sign-off ↔ Event (the agreement, and the freeze welded to it)',
    joint: 'moodboard_part_finalizations',
    cardinality:
      'At most ONE pending-or-agreed row per (event, part) — a part is one design; closed rounds (declined / cancelled / expired) accumulate as history and free the slot for a fresh ask',
    implementedBy:
      'moodboard_part_finalizations.state (the booking handshake’s five values at a second scope) + events.role_palette.touched_roles / .room_dressing, which is where the freeze actually lives',
    writtenBy:
      'seven SECURITY DEFINER RPCs and nothing else — request_part_finalization / cancel_part_finalization_request / request_part_reopen / cancel_part_reopen_request (the couple) and vendor_agree_to_part / vendor_decline_part / vendor_answer_part_reopen (the supplier). authenticated holds NO insert, update or delete on the table',
    guardedBy:
      'RLS Pattern B read half (event members read; the ASKED booking reads via current_vendor_event_vendor_ids; admin all) · no authenticated write policy at all · request_part_finalization refuses unless event_vendors.status is one of the four CONFIRMED values · guard_moodboard_part_finalization materialises the 48-hour fuse on every transition into pending · events_hold_part_finalization_freeze re-asserts the freeze on every write to events.role_palette',
    traps:
      'The one-live-handshake rule is a PARTIAL UNIQUE INDEX (WHERE state IN (\'pending\',\'agreed\')), invisible to pg_constraint — verify with \\d. Expiry is LAZY: a lapsed ask keeps state=\'pending\' until somebody presses Agree or Decline, so any count of "waiting" must compare expires_at itself rather than trusting the state. An expired RE-OPEN leaves the part FROZEN — silence is not consent in either direction. And the two RPCs that touch both tables write the ROW FIRST and the palette SECOND on purpose: reassert_part_finalization_freeze reads AGREED rows, so the order decides what the backstop sees.',
  },
  {
    /**
     * A STANDING GRANT, A WRITE THAT GOES THROUGH A DOOR, AND AN UNDO — MB16.
     *
     * 🔑 THIS JOINT CLAIMS THE WIRING, AND THE WIRING IS THE WHOLE FEATURE.
     * Three connections, each of which fails invisibly if it comes loose:
     *
     *   · GRANT → WRITE. `apply_colour_change` refuses without an ACTIVE row in
     *     the named domain. Hiding the control instead would leave the RPC open
     *     to anybody who kept a tab from before the revoke.
     *   · WRITE → NOTICE. There is NO per-change approval in this mechanism, by
     *     owner ruling — so the notification is the only thing that tells a
     *     couple their colours moved. `colour_changed_in_lane` is on
     *     EMAIL_ENABLED_TYPES and out of MARKETING_GATED_EMAIL_TYPES; a notice
     *     with no allowlist entry reaches nobody, which is the gap MB8 found on
     *     payments and the six lock_request_* types found before that.
     *   · WRITE → HISTORY → UNDO. `reject_colour_change` operates on the logged
     *     row, so a change that was not logged cannot be undone. That is why
     *     `apply_colour_change` READS THE ROW BACK before logging: MB12's
     *     freeze trigger reverts an agreed part's colour inside the same
     *     statement and the UPDATE still reports success, so a logged-but-never-
     *     applied change would give the couple an undo for something that never
     *     happened.
     *
     * ⚠ AND THE THREE CONTROLS ARE INDEPENDENT BY ABSENCE. Rejecting cannot
     * revoke and revoking cannot erase, because neither function contains a
     * statement naming the other's table.
     * `lib/colour-access-controls-are-independent.test.ts` reads the bodies out
     * of the migration and fails if either one gains such a statement.
     *
     * ⚠ THE COORDINATOR HALF IS A SECOND TABLE, `event_colour_grants_coordinator`, and
     * it cannot be claimed here — a joint names ONE joint table. Its composite
     * FK to `event_members (event_id, user_id)` is what makes removing a
     * delegate revoke their colour access, and it is claimed by its own row in
     * the claims list below.
     */
    id: 'J48',
    claims: [
      { kind: 'table', table: 'event_colour_grants' },
      { kind: 'table', table: 'event_colour_grants_coordinator' },
      { kind: 'table', table: 'event_colour_changes' },
      { kind: 'fk', table: 'event_colour_grants', column: 'event_id', references: 'events' },
      { kind: 'fk', table: 'event_colour_grants', column: 'vendor_id', references: 'event_vendors' },
      { kind: 'fk', table: 'event_colour_changes', column: 'event_id', references: 'events' },
      { kind: 'column', table: 'event_colour_grants', column: 'domain' },
      { kind: 'column', table: 'event_colour_grants', column: 'is_active' },
      { kind: 'column', table: 'event_colour_grants', column: 'revoked_at' },
      { kind: 'column', table: 'event_colour_grants_coordinator', column: 'user_id' },
      { kind: 'column', table: 'event_colour_grants_coordinator', column: 'domain' },
      { kind: 'column', table: 'event_colour_grants_coordinator', column: 'is_active' },
      { kind: 'column', table: 'event_colour_changes', column: 'old_value' },
      { kind: 'column', table: 'event_colour_changes', column: 'new_value' },
      { kind: 'column', table: 'event_colour_changes', column: 'reverted_at' },
      { kind: 'column', table: 'event_colour_changes', column: 'actor_label' },
      // 🔑 CLAIMED AS AN ABSENCE. The couple's undo lives on the CHANGE, never
      // on the grant — a `revoked_by_reject` column here would be exactly the
      // coupling the owner ruled against, and it would be a second source of
      // truth that can disagree with is_active.
      { kind: 'no_column', table: 'event_colour_grants', column: 'reverted_at' },
      // 🔑 AND SO IS THIS. A grant does not carry an approval queue: "once
      // granted, no per-change approval" is the ruling, and a pending/approved
      // column on the change log is the shape that would quietly reintroduce
      // one.
      { kind: 'no_column', table: 'event_colour_changes', column: 'approved_at' },
      {
        kind: 'check',
        table: 'event_colour_grants',
        name: 'event_colour_grants_domain_chk',
        mentions: 'domain',
      },
      {
        kind: 'check',
        table: 'event_colour_grants',
        name: 'event_colour_grants_revocation_dated',
        mentions: 'revoked_at',
      },
      {
        kind: 'check',
        table: 'event_colour_grants_coordinator',
        name: 'event_colour_grants_coordinator_domain_chk',
        mentions: 'domain',
      },
      {
        kind: 'check',
        table: 'event_colour_changes',
        name: 'event_colour_changes_value_shape',
        mentions: 'new_value',
      },
      {
        kind: 'check',
        table: 'event_colour_changes',
        name: 'event_colour_changes_palette_has_prior',
        mentions: 'old_value',
      },
      {
        kind: 'check',
        table: 'event_colour_changes',
        name: 'event_colour_changes_revert_dated',
        mentions: 'reverted_at',
      },
    ],
    chain: 21,
    pair: ['TYPE-COLOURGRANT', 'TYPE-EVENTS'],
    title: 'Colour access ↔ Event (a standing grant, a logged write, and one undo)',
    joint: 'event_colour_grants',
    cardinality:
      'One row per (event, booking, DOMAIN) — a stylist’s single on-screen switch is two rows (decor + main_colours), and the coordinator half is one row per (event, user, domain) in event_colour_grants_coordinator. Revocation flips is_active; rows are never deleted',
    implementedBy:
      'events.role_palette, written by apply_colour_change (SECURITY DEFINER) and by nothing else on this path — the couple keeps their own RLS route through couple_can_update_event, which is unchanged',
    writtenBy:
      'four SECURITY DEFINER RPCs and nothing else — set_vendor_colour_access / set_coordinator_colour_access / reject_colour_change (the couple) and apply_colour_change (the grant holder). authenticated holds NO insert, update or delete on any of the three tables',
    guardedBy:
      'RLS Pattern B read half on all three (event members read; the granted BOOKING reads its own row via current_vendor_event_vendor_ids; admin all) · no authenticated write policy anywhere · colour_access_caller_is_couple refuses a NULL auth.uid() rather than failing open to a server context · colour_domains_for_category resolves the lane IN SQL so no caller can widen it · colour_domain_covers refuses a target outside the granted domain · event_colour_grants_coordinator_membership_fk CASCADEs from event_members, so removing a delegate revokes their access with no code doing it',
    traps:
      'apply_colour_change READS THE ROW BACK after the UPDATE: MB12’s events_hold_part_finalization_freeze reverts an agreed part’s colour inside the same statement and the UPDATE still reports success, so without the read-back the log would carry a change that never happened. A palette slot is CHANGED and never CREATED (no_such_slot) — that is what lets reject be an in-place restore instead of an array splice. And event_colour_changes.vendor_id is ON DELETE SET NULL with deliberately NO companion CHECK requiring it: SET NULL onto a CHECKed column makes the FK behave like RESTRICT while claiming SET NULL, and deleting the booking would fail with a constraint error nobody could place.',
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
