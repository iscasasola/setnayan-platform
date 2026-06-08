/**
 * Invitation Widgets — V1 lib helpers (iteration 0004 · 2026-05-22 PM).
 *
 * Per-event widget registry that drives the public landing page render
 * order + show/hide at apps/web/app/[slug]/page.tsx. The editor lives at
 * /dashboard/[eventId]/website/widgets. The DB schema lives at
 * supabase/migrations/20260607030000_invitation_widgets.sql.
 *
 * This file owns the canonical TypeScript shapes + the small set of
 * pure helpers that the editor page, the server actions, and the public
 * landing-page renderer all share. By centralizing the widget catalog
 * here we make it impossible for the editor UI, the seed migration, and
 * the renderer to drift on widget names, labels, or always-on flags.
 */

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
