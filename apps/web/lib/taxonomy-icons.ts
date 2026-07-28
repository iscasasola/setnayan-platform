/**
 * taxonomy-icons.ts — one Lucide icon per taxonomy tile.
 *
 * Explore Replan PR-B (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-B,
 * decision #5): the Coverage Strip is ICON tiles, and the icons are **Lucide**
 * — the repo's locked icon framework. The playable prototype draws emoji
 * (⛪ 🎂 🍽️ …); those are PLACEHOLDERS for the design conversation only.
 *
 * WHY A SEPARATE MODULE (and not appended beside `WEDDING_TILE_LABEL` in
 * `lib/taxonomy.ts`): taxonomy.ts is pure data + types with ZERO runtime
 * dependencies, and it is imported by server resolvers, RSC pages and plain
 * `node:test` unit suites that run outside a bundler. A tile → icon COMPONENT
 * map is a runtime `lucide-react` import; folding it into taxonomy.ts would drag
 * the icon package into every one of those consumers. Keeping it here leaves
 * taxonomy.ts dependency-free and the icon set tree-shakeable, and it sits
 * next to taxonomy.ts alphabetically so it is trivially discoverable.
 *
 * The record is EXHAUSTIVE over `WeddingTile` (no index signature, no fallback)
 * so adding a tile to the taxonomy is a COMPILE ERROR here until it gets an
 * icon — the strip can never silently render a blank circle.
 *
 * A handful of icons repeat (the four attire tiles, the two insurance tiles):
 * Lucide has no distinct glyph for "groom's barong" vs "men's attire", and an
 * honest repeat beats an unrelated glyph. The two-line label under the tile is
 * what disambiguates.
 */

import {
  Aperture,
  Armchair,
  Baby,
  Brush,
  Building2,
  Bus,
  Cake,
  CalendarDays,
  Camera,
  Car,
  ChefHat,
  Church,
  ClipboardCheck,
  ClipboardList,
  Coffee,
  Compass,
  Crown,
  CupSoda,
  Disc,
  Disc3,
  Drama,
  Dumbbell,
  Flag,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Guitar,
  Hand,
  HeartPulse,
  IceCreamCone,
  Laptop,
  Lightbulb,
  Mail,
  Map,
  Martini,
  Megaphone,
  Mic,
  MonitorPlay,
  Moon,
  Music,
  Music4,
  Newspaper,
  Paintbrush,
  Palette,
  PartyPopper,
  PenTool,
  Plane,
  Presentation,
  Printer,
  Radio,
  Ribbon,
  Scissors,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Sparkles,
  SprayCan,
  Stamp,
  Stethoscope,
  Tent,
  TreePine,
  Trophy,
  Truck,
  Umbrella,
  Users,
  Utensils,
  UtensilsCrossed,
  Video,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

import type { WeddingFolder, WeddingTile } from '@/lib/taxonomy';

/** Tile → Coverage Strip icon. Exhaustive over `WeddingTile` by construction. */
export const WEDDING_TILE_ICON: Record<WeddingTile, LucideIcon> = {
  // VENUE
  reception: PartyPopper,
  ceremony_venue: Church,
  // PLANNING
  coordinator: ClipboardList,
  date_specialist: CalendarDays,
  // FEAST
  cake: Cake,
  catering: UtensilsCrossed,
  stations: ChefHat,
  crew_meals: Utensils,
  // DESIGN
  stylist_decorator: Palette,
  florist: Flower2,
  lights_sound: Lightbulb,
  dance_floor: Disc3,
  outdoor: TreePine,
  fireworks: Sparkles,
  led_wall: MonitorPlay,
  digital_services: Laptop,
  // PROGRAM
  live_band: Guitar,
  choir: Users,
  orchestra: Music4,
  wedding_singer: Mic,
  dj: Disc,
  choreographer: Footprints,
  performers: Drama,
  host_mc: Megaphone,
  av_production: Video,
  speaker_talent: Presentation,
  kids_entertainer: Baby,
  // DOCUMENTARY
  photo_video: Camera,
  editorial: Newspaper,
  livestream: Radio,
  // LOOK
  brides_attire: Crown,
  grooms_attire: Shirt,
  womens_attire: Ribbon,
  mens_attire: Shirt,
  filipiniana_barongs: Shirt,
  hmua: Brush,
  grooming: Scissors,
  wellness_fitness: Dumbbell,
  jewelleries_accessories: Gem,
  // BOOTHS
  mobile_bar: Martini,
  coffee_espresso: Coffee,
  mocktail: CupSoda,
  food_truck: Truck,
  dessert: IceCreamCone,
  massage_chair: Armchair,
  food_cart: ShoppingCart,
  photo_booth: Aperture,
  perfume_bar: SprayCan,
  arcade_games: Gamepad2,
  henna_tattoo: PenTool,
  mini_nail_bar: Hand,
  tarot_astrology_palmistry: Moon,
  caricature_calligraphy_painting: Paintbrush,
  engraving_embroidery: Stamp,
  // PRINTS
  printing: Printer,
  souvenir_giveaways: Gift,
  trophies_awards: Trophy,
  // TRANSPORT
  bridal_car: Car,
  guest_shuttle: Bus,
  escort: ShieldCheck,
  // EXPERIENCE
  tour_activity: Map,
  tour_guide: Flag,
  // DINING
  restaurant_reservation: Utensils,
  // LOGISTICS & SAFETY
  referee_official: ClipboardCheck,
  event_medic: Stethoscope,
  // INSURANCE & PROTECTION
  event_insurance: Shield,
  personal_accident_insurance: HeartPulse,
  travel_insurance: Plane,
  // SPECIALTY
  reveal_element: Wand2,
};

/**
 * Icon for a tile string that may not be a known `WeddingTile` (the Shortlist
 * model types `tile` as `WeddingTile`, but the strip also renders from
 * DB-driven taxonomy snapshots). Unknown → `Sparkles`, never a blank circle.
 */
export function tileIcon(tile: string): LucideIcon {
  return WEDDING_TILE_ICON[tile as WeddingTile] ?? Sparkles;
}

/**
 * Folder → icon. One glyph per PARENT folder, the coarse sibling of
 * `WEDDING_TILE_ICON` above.
 *
 * PROVENANCE — this map is NOT new. It shipped as a private `FOLDER_ICON` const
 * inside `app/explore/_components/icon-tile-folder-strip.tsx`, and the icons
 * below are that map verbatim. It was lifted here (2026-07-28) when the Explore
 * bench folder rows needed the same glyphs: the strip is a `'use client'`
 * module, and re-exporting a plain data table out of a client module is the
 * documented RSC hazard, so the SSOT moves to this plain module and BOTH
 * surfaces import it. No icon changed in the move.
 *
 * The original hand-picking rationale, preserved:
 *   - Venue → Building2 (reception + ceremony venues)
 *   - Planning → ClipboardList (coordinators)
 *   - Feast → UtensilsCrossed (cake · catering · stations)
 *   - Design → Flower2 (stylist · florals · lights · LED · fireworks)
 *   - Program → Music (band · choir · DJ · performers · host)
 *   - Documentary → Camera (photo & video · editorial · livestream)
 *   - Look → Shirt (attire · HMUA · grooming · jewellery)
 *   - Booths → Tent (food carts · photo booths · experiential)
 *   - Prints → Mail (printing · souvenirs)
 *   - Transport → Car (bridal car · shuttle · escort)
 * and the non-wedding event-type families (gap leaves, 2026-07-20):
 *   - Experience → Compass · Dining → Utensils · Logistics & Safety →
 *     ShieldCheck · Insurance → Umbrella · Specialty → Sparkles
 *
 * Exhaustive over `WeddingFolder` — a new folder is a COMPILE ERROR here until
 * it gets an icon.
 */
export const WEDDING_FOLDER_ICON: Record<WeddingFolder, LucideIcon> = {
  venue: Building2,
  planning: ClipboardList,
  feast: UtensilsCrossed,
  design: Flower2,
  program: Music,
  documentary: Camera,
  look: Shirt,
  booths: Tent,
  prints: Mail,
  transport: Car,
  experience: Compass,
  dining: Utensils,
  logistics_safety: ShieldCheck,
  insurance: Umbrella,
  specialty: Sparkles,
};

/**
 * Icon for a folder string that may not be a known `WeddingFolder` (the bench
 * renders from DB-driven taxonomy snapshots). Unknown → `Sparkles`, matching
 * `tileIcon`'s never-a-blank-slot contract.
 */
export function folderIcon(folder: string): LucideIcon {
  return WEDDING_FOLDER_ICON[folder as WeddingFolder] ?? Sparkles;
}
