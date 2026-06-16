/**
 * add-ons-catalog.ts — canonical list of Setnayan in-app service add-ons.
 *
 * Single source of truth extracted 2026-06-03 so the add-ons launcher grid
 * (/dashboard/[eventId]/add-ons) and the Services tab vendor page
 * (/dashboard/[eventId]/vendors) can both import it without duplication.
 *
 * Each entry's `poster` field drives the cinema-style animated poster card in
 * the add-ons page (service-poster.tsx). The same data powers the compact grid
 * section inside the Services tab.
 *
 * When a new iteration ships, add one entry here. Never add a parallel list
 * in a page file.
 */

import {
  Receipt,
  Globe2,
  Music,
  Type,
  Camera,
  Tv,
  Gem,
  Sparkles,
  Film,
  Printer,
  ImageDown,
  QrCode,
  MapPin,
  Palette,
  Users,
  LayoutGrid,
  Wallet,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import type { PosterStyle } from '@/app/dashboard/[eventId]/add-ons/_components/service-poster';
import type { PlanGroupId } from '@/lib/wedding-plan-groups';

export type AddOnStatus = 'live' | 'web_v1' | 'coming_soon';

/**
 * Where this in-app service nests on the couple-side Vendors/Services tab
 * (Digital_Services_Cross_Surface_Map_2026-06-03.md §2 — "the Services tab
 * surfaces the services inside their canonical category, each with the ✦
 * Setnayan badge"). Resolves the 2026-06-03 lock that retired the standalone
 * launcher grid in favour of in-category placement:
 *   • a PlanGroupId → nests as a ✦ Setnayan supplementary card at the TOP of
 *     that category's rail (float-to-top), alongside the couple's vendor picks.
 *     Supplementary + non-saturating — never a "pick", no Lock/Remove.
 *   • 'digital_services' → grouped under the synthetic Design › Digital
 *     Services rail (Pakanta / Animated Monogram / Pro Website home).
 *   • 'tool' → a couple tool, not a category service (Orders / Playlist / QR /
 *     Blueprint / …). Stays out of the category pile; renders in the compact
 *     "Tools & extras" strip instead.
 */
export type InAppServiceCategory = PlanGroupId | 'digital_services' | 'tool';

/**
 * Which job-to-be-done section this add-on falls under on the couple-side
 * Studio hub (/dashboard/[eventId]/add-ons). Independent of `category` (which
 * drives the Services/vendors-tab placement) — the Studio hub groups by what
 * the couple is *trying to do*, not by vendor taxonomy.
 *   • capture        → make a record of the day (Papic / Panood / Photo / TikTok)
 *   • website_story  → the public-facing event site + branding artifacts
 *   • plan_organize  → planning aids (mood board, wayfinding)
 *   • music_extras   → music + everything else
 */
export type StudioGroup =
  | 'capture'
  | 'website_story'
  | 'plan_organize'
  | 'music_extras';

export type AddOnEntry = {
  key: string;
  label: string;
  Icon: LucideIcon;
  iteration: string;
  status: AddOnStatus;
  /** Couple-side category placement — see InAppServiceCategory. */
  category: InAppServiceCategory;
  blurb: string;
  cta: string;
  poster: PosterStyle;
  /**
   * Job-to-be-done grouping for the Studio hub (/dashboard/[eventId]/add-ons).
   * Additive — the Services tab ignores this field. See StudioGroup.
   */
  studioGroup: StudioGroup;
  /**
   * Marks a genuinely-free add-on so the Studio card can show a "Free" chip.
   * Left unset on paid items — never a price source. Pricing is admin-managed;
   * the feature's own page shows the real price + handles purchase.
   */
  tier?: 'free';
  /**
   * For a PAID add-on that offers a no-card free trial (e.g. Papic's 3-seat
   * free sampler), a short chip label surfaced on the Studio card so couples
   * can discover the trial from the grid. Never a price source — the feature
   * page still owns the real price + purchase.
   */
  freeTrial?: string;
};

/**
 * Resolve the href for a given add-on key + event ID.
 * Orders is a special case that links to /orders, not /add-ons/orders.
 */
export function addOnHref(key: string, eventId: string): string {
  return key === 'orders'
    ? `/dashboard/${eventId}/orders`
    : `/dashboard/${eventId}/add-ons/${key}`;
}

export const ADD_ONS: ReadonlyArray<AddOnEntry> = [
  {
    key: 'setnayan-ai',
    label: 'Setnayan AI',
    Icon: Gem,
    iteration: '0016',
    status: 'live',
    category: 'tool',
    blurb:
      'Ranked vendor matches by date, budget, location, guest count & faith — a shortlist made for your wedding, not a directory',
    cta: 'See your matches',
    studioGroup: 'plan_organize',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #2A1330 0%, #5A2E66 50%, #8B4A93 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #E8C8FF 0%, transparent 55%)',
      iconBadgeClass: 'bg-purple-100/15 text-purple-100',
    },
  },
  {
    key: 'orders',
    label: 'Orders',
    Icon: Receipt,
    iteration: '0034',
    status: 'live',
    category: 'tool',
    blurb: 'View your in-app purchases · reference codes · payment status',
    cta: 'View orders',
    studioGroup: 'music_extras',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 30% 70%, #F4D9B0 0%, #C97B4B 70%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FFEED0 0%, transparent 60%)',
      iconBadgeClass: 'bg-amber-50/30 text-amber-50',
    },
  },
  {
    key: 'save-the-date',
    label: 'Save the Date',
    Icon: Sparkles,
    iteration: '0024',
    status: 'live',
    category: 'photography',
    blurb:
      'The opening reveal for your page · a veil or envelope that lifts to your invitation · free, recolours to your palette',
    cta: 'Choose your reveal',
    studioGroup: 'website_story',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #2B1810 0%, #4A2E1C 50%, #6B3E25 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 220, 160, 0.7) 50%, transparent 100%)',
      iconBadgeClass: 'bg-amber-100/20 text-amber-100',
    },
  },
  {
    key: 'landing-page',
    label: 'Landing Page',
    Icon: Globe2,
    iteration: '0002',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'Customize the public landing page guests see when they scan your QR or open your link',
    cta: 'Customize',
    studioGroup: 'website_story',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(circle at 40% 40%, #1E3A4F 0%, #0F1F2D 80%)',
      motionBackground:
        'radial-gradient(circle at 60% 60%, #5BA3C7 0%, transparent 55%)',
      iconBadgeClass: 'bg-sky-100/15 text-sky-100',
    },
  },
  {
    key: 'music-creator',
    label: 'Music Creator',
    Icon: Music,
    iteration: '0034',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'Pick from Setnayan-owned music or generate a custom track for your event reels',
    cta: 'Browse music',
    studioGroup: 'music_extras',
    tier: 'free',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #1A0B2E 0%, #3D1F5C 50%, #6B3FA0 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #C8A0FF 0%, transparent 50%)',
      iconBadgeClass: 'bg-purple-100/15 text-purple-100',
    },
  },
  {
    key: 'playlist',
    label: 'Playlist',
    Icon: Music,
    iteration: '0016',
    status: 'web_v1',
    category: 'tool',
    blurb:
      "Pick songs by slot · processional · first dance · dinner · open floor · don't-play list. Synced to your DJ or band the moment you book them.",
    cta: 'Build your lineup',
    studioGroup: 'music_extras',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 50% 50%, #4A2E1C 0%, #1A1A1A 80%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #F4D9B0 0%, transparent 55%)',
      iconBadgeClass: 'bg-amber-100/20 text-amber-100',
    },
  },
  {
    // Pakanta — a custom song written for the couple. The song is composed
    // from the onboarding love story (lib/pakanta-brief.ts); the page only
    // collects the music top-up. Couple surface: /add-ons/pakanta.
    key: 'pakanta',
    label: 'Pakanta',
    Icon: Music,
    iteration: '0036',
    status: 'live',
    category: 'digital_services',
    blurb: 'A custom song for your wedding — written from the love story you told us',
    cta: 'Create your song',
    studioGroup: 'music_extras',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #2A0E2E 0%, #5C1F4A 50%, #A03F6B 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FFC8E6 0%, transparent 50%)',
      iconBadgeClass: 'bg-pink-100/15 text-pink-100',
    },
  },
  {
    key: 'animated-monogram',
    label: 'Monogram Creator',
    Icon: Type,
    iteration: '0004',
    status: 'web_v1',
    category: 'digital_services',
    blurb:
      'Design your wedding monogram · animated SVG trace · custom hero background',
    cta: 'Open studio',
    studioGroup: 'website_story',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #1A1A1A 0%, #2B2B2B 50%, #3F3F3F 100%)',
      motionBackground:
        'radial-gradient(ellipse at 50% 40%, #FAF6F0 0%, transparent 55%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  {
    key: 'custom-qr-guest',
    label: 'Custom QR per guest',
    Icon: QrCode,
    iteration: '0002',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'A branded QR for every guest · your monogram + palette colors · print-ready',
    cta: 'Brand my QRs',
    studioGroup: 'website_story',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #2B1810 0%, #5A2818 55%, #C97B4B 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FAF6F0 0%, transparent 50%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  {
    key: 'papic',
    label: 'Papic',
    Icon: Camera,
    iteration: '0012',
    status: 'web_v1',
    category: 'photography',
    blurb: 'Candid capture · gesture shutter · QR tagging · personal reels',
    cta: 'Set up',
    studioGroup: 'capture',
    freeTrial: 'Free to try',
    poster: {
      motion: 'pulse',
      baseBackground:
        'radial-gradient(circle at 50% 45%, #C97B4B 0%, #5A2818 75%)',
      motionBackground:
        'radial-gradient(circle at 50% 45%, #F4D9B0 0%, transparent 40%)',
      iconBadgeClass: 'bg-terracotta/40 text-cream',
    },
  },
  {
    key: 'panood',
    label: 'Panood',
    Icon: Tv,
    iteration: '0011',
    status: 'web_v1',
    category: 'photography',
    blurb: 'Live stream · YouTube delivery · AI Highlights · Same-Day Edit',
    cta: 'Set up',
    studioGroup: 'capture',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #1F0808 0%, #4A1212 50%, #8B1A1A 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 90, 90, 0.8) 50%, transparent 100%)',
      iconBadgeClass: 'bg-rose-100/15 text-rose-50',
    },
  },
  {
    key: 'photo-delivery',
    label: 'Photo Delivery',
    Icon: ImageDown,
    iteration: '0009',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'Connect Google Drive · photographer post-event handoff · share albums with guests',
    cta: 'Set up',
    studioGroup: 'capture',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 30% 30%, #2E5C8A 0%, #0F2540 80%)',
      motionBackground:
        'radial-gradient(circle at 70% 60%, #A0D8F5 0%, transparent 55%)',
      iconBadgeClass: 'bg-blue-100/15 text-blue-100',
    },
  },
  {
    key: 'patiktok',
    label: 'Patiktok',
    Icon: Film,
    iteration: '0017',
    status: 'web_v1',
    category: 'photobooth',
    blurb: 'Vertical-reel template gallery · render-on-demand · 9:16 1080p MP4',
    cta: 'Browse templates',
    studioGroup: 'capture',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 50%, #2E1F4E 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 100, 180, 0.7) 30%, rgba(100, 220, 255, 0.7) 70%, transparent 100%)',
      iconBadgeClass: 'bg-pink-100/15 text-pink-100',
    },
  },
  {
    key: 'supplies-marketplace',
    label: 'Paprint',
    Icon: Printer,
    iteration: '0018',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'Wedding-day print pack + favors from vetted PH suppliers — direct to your venue',
    cta: 'Browse Paprint',
    studioGroup: 'music_extras',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #6B5638 0%, #8B7A5A 50%, #A89678 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(250, 246, 240, 0.85) 50%, transparent 100%)',
      iconBadgeClass: 'bg-cream/25 text-cream',
    },
  },
  {
    key: 'led',
    label: 'LED Background',
    Icon: Sparkles,
    iteration: '0005',
    status: 'web_v1',
    category: 'led_background',
    blurb: '8K template render · Photo Pool blend · USB delivery',
    cta: 'Choose template',
    studioGroup: 'website_story',
    poster: {
      motion: 'pulse',
      baseBackground:
        'radial-gradient(circle at 50% 50%, #0F2A4A 0%, #050D1F 80%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #4FFFE0 0%, rgba(80, 200, 255, 0.5) 25%, transparent 55%)',
      iconBadgeClass: 'bg-cyan-100/20 text-cyan-50',
    },
  },
  {
    key: 'indoor-blueprint',
    label: 'Indoor Blueprint',
    Icon: MapPin,
    iteration: '0008',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'Your seating chart, turned into wayfinding · each guest finds their table from the entrance',
    cta: 'Map my venue',
    studioGroup: 'plan_organize',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #1A1410 0%, #3A281C 55%, #6B4A30 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 60%, #F4D9B0 0%, transparent 50%)',
      iconBadgeClass: 'bg-amber-100/20 text-amber-100',
    },
  },
  {
    key: 'mood-board',
    label: 'Mood Board',
    Icon: Palette,
    iteration: '0010',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'Your event palette · role + venue color stories · curated theme templates',
    cta: 'Open board',
    studioGroup: 'plan_organize',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #3A2B4F 0%, #5C3A6B 50%, #8A5A8F 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #F4C8E0 0%, transparent 55%)',
      iconBadgeClass: 'bg-fuchsia-100/15 text-fuchsia-50',
    },
  },
];

/**
 * A free core planning tool surfaced in the Studio hub's "Plan & organize"
 * group. These deep-link to existing couple-sidebar routes (Guests / Seating /
 * Budget / Schedule) rather than to an /add-ons/[feature] detail page.
 *
 * Kept SEPARATE from ADD_ONS on purpose — these are first-class sidebar
 * surfaces, not in-app *services*, so they must NOT appear in the
 * Services/vendors tab (which iterates ADD_ONS). The Studio hub merges
 * STUDIO_FREE_TOOLS into its "Plan & organize" section at render time.
 */
export type StudioFreeTool = {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** One-line benefit, JTBD-framed. */
  blurb: string;
  /** Absolute href into the existing couple sidebar route. */
  href: string;
  /** Always free — drives the "Free" chip on the Studio card. */
  tier: 'free';
};

/**
 * Build the free-tool list for a given event. href is event-scoped, so this is
 * a factory rather than a static const.
 */
export function studioFreeTools(eventId: string): ReadonlyArray<StudioFreeTool> {
  return [
    {
      key: 'guests',
      label: 'Guest list',
      Icon: Users,
      blurb: 'Build your list, track RSVPs, and assign roles in one place',
      href: `/dashboard/${eventId}/guests`,
      tier: 'free',
    },
    {
      key: 'seating',
      label: 'Seating',
      Icon: LayoutGrid,
      blurb: 'Lay out your tables and seat every guest with drag-and-drop',
      href: `/dashboard/${eventId}/seating`,
      tier: 'free',
    },
    {
      key: 'budget',
      label: 'Budget',
      Icon: Wallet,
      blurb: 'Track every cost and payment so nothing slips through',
      href: `/dashboard/${eventId}/budget`,
      tier: 'free',
    },
    {
      key: 'schedule',
      label: 'Schedule',
      Icon: CalendarClock,
      blurb: 'Map your day-of timeline and keep every vendor in sync',
      href: `/dashboard/${eventId}/schedule`,
      tier: 'free',
    },
  ];
}
