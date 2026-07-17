/**
 * Vendor "On the Day" — the MODULE REGISTRY.
 *
 * This replaces the hardcoded 4-persona quad that used to live in
 * `vendor-dashboard/on-the-day/page.tsx` (`CATEGORY_PILLS` = photo / coordinator
 * / caterer / band). That quad was invented taxonomy: it recognised only ~6 of
 * the ~57 canonical `WeddingTile` keys a vendor actually stores in `services[]`,
 * collapsing everything else (florist, photo booth, HMUA, mobile bar, host/MC,
 * fireworks, LED wall, souvenirs, …) into a dead `'general'` fallback.
 *
 * The launcher model (council verdict 2026-07-16) is:
 *   pick a booked event → activate/deactivate MODULES → set access → launch.
 *
 * Controllers now derive from the REAL taxonomy. Every vendor tile maps to one
 * of a small set of **controller families** (keyed to the 10 marketplace
 * folders, `TILE_PARENT` in lib/taxonomy.ts) — Capture, Serve, Coordinate,
 * Perform, Setup — so we get ~5 families instead of 57 bespoke consoles, and a
 * new tile that admin adds to the DB taxonomy lands in the right family for free
 * (it inherits its folder's family).
 *
 * A MODULE is one day-of tool (run-of-show, QR scanner, review feed, the free
 * vendor Papic capture, the per-guest delivery tracker, …). Each module declares
 * which families it defaults ON for and whether it needs a per-event access
 * grant. The vendor can override the on/off set per booking; overrides persist
 * to the sparse `vendor_dayof_configs` table (absent row = code defaults, so a
 * vendor who never configures anything gets sensible defaults with zero writes).
 *
 * This module is PURE (no I/O): given a vendor's `services[]` + the booked
 * event's tiles it computes families and default-on modules. Persistence and
 * live data live in the page / server actions.
 */

import type { WeddingTile, WeddingFolder } from '@/lib/taxonomy';
import { TILE_PARENT } from '@/lib/taxonomy';

/**
 * Controller families — the day-of "job shape" a vendor is doing on the floor.
 * Keyed off the 10 marketplace folders so the mapping survives taxonomy edits.
 *
 *   capture     — you point a lens at the day (Documentary: photo/video,
 *                 editorial, livestream).
 *   coordinate  — you run the floor (Planning: coordinator / planner).
 *   perform     — you're the show (Program: band, DJ, choir, host/MC, dancers).
 *   serve       — you hand a product to guests (Feast, Booths, Prints:
 *                 catering, cake, food carts, souvenirs, photo booth, …).
 *   setup       — you build/dress the room or move people (Venue, Design, Look,
 *                 Transport: florist, stylist, HMUA, lights, bridal car, …).
 */
export type DayOfFamily = 'capture' | 'coordinate' | 'perform' | 'serve' | 'setup';

export const DAY_OF_FAMILY_ORDER: readonly DayOfFamily[] = [
  'coordinate',
  'capture',
  'serve',
  'perform',
  'setup',
];

/** Which family each marketplace folder belongs to. */
const FOLDER_FAMILY: Record<WeddingFolder, DayOfFamily> = {
  venue: 'setup',
  planning: 'coordinate',
  feast: 'serve',
  design: 'setup',
  program: 'perform',
  documentary: 'capture',
  look: 'setup',
  booths: 'serve',
  prints: 'serve',
  transport: 'setup',
};

/** Human copy per family (brand voice, no jargon). */
export const DAY_OF_FAMILY_META: Record<
  DayOfFamily,
  { label: string; blurb: string }
> = {
  coordinate: {
    label: 'Run the floor',
    blurb:
      'Follow the live run-of-show, keep the vendors moving, and keep a clean record of anything that comes up.',
  },
  capture: {
    label: 'Capture the day',
    blurb:
      'Your shot list against the couple’s live timeline, and a quick way to hand galleries over as you go.',
  },
  serve: {
    label: 'Serve the guests',
    blurb:
      'Live headcount and a per-guest checklist so you know who’s had theirs and who’s still waiting.',
  },
  perform: {
    label: 'Run your set',
    blurb: 'Your set against the couple’s run-of-show, so you go on knowing the room.',
  },
  setup: {
    label: 'Set the room',
    blurb: 'Your booking brief and the day’s timeline, with a clean handover when your part is done.',
  },
};

/**
 * The family a vendor is operating in for a given event. Deterministic priority
 * when a vendor carries tiles across several folders (a planner who also shoots
 * lands on Coordinate — the superset floor view — not the shot list):
 *   coordinate > capture > serve > perform > setup
 *
 * `eventTiles`, when provided, narrows the vendor's tiles to the ones actually
 * booked on THIS event (so a multi-category vendor booked only as florist gets
 * the setup family, not their photo family). When null, all of the vendor's
 * tiles are considered.
 */
export function resolveDayOfFamily(
  services: readonly string[] | null | undefined,
  eventTiles?: readonly string[] | null,
): DayOfFamily {
  const families = familiesForServices(services, eventTiles);
  for (const fam of DAY_OF_FAMILY_ORDER) {
    if (families.has(fam)) return fam;
  }
  return 'setup';
}

/** The full set of families a vendor's (event-scoped) tiles touch. */
export function familiesForServices(
  services: readonly string[] | null | undefined,
  eventTiles?: readonly string[] | null,
): Set<DayOfFamily> {
  const out = new Set<DayOfFamily>();
  const eventSet = eventTiles ? new Set(eventTiles) : null;
  for (const s of services ?? []) {
    if (eventSet && !eventSet.has(s)) continue;
    const folder = TILE_PARENT[s as WeddingTile];
    if (folder) out.add(FOLDER_FAMILY[folder]);
  }
  return out;
}

// ─── Modules ────────────────────────────────────────────────────────────────

/**
 * Every day-of module the launcher can switch on. `defaultOnFor` lists the
 * families it lights up for out of the box; `alwaysAvailable` modules can be
 * toggled on by any vendor regardless of family. `requiresGrant` marks modules
 * whose launched surface can be handed to day-of crew (drives whether the
 * access step — step 3 — surfaces at all).
 */
export type DayOfModuleId =
  | 'run_of_show'
  | 'pax_headcount'
  | 'delivery_handover'
  | 'review_qr'
  | 'live_reviews'
  | 'qr_scanner'
  | 'shot_list'
  | 'setlist'
  | 'issues_log'
  | 'production_sheet'
  | 'vendor_papic'
  | 'guest_delivery';

export type DayOfModule = {
  id: DayOfModuleId;
  label: string;
  blurb: string;
  /** Families this module is ON for by default. */
  defaultOnFor: readonly DayOfFamily[];
  /** Any vendor may switch it on even outside its default families. */
  alwaysAvailable: boolean;
  /** Its launched surface can be delegated to crew → step 3 shows when on. */
  requiresGrant: boolean;
  /**
   * Gated behind the DPO/NPC consent-chain ruling (guest-PI capture). Rendered
   * with the consent gate + always-on NSFW filter; never silently on.
   */
  counselGated?: boolean;
};

export const DAY_OF_MODULES: readonly DayOfModule[] = [
  {
    id: 'run_of_show',
    label: 'Run of show & countdown',
    blurb: 'The couple’s live timeline, with the next moment counting down.',
    defaultOnFor: ['coordinate', 'capture', 'serve', 'perform', 'setup'],
    alwaysAvailable: true,
    requiresGrant: false,
  },
  {
    id: 'pax_headcount',
    label: 'Headcount',
    blurb: 'Attending of invited, live from the couple’s RSVPs.',
    defaultOnFor: ['coordinate', 'serve', 'capture'],
    alwaysAvailable: true,
    requiresGrant: false,
  },
  {
    id: 'delivery_handover',
    label: 'Hand over to the couple',
    blurb: 'Mark your deliverable done and let the couple acknowledge it.',
    defaultOnFor: ['coordinate', 'capture', 'serve', 'perform', 'setup'],
    alwaysAvailable: true,
    requiresGrant: false,
  },
  {
    id: 'review_qr',
    label: 'Review QR',
    blurb: 'A QR that sends your couple to confirm delivery and rate the booking.',
    defaultOnFor: ['coordinate', 'capture', 'serve', 'perform', 'setup'],
    alwaysAvailable: true,
    requiresGrant: false,
  },
  {
    id: 'live_reviews',
    label: 'Live reviews',
    blurb: 'Your reviews as they land — private to you, read-only, after completion.',
    defaultOnFor: ['coordinate', 'capture', 'serve', 'perform', 'setup'],
    alwaysAvailable: true,
    requiresGrant: false,
  },
  {
    id: 'qr_scanner',
    label: 'QR scanner',
    blurb: 'Scan a guest’s QR to look them up or mark a hand-off.',
    defaultOnFor: ['coordinate', 'serve'],
    alwaysAvailable: true,
    requiresGrant: true,
  },
  {
    id: 'shot_list',
    label: 'Shot list',
    blurb: 'Your must-get shots, checked off as you shoot.',
    defaultOnFor: ['capture'],
    alwaysAvailable: false,
    requiresGrant: true,
  },
  {
    id: 'setlist',
    label: 'Setlist',
    blurb: 'Your set against the couple’s requests.',
    defaultOnFor: ['perform'],
    alwaysAvailable: false,
    requiresGrant: false,
  },
  {
    id: 'issues_log',
    label: 'Issues log',
    blurb: 'Log anything that comes up on the floor.',
    defaultOnFor: ['coordinate'],
    alwaysAvailable: true,
    requiresGrant: true,
  },
  {
    id: 'production_sheet',
    label: 'Production sheet',
    blurb: 'Per-part pax and your portion math.',
    defaultOnFor: ['serve'],
    alwaysAvailable: false,
    requiresGrant: false,
  },
  {
    id: 'vendor_papic',
    label: 'Papic capture',
    blurb:
      'Shoot photos and clips of the event you’re working. Free Papic Lite (20 photos); Papic Ltd (70 pts, photos + video) when you accepted the booking with a token.',
    defaultOnFor: ['capture'],
    alwaysAvailable: true,
    requiresGrant: true,
    counselGated: true,
  },
  {
    id: 'guest_delivery',
    label: 'Who’s received theirs',
    blurb: 'A per-guest checklist of who has and hasn’t received your product.',
    defaultOnFor: ['serve'],
    alwaysAvailable: false,
    requiresGrant: true,
    counselGated: true,
  },
];

const MODULE_BY_ID: Record<DayOfModuleId, DayOfModule> = Object.fromEntries(
  DAY_OF_MODULES.map((m) => [m.id, m]),
) as Record<DayOfModuleId, DayOfModule>;

export function getModule(id: DayOfModuleId): DayOfModule {
  return MODULE_BY_ID[id];
}

/**
 * The modules available to a vendor for an event, each flagged with whether it
 * is ON given (a) code defaults for the vendor's families and (b) the vendor's
 * saved override for this booking. A module is *available* if it defaults on for
 * one of the vendor's families OR is `alwaysAvailable`.
 *
 * `override` is the persisted `enabled_modules` list from `vendor_dayof_configs`
 * (null/undefined = no override row → pure code defaults). When an override
 * exists it is authoritative for the modules it names; unnamed available modules
 * fall back to their default state so a newly-added module isn't hidden by an
 * old saved config.
 */
export type ResolvedModule = DayOfModule & {
  available: boolean;
  defaultOn: boolean;
  enabled: boolean;
};

export function resolveModules(
  services: readonly string[] | null | undefined,
  eventTiles: readonly string[] | null | undefined,
  override?: readonly string[] | null,
): ResolvedModule[] {
  const families = familiesForServices(services, eventTiles ?? null);
  const overrideSet = override ? new Set(override) : null;
  return DAY_OF_MODULES.map((m) => {
    const defaultOn = m.defaultOnFor.some((f) => families.has(f));
    const available = defaultOn || m.alwaysAvailable;
    const enabled = overrideSet
      ? overrideSet.has(m.id)
      : defaultOn;
    return { ...m, available, defaultOn, enabled: available && enabled };
  }).filter((m) => m.available);
}

/** True when the access step (step 3) is worth showing: some enabled module is
 *  delegable to crew. */
export function anyGrantModuleEnabled(resolved: readonly ResolvedModule[]): boolean {
  return resolved.some((m) => m.enabled && m.requiresGrant);
}
