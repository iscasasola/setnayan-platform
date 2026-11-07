import { parentsOfCategory } from '@/lib/vendor-category-parents';
import type { WeddingFolder } from '@/lib/taxonomy';
import type { VendorCategory } from '@/lib/vendors';

/**
 * supplier-access-by-category.ts — WHAT A BOOKED SUPPLIER CAN SEE OF AN EVENT,
 * BY THE KIND OF SUPPLIER THEY ARE. **DISPLAY ONLY.**
 *
 * ⛔ THIS FILE GRANTS NOTHING. It is the words a screen may show ("Photos ·
 * Schedule: View"). The SECURITY DEFINER RPCs and RLS policies enforce, and
 * they are the source of truth: `get_vendor_event_brief` · `get_vendor_seat_plan`
 * · `get_vendor_mood_board` · `papic_vendor_challenge_photos` · the
 * `event_schedule_blocks_booked_vendor_read` policy. Changing a row here
 * changes a sentence, never a permission.
 *
 * 📄 MIRRORS Setnayan-specs `03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md`
 * § 7, the DECISION_LOG row "SUPPLIER ACCESS MAP — FOUR ADDITIONS" (2026-10-03)
 * and the row after it, and `SUPPLIER_PHOTO_ACCESS_2026-10-03_fable.md`.
 * **Where that doc and the RPC disagree, this file follows the RPC** — a
 * screen that promises more than the server hands over is a failure that
 * renders like success. `supplier-access-by-category.test.ts` reads the
 * latest migration defining each RPC and fails when the two drift.
 *
 * 🔑 WHAT THE CODE ACTUALLY GATES BY CATEGORY IS TWO THINGS:
 *   · Seat plan — `get_vendor_seat_plan` refuses any category outside its
 *     floor list (`category_not_floor`).
 *   · Guest list — COUNTS ONLY (meal / dietary counts, per table on the seat
 *     plan). Never a name: names stay coordinator-only (RA 10173). Every
 *     supplier's brief carries the head count; that is not this area.
 * Everything else below is handed to every supplier on the event, whatever
 * their category, so it sits in `EVERY_SUPPLIER`.
 *
 * Not granted to any category, on purpose:
 *   · Edit, anywhere — a coordinator edits through the delegate grants
 *     (`moderator_area_level`), which come from being PROMOTED, not from a
 *     category (doc § 3).
 *   · Budget & payments — the brief's budget band shows only when the couple
 *     turns on `share_budget_band`; it is the couple's switch, not a default.
 *   · Event Hub — a supplier's Event Hub entry is the QR scan menu (DECISION_LOG
 *     2026-10-03, the row withdrawing the crew view), a tool, not a view of the
 *     couple's Hub.
 *
 * Sub-categories resolve to their parent via `parentsOfCategory`; the two
 * category-gated areas are then decided per category, exactly as the RPC does.
 */

/** The areas a supplier may be shown. A closed set. */
export const SUPPLIER_ACCESS_AREAS = [
  'Guest list',
  'Seat plan',
  'The Day',
  'Suppliers',
  'Event Hub',
  'Mood Board',
  'Budget & payments',
  'Photos',
  'Schedule',
] as const;
export type SupplierAccessArea = (typeof SUPPLIER_ACCESS_AREAS)[number];

export const SUPPLIER_ACCESS_LEVELS = ['view', 'edit'] as const;
export type SupplierAccessLevel = (typeof SUPPLIER_ACCESS_LEVELS)[number];

export type SupplierAccess = {
  readonly area: SupplierAccessArea;
  readonly level: SupplierAccessLevel;
};

/**
 * Mirrors `v_floor_allowed` in the latest `get_vendor_seat_plan`.
 * ⚠ `security` has no parent family, so it is reachable only through this list.
 */
export const SEAT_PLAN_CATEGORIES: readonly VendorCategory[] = [
  'venue', 'catering', 'cake_maker', 'mobile_bar', 'photobooth',
  'led_screens', 'lights_and_sound', 'reception_decor', 'florist',
  'photographer', 'videographer', 'host_emcee', 'band_dj',
  'string_quartet', 'choir', 'planner_coordinator',
  'gown_designer', 'suit_designer', 'makeup_artist', 'hair_stylist',
  'security',
];

/** Mirrors the dietary gate in `get_vendor_event_brief` and `get_vendor_seat_plan`. */
export const MEAL_COUNT_CATEGORIES: readonly VendorCategory[] = [
  'catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator',
];

/** The two areas the RPCs decide per category, not per parent. */
const CATEGORY_GATED: ReadonlySet<SupplierAccessArea> = new Set(['Seat plan', 'Guest list']);

/**
 * Handed to every supplier on the event, whatever their category:
 *   · Schedule — the brief's full day-of timeline (locked D2) and the
 *     booked-supplier RLS read; only coordinator-only prep is held back.
 *     Changes go in as requests the couple approves, so this is View.
 *   · Mood Board — `get_vendor_mood_board` checks the supplier is on the event,
 *     not what kind of supplier it is.
 *   · Suppliers — the brief's roster of the other booked suppliers.
 *   · Photos — the supplier's own shots and the Challenge photos a guest chose
 *     to share with them (`papic_vendor_challenge_photos`); never the couple's
 *     gallery.
 *   · The Day — the On the day console; every family has one
 *     (`lib/vendor-dayof-modules.ts`).
 */
const EVERY_SUPPLIER: readonly SupplierAccess[] = [
  { area: 'The Day', level: 'view' },
  { area: 'Suppliers', level: 'view' },
  { area: 'Mood Board', level: 'view' },
  { area: 'Photos', level: 'view' },
  { area: 'Schedule', level: 'view' },
];

const SEAT_PLAN: SupplierAccess = { area: 'Seat plan', level: 'view' };
const GUEST_COUNTS: SupplierAccess = { area: 'Guest list', level: 'view' };

/**
 * Parent family → what its suppliers can be shown. Seat plan / Guest list are
 * listed where at least one category in the family gets them; a category the
 * RPC refuses inside that family is narrowed by `supplierAccessFor`.
 */
export const SUPPLIER_ACCESS_BY_PARENT: Readonly<Record<WeddingFolder, readonly SupplierAccess[]>> = {
  venue: [GUEST_COUNTS, SEAT_PLAN, ...EVERY_SUPPLIER],
  planning: [GUEST_COUNTS, SEAT_PLAN, ...EVERY_SUPPLIER],
  feast: [GUEST_COUNTS, SEAT_PLAN, ...EVERY_SUPPLIER],
  design: [SEAT_PLAN, ...EVERY_SUPPLIER],
  program: [SEAT_PLAN, ...EVERY_SUPPLIER],
  documentary: [SEAT_PLAN, ...EVERY_SUPPLIER],
  look: [SEAT_PLAN, ...EVERY_SUPPLIER],
  booths: [GUEST_COUNTS, SEAT_PLAN, ...EVERY_SUPPLIER],
  prints: [...EVERY_SUPPLIER],
  transport: [...EVERY_SUPPLIER],
  experience: [...EVERY_SUPPLIER],
  dining: [...EVERY_SUPPLIER],
  logistics_safety: [...EVERY_SUPPLIER],
  insurance: [...EVERY_SUPPLIER],
  specialty: [...EVERY_SUPPLIER],
  farewell: [...EVERY_SUPPLIER],
};

const LEVEL_RANK: Record<SupplierAccessLevel, number> = { view: 1, edit: 2 };

/** What a supplier of this category can be shown, in `SUPPLIER_ACCESS_AREAS` order. */
export function supplierAccessFor(category: VendorCategory): SupplierAccess[] {
  const levels = new Map<SupplierAccessArea, SupplierAccessLevel>();
  const put = ({ area, level }: SupplierAccess) => {
    const had = levels.get(area);
    if (!had || LEVEL_RANK[level] > LEVEL_RANK[had]) levels.set(area, level);
  };
  EVERY_SUPPLIER.forEach(put);
  for (const parent of parentsOfCategory(category)) {
    const rows = SUPPLIER_ACCESS_BY_PARENT[parent as WeddingFolder] ?? [];
    rows.filter((r) => !CATEGORY_GATED.has(r.area)).forEach(put);
  }
  if (SEAT_PLAN_CATEGORIES.includes(category)) put(SEAT_PLAN);
  if (MEAL_COUNT_CATEGORIES.includes(category)) put(GUEST_COUNTS);
  return SUPPLIER_ACCESS_AREAS.filter((a) => levels.has(a)).map((area) => ({
    area,
    level: levels.get(area)!,
  }));
}

/** Plain words for a screen, e.g. "Photos · Schedule: View". */
export function supplierAccessWords(category: VendorCategory): string {
  const rows = supplierAccessFor(category);
  const group = (level: SupplierAccessLevel, word: string) => {
    const areas = rows.filter((r) => r.level === level).map((r) => r.area);
    return areas.length ? `${areas.join(' · ')}: ${word}` : null;
  };
  const parts = [group('edit', 'Edit'), group('view', 'View')].filter(Boolean);
  return parts.length ? parts.join('; ') : 'No access';
}
