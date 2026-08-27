/**
 * Invitation Widgets — V1 lib helpers (iteration 0004 · 2026-05-22 PM).
 *
 * Per-event widget registry that drives the public landing page render
 * order + show/hide at apps/web/app/[slug]/page.tsx. The editor lives at
 * /dashboard/[eventId]/website/widgets. The DB schema lives at
 * supabase/migrations/20260607030000_invitation_widgets.sql.
 *
 * It ALSO owns the website lifecycle-phase engine (Increment C, flag-dark):
 * the rsvp / event / editorial phase computation + the per-widget
 * element×phase matrix. All of it is gated behind WEBSITE_PHASES_ENABLED
 * (OFF by default) at the render call-site, so the live page is unchanged
 * until the flag flips. See Wedding_Website_Lifecycle_Spec_2026-06-07 §2.
 *
 * This file owns the canonical TypeScript shapes + the small set of
 * pure helpers that the editor page, the server actions, and the public
 * landing-page renderer all share. By centralizing the widget catalog
 * here we make it impossible for the editor UI, the seed migration, and
 * the renderer to drift on widget names, labels, or always-on flags.
 */

import { getDayOfPhase, getMenuLifecyclePhase } from './day-of-mode';
import { envFlagEnabled } from '@/lib/env-flag';

/**
 * The 12 canonical widget types in the V1 landing-page render. This list
 * must match the CHECK constraint in supabase/migrations/20260607030000.
 *
 * Per CLAUDE.md 2026-05-22 PR owner directive, this V1 ship includes the
 * `tier_comparison` widget that exists in the current hardcoded render
 * even though the iteration 0004 spec text references only 11 widget
 * types. Spec doc and engineering are aligned via this lib.
 */
export const WIDGET_TYPES = [
  'hero',
  'greeting',
  'qr_card',
  'event_details',
  'countdown',
  'schedule',
  'rsvp',
  'venue_map',
  'dress_code',
  'photo_moments',
  'your_photos',
  'tier_comparison',
  'special_message',
  'what_to_bring',
  'our_photos',
  'our_love_story',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/**
 * Per-widget catalog metadata for the editor UI. Maps each widget_type to:
 *   - label: short human-readable name shown in the editor row + landing
 *   - description: 1-line summary shown under the label in the editor
 *   - is_always_on: canonical default — matches the migration seed (the
 *     DB row is the runtime source-of-truth, but the editor uses this
 *     catalog to render the right control-disabled state without an
 *     extra round-trip)
 *   - editor_href: optional per-widget detail editor route (when one
 *     exists at /dashboard/[eventId]/website/<sub-editor>). When null,
 *     the editor row shows show/hide + reorder only and the widget's
 *     content comes from existing events.* columns (RSVP, QR, etc.)
 *     or is purely cosmetic (Tier Comparison).
 */
export type WidgetCatalogEntry = {
  type: WidgetType;
  label: string;
  description: string;
  is_always_on: boolean;
  editor_subroute: string | null;
};

/**
 * Catalog ordered by canonical display position. The editor renders in
 * THIS order when an event has no widgets row yet (defensive fallback);
 * once the seed migration runs every event has its own per-row
 * display_order. The catalog is the catalog; the DB rows are the
 * runtime state.
 */
export const WIDGET_CATALOG: readonly WidgetCatalogEntry[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'Monogram, names, and date at the top of every page.',
    is_always_on: true,
    editor_subroute: 'hero-photo',
  },
  {
    type: 'greeting',
    label: 'Greeting',
    description: 'Personalized welcome for each guest who opens their link.',
    is_always_on: true,
    editor_subroute: null,
  },
  {
    type: 'qr_card',
    label: 'QR card',
    description: "Your guest's personal invitation QR and shareable URL.",
    is_always_on: true,
    editor_subroute: null,
  },
  {
    type: 'event_details',
    label: 'Event details',
    description: 'Date, venue, role, and side at a glance.',
    is_always_on: false,
    editor_subroute: null,
  },
  {
    type: 'countdown',
    label: 'Countdown',
    description: 'Days to the wedding. Hides itself once the day arrives.',
    is_always_on: false,
    editor_subroute: null,
  },
  {
    type: 'schedule',
    label: 'Schedule',
    description: 'Your wedding-day run-of-show.',
    is_always_on: false,
    editor_subroute: null,
  },
  {
    type: 'rsvp',
    label: 'RSVP',
    description: "The wedding's load-bearing form. Always visible.",
    is_always_on: true,
    editor_subroute: null,
  },
  {
    type: 'venue_map',
    label: 'Venue map',
    description: 'Address, directions, and a deep-link to maps.',
    is_always_on: false,
    editor_subroute: null,
  },
  {
    type: 'dress_code',
    label: 'Dress code',
    description: 'Palette, dos and don’ts, and the look you’re going for.',
    is_always_on: false,
    editor_subroute: 'dress-code',
  },
  {
    type: 'photo_moments',
    label: 'Camera cues',
    description: 'When you want guests shooting, and when you want them present.',
    is_always_on: false,
    editor_subroute: 'photo-moments',
  },
  {
    type: 'your_photos',
    label: 'Each guest’s own photos',
    description: 'The card promising every guest the photos they are tagged in.',
    is_always_on: false,
    editor_subroute: null,
  },
  {
    type: 'tier_comparison',
    label: 'Setnayan account explainer',
    description: 'Public vs. Registered account for photos that last beyond 3 days.',
    is_always_on: false,
    editor_subroute: null,
  },
  {
    type: 'special_message',
    label: 'Special message',
    description: 'A heartfelt note to your guests from the couple.',
    is_always_on: false,
    editor_subroute: 'special-message',
  },
  {
    type: 'what_to_bring',
    label: 'What to bring',
    description: 'Gifts, registry, or a kind no-gift note for your guests.',
    is_always_on: false,
    editor_subroute: 'what-to-bring',
  },
  {
    type: 'our_photos',
    label: 'Photos you add',
    description: 'A gallery of photos you upload yourself, shown to everyone.',
    is_always_on: false,
    editor_subroute: 'our-photos',
  },
  {
    type: 'our_love_story',
    label: 'Our love story',
    description: 'How you met, the proposal, and your milestones — from onboarding.',
    is_always_on: false,
    editor_subroute: null,
  },
];

/**
 * Quick lookup map. Catalog is immutable for V1 so building this once at
 * module load is cheap.
 */
export const WIDGET_CATALOG_BY_TYPE: Readonly<Record<WidgetType, WidgetCatalogEntry>> =
  Object.freeze(
    Object.fromEntries(
      WIDGET_CATALOG.map((entry) => [entry.type, entry]),
    ) as Record<WidgetType, WidgetCatalogEntry>,
  );

/**
 * The runtime row shape — matches the SELECT in the editor page + the
 * landing page render-loop.
 */
export type InvitationWidgetRow = {
  widget_id: string;
  event_id: string;
  widget_type: WidgetType;
  display_order: number;
  is_visible: boolean;
  is_always_on: boolean;
  tier: 'basic' | 'pro';
  config_json: unknown;
  created_at: string;
  updated_at: string;
  /**
   * Open-browse three-state couple control (PR4 migration
   * 20270919912384). `'auto'` = the site decides (hasContent + phase
   * emphasis); `'shown'` = force-show; `'hidden'` = force-hide. The legacy
   * `is_visible` column stays the flag-OFF render gate; `mode` is only
   * consulted on the open-browse path. Optional at the type level so
   * pre-open-browse callers (and the pure golden tests) that never set it
   * keep compiling; a missing value reconciles to the couple's `is_visible`
   * choice via {@link openBrowseSectionVisible}.
   */
  mode?: 'auto' | 'shown' | 'hidden';
  /**
   * Open-browse per-widget who-can-see dial (PR5 migration
   * 20270920050000). `'public'` (default) = everyone; `'guests_only'` =
   * cookie-verified guests only. ANDed with `mode` on the open-browse path
   * (mode = show/hide, audience = who); inert on the flag-off path. Optional
   * for the same compile-compat reason as `mode`; a missing value is treated
   * as `'public'`.
   */
  audience?: 'public' | 'guests_only';
};

/**
 * Type guard — narrows an arbitrary string to a WidgetType when it
 * appears in the canonical list. Used by server actions to validate
 * form input before SQL.
 */
export function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && (WIDGET_TYPES as readonly string[]).includes(value);
}

/**
 * Sort widgets for the editor list. is_always_on widgets float to the top
 * in their canonical order, then hideable widgets in display_order. The
 * editor renders them in this order so the host can see the rendered
 * landing-page order at a glance.
 *
 * The renderer at [slug]/page.tsx uses a different render logic:
 * is_always_on widgets render in FIXED positions (hero, greeting, qr_card
 * before RSVP, etc.) regardless of display_order. The editor's sort is
 * for SHOWING the widgets; the renderer's logic is for RENDERING them.
 */
export function sortWidgetsForEditor(
  widgets: readonly InvitationWidgetRow[],
): InvitationWidgetRow[] {
  return [...widgets].sort((a, b) => {
    // Always-on widgets first, in canonical-catalog order
    if (a.is_always_on && !b.is_always_on) return -1;
    if (!a.is_always_on && b.is_always_on) return 1;
    // Same group — sort by display_order
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    // Tie-breaker: widget_type alphabetical (deterministic)
    return a.widget_type.localeCompare(b.widget_type);
  });
}

/**
 * Get the visible, hideable widgets in render order. Used by the public
 * landing page to render the optional widget block between the fixed
 * always-on positions.
 */
export function visibleHideableWidgets(
  widgets: readonly InvitationWidgetRow[],
): InvitationWidgetRow[] {
  return [...widgets]
    .filter((w) => !w.is_always_on && w.is_visible)
    .sort((a, b) => a.display_order - b.display_order);
}

/**
 * Find a widget by type. Returns the row when present, null when missing.
 * The migration guarantees every event has all 12 rows; this helper is
 * defensive for events created BEFORE the migration applied (the backfill
 * step handles them on apply, but app code should still tolerate missing
 * rows during a deploy window).
 */
export function widgetByType(
  widgets: readonly InvitationWidgetRow[],
  type: WidgetType,
): InvitationWidgetRow | null {
  return widgets.find((w) => w.widget_type === type) ?? null;
}

/**
 * Check if a widget should render. Returns TRUE when:
 *   - is_always_on is TRUE (hero, greeting, qr_card, rsvp — renderer is
 *     responsible for rendering these regardless of is_visible)
 *   - is_visible is TRUE
 *
 * The editor blocks hiding is_always_on widgets, so the OR clause is a
 * belt-and-braces check for any future schema drift.
 */
export function widgetShouldRender(row: InvitationWidgetRow | null): boolean {
  if (!row) return false;
  if (row.is_always_on) return true;
  return row.is_visible;
}

// ---------------------------------------------------------------------------
// Website lifecycle-phase engine (Increment C · flag-dark)
//
// The public wedding website moves through three lifecycle phases as the
// event date passes. Each phase shows a different subset of widgets per the
// element×phase matrix in Wedding_Website_Lifecycle_Spec_2026-06-07 §2.
//
// EVERYTHING here is inert until WEBSITE_PHASES_ENABLED is set to an ON value. The
// renderer at [slug]/page.tsx only consults widgetInPhase / getLifecyclePhase
// when isWebsitePhasesEnabled() returns true; with the flag off (the
// default) the page renders byte-for-byte as it does today.
// ---------------------------------------------------------------------------

/**
 * The four website lifecycle phases (4-path model · 2026-06-14):
 *   - save_the_date : far before the wedding (> STD_THRESHOLD_DAYS out) — the
 *                     announcement. Asks nothing of the guest; monogram + date
 *                     + countdown + calendar-add only.
 *   - rsvp          : the run-up — the invitation + RSVP-gathering site
 *   - event         : the wedding day itself — the live day-of surface
 *   - editorial     : after the wedding — the story / gallery recap
 */
// NOT the dashboard bottom-nav menu phase: that is `MenuLifecyclePhase` in lib/day-of-mode.ts (plan → dayof → after). This WEBSITE pair is the one `app/[slug]/page.tsx` consumes.
export type LifecyclePhase = 'save_the_date' | 'rsvp' | 'event' | 'editorial';

/**
 * Days-before-the-wedding cutoff that splits the pre-event window into the
 * Save the Date phase (earlier — announcement) and the RSVP phase (later —
 * invitation). Provisional; tunable. Mirrors the ~90-day handoff in the
 * 4-path timeline design.
 */
export const STD_THRESHOLD_DAYS = 90;

/**
 * Per-widget phase visibility — the element×phase matrix (spec §2). A widget
 * renders in a phase only when that phase is in its list. Exhaustive over
 * WIDGET_TYPES (the Record type enforces this at compile time, so adding a
 * widget type without a phase mapping is a type error).
 */
export const WIDGET_PHASES: Record<WidgetType, LifecyclePhase[]> = {
  hero: ['save_the_date', 'rsvp', 'event', 'editorial'],
  greeting: ['rsvp'],
  qr_card: ['rsvp', 'event'],
  event_details: ['rsvp', 'event'],
  countdown: ['rsvp'],
  schedule: ['rsvp', 'event'],
  rsvp: ['rsvp'],
  venue_map: ['rsvp', 'event'],
  dress_code: ['rsvp'],
  photo_moments: ['rsvp'],
  your_photos: ['event', 'editorial'],
  tier_comparison: ['rsvp', 'event', 'editorial'],
  special_message: ['rsvp', 'editorial'],
  what_to_bring: ['rsvp'],
  our_photos: ['rsvp', 'editorial'],
  our_love_story: ['rsvp', 'editorial'],
};

/**
 * Whether the given widget type should render in the given lifecycle phase.
 * Fails OPEN: an unmapped widget type (future drift) renders in every phase
 * rather than silently disappearing.
 */
export function widgetInPhase(type: WidgetType, phase: LifecyclePhase): boolean {
  return WIDGET_PHASES[type]?.includes(phase) ?? true;
}

/**
 * Feature flag for the website lifecycle-phase engine. OFF by default —
 * enabled by any spelling lib/env-flag.ts accepts. Read once per render at the
 * page-component level + threaded down so the value is stable across the
 * tree.
 */
export function isWebsitePhasesEnabled(): boolean {
  return envFlagEnabled(process.env.WEBSITE_PHASES_ENABLED);
}

/**
 * Maps the event date to its lifecycle phase, reusing the day-of date math
 * in lib/day-of-mode.ts for the near-event window:
 *
 *   DayOfPhase 'live'  → 'event'     (T-1h .. T+8h — the wedding day window)
 *   DayOfPhase 'post'  → 'editorial' (T+8h .. T+24h — just after)
 *   DayOfPhase 'pre'   → 'rsvp'      (T-3d .. T-1h — run-up)
 *
 * ⚠ DayOfPhase 'inactive' is the catch-all for BOTH ends — *more than 3 days
 * before* the wedding AND *more than 24 hours after* it. Those are opposite
 * lifecycle phases, so 'inactive' MUST be disambiguated by comparing the event
 * date to now: a wedding already in the past → 'editorial'; one still in the
 * future → 'save_the_date' when it's more than STD_THRESHOLD_DAYS out, else
 * 'rsvp'. (Mapping 'inactive' straight to 'rsvp' would wrongly show the
 * invitation on a wedding that happened a week ago — the day-of 'post' window
 * only lasts 24h.)
 *
 * A null event date (very early planning, no date set yet) maps to
 * 'save_the_date' — a couple with no finalized date is at the very START of the
 * wedding lifecycle (the announcement stage), so their Save-the-Date shows. This
 * is consistent with the future-date split below: the farther out the wedding,
 * the earlier the phase; no date at all is "farthest out" → Save-the-Date. (Was
 * 'rsvp', which skipped the Save-the-Date entirely for date-less weddings —
 * owner 2026-06-18: a rendered Save-the-Date didn't show because of this.)
 */
// NOT the dashboard menu-phase resolver: that is `getMenuLifecyclePhase` in lib/day-of-mode.ts.
export function getLifecyclePhase(
  eventDate: string | null,
  /*
    THE VENUE'S OWN CLOCK.

    🚨 WITHOUT IT THIS RESOLVER ASKS A SERVER IN UTC WHAT TIME IT IS AT A
    WEDDING IN MANILA. `getDayOfPhase` below has taken a `tz` since 2026-08-05
    and this call never passed one, so the PUBLIC page — the one guests open —
    decided which phase to render from a clock eight hours behind the venue.

    Optional so no caller silently changes meaning; every call site in the app
    passes it, and `every-public-phase-reads-the-venue-clock` fails if a new one
    forgets.
  */
  tz?: string,
  /** The LAST day, for a celebration spanning several — same value the
   *  dashboard's own resolver anchors on. */
  eventEndDate?: string | null,
  /*
    "Now", injectable.

    🪤 ADDED BECAUSE A TEST OF THIS FUNCTION PASSED FOR THE WRONG REASON.
    Without it the only way to assert the post-event answer is to run at the
    real wall clock — and on the morning after a test event, `getDayOfPhase`
    ALREADY returns 'post', which already maps to 'editorial'. So the
    assertion went green with the new boundary deleted: it was measuring the
    old path and reporting the new one. Every other resolver in this pair
    takes an injectable now for exactly this reason.
  */
  nowMs?: number,
): LifecyclePhase {
  if (!eventDate) return 'save_the_date';

  /*
    ─── ONE ANSWER TO "HAS IT HAPPENED?", NOT TWO ───────────────────────────

    The dashboard flips to its After phase at 06:00 on the day after the last
    day (see lib/day-of-mode.ts). This page used to keep saying "Happening now"
    until T+36h — so on the morning after a wedding, the couple's own dashboard
    could call it finished while the page their guests were opening still ran
    the live day-of surface.

    Delegated, never re-derived: the boundary lives in ONE function and this
    asks it. `cleared_at` is deliberately NOT passed — closing out the day is a
    HOST action on the host's dashboard, and it must not retire the guests'
    page out from under them mid-celebration.
  */
  if (getMenuLifecyclePhase(eventDate, null, tz, nowMs, eventEndDate ?? null) === 'after') {
    return 'editorial';
  }

  switch (getDayOfPhase(eventDate, tz, nowMs)) {
    case 'live':
      return 'event';
    case 'post':
      return 'editorial';
    case 'pre':
      return 'rsvp';
    case 'inactive':
    default: {
      // Far from the event window (>3d before or >24h after). The parse only
      // needs day-granularity here (the near-event cases are already handled),
      // so a plain Date parse is sufficient; timezone slop can't flip a date
      // that is days away from now.
      const eventMs = new Date(eventDate).getTime();
      if (!Number.isFinite(eventMs)) return 'rsvp';
      const now = nowMs ?? Date.now();
      if (eventMs < now) return 'editorial';
      // Future, beyond the near-event run-up: split the long pre-event window
      // into Save the Date (announcement, > STD_THRESHOLD_DAYS out) and RSVP
      // (invitation, within the threshold).
      const daysUntil = (eventMs - now) / (24 * 60 * 60 * 1000);
      return daysUntil > STD_THRESHOLD_DAYS ? 'save_the_date' : 'rsvp';
    }
  }
}

// ---------------------------------------------------------------------------
// Open-browse engine (OPEN-BROWSE PR7 · council verdict 2026-07-22 §1.3)
//
// Under open-browse the lifecycle phase stops being a GATE (widgetInPhase →
// render boolean) and becomes EMPHASIS: everything the couple published exists
// from day one behind the five-tab menu; the phase decides only what Home
// leads with. `WIDGET_SPOTLIGHT` supersedes `WIDGET_PHASES` on this path — it
// yields an ordering weight + which phases a widget may be Home's spotlight,
// NEVER a render boolean. `WIDGET_PHASES` is untouched and stays the flag-OFF
// path's gate (deleted only at PR11 after the flip soaks), so both matrices
// coexist by design.
//
// EVERYTHING here is dormant in production: it is consulted only when the
// per-event `events.website_open_browse` column is TRUE, which DEFAULTs FALSE
// for every event (flipped for demo events + new events at PR11). With the
// column FALSE the guest site renders byte-for-byte as it does today.
// ---------------------------------------------------------------------------

/**
 * Per-widget open-browse emphasis. `weight` orders the widened widget list
 * (lower = earlier); `spotlightPhases` is the set of phases in which this
 * widget is *eligible* to be Home's one signature spotlight (the phase's
 * emphasis pick — see {@link pickHomeSpotlight}). Exhaustive over WIDGET_TYPES
 * (the Record type makes adding a widget without an entry a compile error),
 * mirroring WIDGET_PHASES's compile-time exhaustiveness.
 */
export type WidgetSpotlightSpec = {
  weight: number;
  spotlightPhases: LifecyclePhase[];
};

export const WIDGET_SPOTLIGHT: Record<WidgetType, WidgetSpotlightSpec> = {
  // Always-on chrome — never in the widened hideable list, weight is nominal.
  hero: { weight: 0, spotlightPhases: [] },
  greeting: { weight: 1, spotlightPhases: [] },
  qr_card: { weight: 2, spotlightPhases: [] },
  rsvp: { weight: 3, spotlightPhases: ['rsvp'] },
  // Hideable widgets, in the council's Details/Story/Photos reading order.
  event_details: { weight: 10, spotlightPhases: [] },
  countdown: { weight: 11, spotlightPhases: ['save_the_date'] },
  schedule: { weight: 12, spotlightPhases: ['event'] },
  venue_map: { weight: 13, spotlightPhases: ['event'] },
  dress_code: { weight: 14, spotlightPhases: [] },
  what_to_bring: { weight: 15, spotlightPhases: [] },
  tier_comparison: { weight: 16, spotlightPhases: [] },
  our_love_story: { weight: 20, spotlightPhases: [] },
  our_photos: { weight: 21, spotlightPhases: [] },
  special_message: { weight: 22, spotlightPhases: ['editorial'] },
  photo_moments: { weight: 23, spotlightPhases: [] },
  your_photos: { weight: 30, spotlightPhases: ['event', 'editorial'] },
};

/**
 * The four phases in which qr_card + greeting must be reachable under
 * open-browse (council §1.2 — the personal QR personalizes in EVERY phase,
 * fixing the live `WIDGET_PHASES` defect that strips qr_card in
 * save_the_date/editorial). These two always-on gates widen to all phases on
 * the open-browse path; on the flag-off path WIDGET_PHASES still governs them.
 */
export const OPEN_BROWSE_ALL_PHASES: readonly LifecyclePhase[] = [
  'save_the_date',
  'rsvp',
  'event',
  'editorial',
];

/**
 * Per-widget terminal state under open-browse (council §1.3). Time-bound
 * widgets get an explicit terminal state instead of blanket-open — the
 * finding that sank the "Anchored Monolith" was that widening the lists with
 * no degraded states permanently serves a live RSVP form + future-tense
 * "what to bring" under the post-event editorial.
 *
 *   - `active`  — renders normally (present-tense copy).
 *   - `archive` — post-event past-tense copy (PR8 authors the strings; until
 *                 then the renderer treats `archive` like a NOT-YET-shown
 *                 section so no future-tense content leaks — see
 *                 {@link isTerminalRenderable}).
 *   - `closed`  — the RSVP form after close: a quiet status card, not the
 *                 open form (PR8 copy; excluded until then).
 *
 * PR7 computes the descriptor and EXCLUDES anything non-`active` from the
 * widened lists / gates so the dormant flag-on path is *correct* (never
 * wrong-tense), leaving `archive`/`closed` COPY rendering to PR8's owner copy
 * pass. This is the documented PR7→PR8 seam.
 */
export type WidgetTerminalState = 'active' | 'archive' | 'closed';

/**
 * Resolve a widget's terminal state for a phase under open-browse. The
 * time-bound widgets called out in §1.3:
 *   - `countdown` → `archive` post-event ("Married [date]" stamp, PR8).
 *   - `what_to_bring` / `photo_moments` → `archive` post-event (past-tense).
 *   - `rsvp` → `closed` post-event (quiet closed card; the form stays open
 *     through the live window — day-of confirmations are real PH behavior).
 * Everything else is `active` in every phase (evergreen). Only the
 * `editorial` phase is post-event; `event` (the wedding day) keeps the form
 * open, so RSVP is `active` there.
 */
export function resolveWidgetTerminalState(
  type: WidgetType,
  phase: LifecyclePhase,
): WidgetTerminalState {
  const postEvent = phase === 'editorial';
  if (!postEvent) return 'active';
  if (type === 'rsvp') return 'closed';
  if (type === 'countdown' || type === 'what_to_bring' || type === 'photo_moments') {
    return 'archive';
  }
  return 'active';
}

/**
 * Whether a widget in the given terminal state may render in PR7. Only
 * `active` renders today; `archive`/`closed` need the PR8 copy pass, so PR7
 * excludes them (correct-but-incomplete over wrong-tense). When PR8 lands the
 * degraded renderers this predicate widens to `true` for `archive`/`closed`.
 */
export function isTerminalRenderable(state: WidgetTerminalState): boolean {
  return state === 'active';
}

/**
 * Reconcile a widget row's open-browse visibility. Because PR9's
 * `setSectionMode` writer lands AFTER this reader, a row hidden between the
 * PR4 migration and the PR9 cutover may carry `mode='auto'` while
 * `is_visible=false` — the migration's backfill only tagged rows hidden
 * BEFORE it ran. So the reader must treat `is_visible=false` OR `mode='hidden'`
 * as hidden (the migration comment's load-bearing rule), EXCEPT always-on rows
 * which render regardless. `mode='shown'` force-shows a hideable row even if a
 * legacy `is_visible=false` lingers (the couple's newer, explicit choice wins).
 */
export function openBrowseSectionVisible(row: InvitationWidgetRow): boolean {
  if (row.is_always_on) return true;
  if (row.mode === 'hidden') return false;
  if (row.mode === 'shown') return true;
  // mode 'auto' (or unset, pre-PR9): fall back to the legacy is_visible gate.
  return row.is_visible;
}

/**
 * Whether a widget is visible to the given identity under open-browse — the
 * `audience` dial ANDed onto {@link openBrowseSectionVisible}. `guests_only`
 * widgets never render for the anonymous (cookie-less) tier; `public` (the
 * default, and any unset value) renders for both.
 */
export function openBrowseWidgetVisibleTo(
  row: InvitationWidgetRow,
  identity: 'anonymous' | 'guest',
): boolean {
  if (!openBrowseSectionVisible(row)) return false;
  if (identity === 'anonymous' && row.audience === 'guests_only') return false;
  return true;
}

/**
 * The shared emptiness predicate (council §1.3 graft). `widgetShouldRender`
 * checks only `is_visible`/`is_always_on`, NEVER whether the widget has any
 * content — so the menu and the renderer could disagree (a menu tab pointing
 * at an empty section). `hasContent` is the ONE predicate both consume.
 *
 * Content presence is data the pure lib cannot see (it lives in `events.*`
 * columns, R2 media, schedule rows), so the caller passes a per-type resolver
 * via `ctx`. Widgets absent from the map default to HAVING content (fail-open:
 * a widget the couple explicitly kept visible is assumed intentional), matching
 * the existing "render everything for pre-backfill rows" posture.
 */
export function hasContent(
  type: WidgetType,
  ctx: Partial<Record<WidgetType, boolean>>,
): boolean {
  const known = ctx[type];
  return known === undefined ? true : known;
}

/**
 * The widened, ordered, terminal-state-aware widget list for the open-browse
 * path — the drop-in replacement for the phase-fenced `visibleHideableWidgets`
 * used by `resolveSiteBodyPlan` when `website_open_browse` is TRUE. It:
 *   1. keeps only hideable rows visible to `identity` (mode + audience),
 *   2. drops rows whose content is empty for this event (`hasContent`),
 *   3. drops rows whose terminal state isn't renderable yet (PR7 seam),
 *   4. orders by `WIDGET_SPOTLIGHT.weight` (falling back to `display_order`).
 * No phase FENCE — a published, non-empty, active widget renders in every
 * phase (that is the whole point of open-browse).
 */
export function openBrowseWidgetsInOrder(input: {
  widgets: readonly InvitationWidgetRow[];
  identity: 'anonymous' | 'guest';
  phase: LifecyclePhase;
  content: Partial<Record<WidgetType, boolean>>;
}): InvitationWidgetRow[] {
  const { widgets, identity, phase, content } = input;
  return [...widgets]
    .filter((w) => !w.is_always_on)
    .filter((w) => openBrowseWidgetVisibleTo(w, identity))
    .filter((w) => hasContent(w.widget_type, content))
    .filter((w) => isTerminalRenderable(resolveWidgetTerminalState(w.widget_type, phase)))
    .sort((a, b) => {
      const wa = WIDGET_SPOTLIGHT[a.widget_type].weight;
      const wb = WIDGET_SPOTLIGHT[b.widget_type].weight;
      if (wa !== wb) return wa - wb;
      return a.display_order - b.display_order;
    });
}
