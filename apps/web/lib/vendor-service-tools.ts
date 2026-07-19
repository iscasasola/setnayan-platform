/**
 * My Services page — presentational maps for the reskinned (proto-shell)
 * services surface: a per-category ICON for the "Your services" rows + the
 * SERVICE-COVERAGE chips, and the CATEGORY-CONDITIONAL specialist-tool cards.
 *
 * Pure UI mapping — no DB, no money, no writes. The category vocabulary is the
 * couple/vendor-facing `VendorCategory` enum (lib/vendors.ts), which is the
 * exact value stored on `vendor_services.category`. A new VendorCategory fails
 * the build until it gets an icon here (the Record is exhaustive), so a row
 * never renders without a glyph.
 *
 * Icons are drawn from lucide-react. Every glyph named here is already in the
 * curated nav-icon allowlist (lib/nav-icons.ts) so the "one skeletal Lucide set
 * site-wide" rule holds — but this module imports from lucide-react directly
 * (the allowlist only gates NAV CHROME, not page bodies).
 */

import type { LucideIcon } from 'lucide-react';
import {
  Aperture,
  Armchair,
  BadgeCheck,
  Bed,
  Building2,
  Bus,
  Cake,
  Camera,
  Church,
  Compass,
  Crown,
  Cross,
  Flag,
  Flower2,
  Gem,
  Gift,
  Handshake,
  HardHat,
  Lightbulb,
  Mail,
  Map,
  Martini,
  Mic,
  MonitorPlay,
  Music,
  Palette,
  PartyPopper,
  Scissors,
  Shield,
  ShieldCheck,
  Shirt,
  Sparkles,
  Umbrella,
  Users,
  Utensils,
  Video,
  Wrench,
} from 'lucide-react';

import type { VendorCategory } from './vendors';

/**
 * One skeletal Lucide glyph per canonical vendor category — used for the
 * "Your services" row leading icon + the coverage chips.
 */
export const VENDOR_CATEGORY_ICON: Record<VendorCategory, LucideIcon> = {
  venue: Building2,
  religious_venue: Church,
  catering: Utensils,
  crew_meals: Utensils,
  photographer: Camera,
  videographer: Video,
  florist: Flower2,
  cake_maker: Cake,
  host_emcee: Users,
  band_dj: Music,
  string_quartet: Music,
  choir: Music,
  officiant: Church,
  planner_coordinator: BadgeCheck,
  makeup_artist: Sparkles,
  hair_stylist: Scissors,
  gown_designer: Crown,
  suit_designer: Shirt,
  rings: Gem,
  invitations_stationery: Mail,
  transportation: Bus,
  lights_and_sound: Lightbulb,
  led_screens: MonitorPlay,
  photobooth: Aperture,
  mobile_bar: Martini,
  church_fees: Church,
  reception_decor: Armchair,
  security: Shield,
  gifts_and_giveaways: Gift,
  accommodation: Bed,
  // Non-wedding event-type gap leaves (2026-07-20 · §gap-leaves):
  referee_official: Flag,
  event_medic: Cross,
  tour_activity: Compass,
  tour_guide: Map,
  travel_insurance: Umbrella,
  av_production: MonitorPlay,
  speaker_talent: Mic,
  performers: Music,
  kids_entertainer: PartyPopper,
  choreographer: Users,
  reveal_element: Sparkles,
  event_insurance: ShieldCheck,
  personal_accident_insurance: Umbrella,
  restaurant_reservation: Utensils,
  misc: Wrench,
};

/** Resolve a category's icon, defaulting to the generic wrench for a stray key. */
export function iconForVendorCategory(category: string): LucideIcon {
  return VENDOR_CATEGORY_ICON[category as VendorCategory] ?? Wrench;
}

/**
 * A category-conditional specialist tool. Rendered as a card in the
 * "SPECIALIST TOOLS" section ONLY when the vendor has ≥1 service in one of the
 * tool's `categories`. Each maps to a real, already-shipped vendor-dashboard
 * route — no dead links.
 */
export type SpecialistTool = {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Show this tool when the vendor offers any service in these categories. */
  categories: ReadonlyArray<VendorCategory>;
};

/**
 * The specialist-tool catalog. Order is stable so the section reads the same
 * every load. Each `href` targets a live route:
 *   /vendor-dashboard/moodboard-library — the stylist moodboard designer
 *   /vendor-dashboard/repertoire        — the music-act song bank / setlist
 *   /vendor-dashboard/on-the-day        — the category-tuned day-of console
 *   /vendor-dashboard/recaps            — post-event highlight recaps
 *   /vendor-dashboard/manpower          — host-paid crew gigs on linked events
 */
export const SPECIALIST_TOOLS: ReadonlyArray<SpecialistTool> = [
  {
    key: 'moodboard',
    title: 'Moodboard designer',
    description:
      'Build recolourable moodboard sets couples can match to their palette.',
    href: '/vendor-dashboard/moodboard-library',
    icon: Palette,
    // OWNER-LOCKED 2026-07-12: "this can only be done by a stylist — that is
    // a collection of their own mood boards." Stylist/decorator category ONLY
    // (reception_decor = the stylist_decorator tile). Do not re-broaden.
    categories: ['reception_decor'],
  },
  {
    key: 'repertoire',
    title: 'Song bank & setlist',
    description:
      'Curate the songs you play so couples can request and preview them.',
    href: '/vendor-dashboard/repertoire',
    icon: Music,
    categories: ['band_dj', 'string_quartet', 'choir'],
  },
  {
    key: 'day-of',
    title: 'On-the-day console',
    description:
      'Your live run-of-show, shot list, or floor command centre for booked events.',
    href: '/vendor-dashboard/on-the-day',
    icon: BadgeCheck,
    categories: [
      'photographer',
      'videographer',
      'planner_coordinator',
      'catering',
      'host_emcee',
      'band_dj',
      'string_quartet',
      'choir',
    ],
  },
  {
    key: 'recaps',
    title: 'Event recaps',
    description:
      'Turn a delivered event into a shareable highlight couples can re-post.',
    href: '/vendor-dashboard/recaps',
    icon: Handshake,
    categories: ['photographer', 'videographer'],
  },
  {
    key: 'manpower',
    title: 'Manpower gigs',
    description:
      'Pick up host-paid crew assignments on events you’re already linked to.',
    href: '/vendor-dashboard/manpower',
    icon: HardHat,
    // Crew-heavy service categories that deploy people on the day — the vendors
    // most likely to accept a manpower gig. Broad but service-scoped, so a
    // pure-product vendor (rings, invitations) doesn't see an irrelevant tool.
    categories: [
      'photographer',
      'videographer',
      'catering',
      'host_emcee',
      'band_dj',
      'planner_coordinator',
      'makeup_artist',
      'hair_stylist',
      'security',
      'lights_and_sound',
      'reception_decor',
      'photobooth',
      'mobile_bar',
    ],
  },
];

/**
 * The specialist tools relevant to a vendor's own service categories. Returns
 * them in catalog order; a tool surfaces once as long as ≥1 of its categories
 * overlaps the vendor's distinct categories.
 */
export function specialistToolsForCategories(
  distinctCategories: ReadonlyArray<string>,
): SpecialistTool[] {
  const owned = new Set(distinctCategories);
  return SPECIALIST_TOOLS.filter((tool) =>
    tool.categories.some((c) => owned.has(c)),
  );
}
