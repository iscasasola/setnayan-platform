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

import { getDayOfPhase } from './day-of-mode';

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
    label: 'Photo moments',
    description: 'Tell guests when to lift the camera and when to stay present.',
    is_always_on: false,
    editor_subroute: 'photo-moments',
  },
  {
    type: 'your_photos',
    label: 'Your photos',
    description: 'A space for the guest’s tagged photos after the wedding.',
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
    label: 'Our photos',
    description: 'A gallery of your own photos — engagement or pre-wedding shots.',
    is_always_on: false,
    editor_subroute: 'our-photos',
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
// EVERYTHING here is inert until WEBSITE_PHASES_ENABLED === 'true'. The
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
 * only the literal string 'true' enables it. Read once per render at the
 * page-component level + threaded down so the value is stable across the
 * tree.
 */
export function isWebsitePhasesEnabled(): boolean {
  return process.env.WEBSITE_PHASES_ENABLED === 'true';
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
 * A null event date (very early planning, no date set yet) maps to 'rsvp'.
 */
export function getLifecyclePhase(eventDate: string | null): LifecyclePhase {
  if (!eventDate) return 'rsvp';
  switch (getDayOfPhase(eventDate)) {
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
      const now = Date.now();
      if (eventMs < now) return 'editorial';
      // Future, beyond the near-event run-up: split the long pre-event window
      // into Save the Date (announcement, > STD_THRESHOLD_DAYS out) and RSVP
      // (invitation, within the threshold).
      const daysUntil = (eventMs - now) / (24 * 60 * 60 * 1000);
      return daysUntil > STD_THRESHOLD_DAYS ? 'save_the_date' : 'rsvp';
    }
  }
}
