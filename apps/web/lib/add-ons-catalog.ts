/**
 * add-ons-catalog.ts — canonical list of Setnayan in-app service add-ons.
 *
 * Single source of truth extracted 2026-06-03 so the add-ons launcher grid
 * (/dashboard/[eventId]/studio) and the Services tab vendor page
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
  MailCheck,
  PartyPopper,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';
import type { PosterStyle } from '@/app/dashboard/[eventId]/studio/_components/service-poster';
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
 * Which Studio section this add-on falls under on the couple-side Studio hub
 * (/dashboard/[eventId]/studio). Independent of `category` (which drives the
 * Services/vendors-tab placement). The 4 sections ARE Studio's docked sub-nav
 * (owner-locked 2026-06-17 customer-menu redesign — Studio absorbed Design):
 *   • setnayan_ai → info gathered → personalized outputs (AI planner · playlist)
 *   • website     → the public site: Save the Date · RSVP · Event · Editorial
 *   • capture     → make a record of the day (Papic / Panood / Photo / TikTok)
 *   • branding    → the couple's identity: monogram · wax stamp · mood board ·
 *                   LED background · Pakanta · custom QR · indoor blueprint
 *   • utility     → NOT a Studio section card (Orders); hidden from the hub.
 *                   Paprint/Supplies was removed (not a Setnayan service for now).
 */
export type StudioGroup =
  | 'setnayan_ai'
  | 'website'
  | 'capture'
  | 'branding'
  | 'utility';

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
   * Job-to-be-done grouping for the Studio hub (/dashboard/[eventId]/studio).
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
  /**
   * DB service_key for ownership checks on the Studio hub. Absent on free tools
   * and services with variable/multi-SKU pricing — those skip the hub-level
   * ownership badge; their detail pages handle state.
   */
  serviceKey?: string;
};

/**
 * Resolve the href for a given add-on key + event ID.
 *
 * A few keys don't live under /studio/<key>:
 *   • orders            → /orders (the order history surface).
 *   • animated-monogram → /monogram, the couple's Monogram MAKER (the free
 *     design hub — lettered lockups · Cipher Studio · Setnayan-AI Bespoke ·
 *     upload). The Studio card's label/CTA promise "design your monogram", so
 *     it must open the maker, not the paid Animated-Monogram buy page. The
 *     maker itself funnels to that paid upgrade (its "See the Animated
 *     Monogram" CTAs → /studio/animated-monogram), so the SKU page stays
 *     reachable as the upsell. (Fix 2026-06-18 — the maker was unreachable
 *     from Studio; only the buy wall showed.)
 */
export function addOnHref(key: string, eventId: string): string {
  if (key === 'orders') return `/dashboard/${eventId}/orders`;
  if (key === 'animated-monogram') return `/dashboard/${eventId}/monogram`;
  // Features that don't own a Studio surface of their own open their real home
  // rather than a "coming soon" stub — so every Studio button lands somewhere
  // usable. landing-page → the wedding-website hub; music-creator → Pakanta
  // (its own detail copy already frames it as "generate a custom score —
  // Pakanta"). Both destinations handle their own free-use / paywall.
  if (key === 'landing-page') return `/dashboard/${eventId}/website`;
  if (key === 'music-creator') return `/dashboard/${eventId}/studio/pakanta`;
  // Seat plan opens its real editor (the couple-sidebar route). When the 3D
  // experience is enabled it opens the 3D lab instead; NEXT_PUBLIC_* vars are
  // inlined server-side, and the Studio hub is a server component.
  if (key === 'seating') {
    return process.env.NEXT_PUBLIC_SEATING_3D === 'true'
      ? `/dashboard/${eventId}/seating/lab`
      : `/dashboard/${eventId}/seating`;
  }
  // The three website "parts" (RSVP · Event · Editorial) open the full-screen
  // editor jumped straight to that phase — its own top-level route so it escapes
  // the dashboard chrome, exactly like the combined editor. Save the Date keeps
  // its own builder (/studio/save-the-date via the default below). See the
  // matching `appStoreDetailHref` branches + /site-editor/[eventId]/<phase>.
  if (key === 'rsvp' || key === 'event' || key === 'editorial') {
    return `/site-editor/${eventId}/${key}`;
  }
  return `/dashboard/${eventId}/studio/${key}`;
}

/**
 * Where the Studio hub's App Store row points — the feature's detail/info page.
 *
 * Default → the catalog-driven App Store detail at /studio/about/<key>
 * (content lives in add-ons-detail.ts). The literal `about` segment is
 * deliberate: a feature like Papic has its own static /studio/papic folder,
 * and in Next.js a literal segment shadows the `[addon]` dynamic sibling
 * without backtracking — so /studio/papic/about would 404. Routing the detail
 * page under /studio/about/<key> keeps it clear of every feature folder.
 *
 * Two exceptions link straight to their own surface instead of an /about page:
 *   • panood — its /studio/panood IS already a bespoke App Store detail (the
 *     2026-05-17 pilot).
 *   • supplies-marketplace — has no add-ons-detail.ts entry, so an /about link
 *     would notFound(); its /studio/supplies-marketplace surface is the real
 *     destination.
 */
export function appStoreDetailHref(key: string, eventId: string): string {
  if (key === 'panood') return `/dashboard/${eventId}/studio/panood`;
  if (key === 'supplies-marketplace') return `/dashboard/${eventId}/studio/supplies-marketplace`;
  // Seat plan has no /about detail page — the Studio row opens the editor
  // directly (flag-aware via addOnHref).
  if (key === 'seating') return addOnHref('seating', eventId);
  // Website parts — the Studio card opens its editor directly (no /about
  // interstitial): the three phase editors, and the combined "Whole website"
  // card → the full-screen editor on its overview tab. These are free editing
  // tools the couple revisits often; an info page would just add a tap.
  if (key === 'landing-page') return `/site-editor/${eventId}`;
  if (key === 'rsvp' || key === 'event' || key === 'editorial') {
    return `/site-editor/${eventId}/${key}`;
  }
  return `/dashboard/${eventId}/studio/about/${key}`;
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
      'The vendors that fit your budget, date, and style — already at the top.',
    cta: 'See your matches',
    studioGroup: 'setnayan_ai',
    serviceKey: 'SETNAYAN_AI',
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
    studioGroup: 'utility',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 30% 70%, #F4D9B0 0%, #C97B4B 70%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FFEED0 0%, transparent 60%)',
      iconBadgeClass: 'bg-warn-50/30 text-warn-50',
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
      'The reveal that opens your invitation — in your colors, and it plays itself.',
    cta: 'Choose your reveal',
    studioGroup: 'website',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #2B1810 0%, #4A2E1C 50%, #6B3E25 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 220, 160, 0.7) 50%, transparent 100%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
    },
  },
  // The three other "parts" of the couple's website (the 4-path lifecycle ·
  // lib/invitation-widgets.ts). Each is its OWN Studio card + its own editor
  // page — separating the content the way couples think about it (Save the Date ·
  // RSVP · Event · Editorial), instead of one catch-all "website" entry. All
  // free; each opens the full-screen editor jumped to that phase (addOnHref /
  // appStoreDetailHref → /site-editor/[eventId]/<phase>).
  {
    key: 'rsvp',
    label: 'RSVP',
    Icon: MailCheck,
    iteration: '0002',
    status: 'live',
    category: 'tool',
    blurb:
      'The run-up page — your invitation, the RSVP form, and every detail guests need.',
    cta: 'Edit your RSVP page',
    studioGroup: 'website',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #3A1E2E 0%, #6E3A55 50%, #A8617F 100%)',
      motionBackground:
        'radial-gradient(circle at 55% 45%, #FFD4E4 0%, transparent 55%)',
      iconBadgeClass: 'bg-pink-100/15 text-pink-100',
    },
  },
  {
    key: 'event',
    label: 'Event',
    Icon: PartyPopper,
    iteration: '0031',
    status: 'live',
    category: 'tool',
    blurb:
      'The wedding day itself — the live, day-of page guests open at the venue.',
    cta: 'Edit your event-day page',
    studioGroup: 'website',
    tier: 'free',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #2E2410 0%, #6E5320 50%, #B8902E 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FFE9B0 0%, transparent 55%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
    },
  },
  {
    key: 'editorial',
    label: 'Editorial',
    Icon: Newspaper,
    iteration: '0038',
    status: 'live',
    category: 'tool',
    blurb:
      'After the day — your wedding as a story, with the gallery and a thank-you.',
    cta: 'Edit your editorial',
    studioGroup: 'website',
    tier: 'free',
    poster: {
      motion: 'scan',
      baseBackground:
        'radial-gradient(circle at 40% 40%, #2A2A2E 0%, #121214 80%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(245, 240, 232, 0.55) 50%, transparent 100%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  {
    key: 'landing-page',
    label: 'Whole website',
    Icon: Globe2,
    iteration: '0002',
    status: 'web_v1',
    category: 'tool',
    blurb:
      'All four parts in one place — settings, RSVP, event day, and editorial.',
    cta: 'Open the editor',
    studioGroup: 'website',
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
      'Music you’re cleared to use on every wedding video — no fees.',
    cta: 'Browse music',
    studioGroup: 'branding',
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
      'The right song for every moment — handed straight to your DJ.',
    cta: 'Build your lineup',
    studioGroup: 'setnayan_ai',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 50% 50%, #4A2E1C 0%, #1A1A1A 80%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #F4D9B0 0%, transparent 55%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
    },
  },
  {
    // Pakanta — a custom song written for the couple. The song is composed
    // from the onboarding love story (lib/pakanta-brief.ts); the page only
    // collects the music top-up. Couple surface: /studio/pakanta.
    key: 'pakanta',
    label: 'Pakanta',
    Icon: Music,
    iteration: '0036',
    status: 'live',
    category: 'digital_services',
    blurb: 'An original song written from your love story — yours to keep.',
    cta: 'Create your song',
    studioGroup: 'branding',
    serviceKey: 'PAKANTA',
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
    label: 'Monogram Maker',
    Icon: Type,
    iteration: '0004',
    status: 'web_v1',
    category: 'digital_services',
    blurb:
      'Your mark, drawn to life — on your QR, your page, your signage.',
    cta: 'Open the maker',
    studioGroup: 'branding',
    // The maker itself is free (the lettered / cipher / upload monogram is
    // never gated) → "Free" chip. serviceKey keeps the Animated-Monogram SKU
    // ownership badge, so the chip flips to "Active" once the paid draw-on
    // animation is owned (chip priority: Active > Pending > Free).
    tier: 'free',
    serviceKey: 'ANIMATED_MONOGRAM',
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
      'A branded code for every guest — your monogram and colors, print-ready.',
    cta: 'Brand my QRs',
    studioGroup: 'branding',
    serviceKey: 'CUSTOM_QR_GUEST',
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
    blurb: 'Your guests become the photographers — every candid in your gallery by morning.',
    cta: 'Set up',
    studioGroup: 'capture',
    freeTrial: 'Free to try',
    serviceKey: 'PAPIC_SEATS',
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
    blurb: 'Your wedding live — everyone who can’t be there, there.',
    cta: 'Set up',
    studioGroup: 'capture',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #1F0808 0%, #4A1212 50%, #8B1A1A 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 90, 90, 0.8) 50%, transparent 100%)',
      iconBadgeClass: 'bg-danger-100/15 text-danger-50',
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
      'Your photographer’s full-resolution gallery, delivered to your Drive.',
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
    blurb: 'Polished vertical reels from your day — ready to post.',
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
    studioGroup: 'utility',
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
    blurb: 'Your name and monogram, twenty feet tall on the stage screen.',
    cta: 'Choose template',
    studioGroup: 'branding',
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
      'Every guest walks straight from the door to their table.',
    cta: 'Map my venue',
    studioGroup: 'branding',
    serviceKey: 'INDOOR_BLUEPRINT',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #1A1410 0%, #3A281C 55%, #6B4A30 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 60%, #F4D9B0 0%, transparent 50%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
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
      'Your wedding palette — and it flows into every Setnayan piece.',
    cta: 'Open board',
    studioGroup: 'branding',
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
  {
    // Free core planning tool, surfaced on the Studio hub (owner ask
    // 2026-06-21). Nested under `branding` to match the existing layout-tool
    // precedent (indoor-blueprint + mood-board live here) without touching the
    // owner-locked 4-section sub-nav. Its href is flag-aware — see addOnHref.
    key: 'seating',
    label: 'Seat Plan',
    Icon: LayoutGrid,
    iteration: '0008',
    status: 'web_v1',
    category: 'tool',
    blurb: 'Lay out your tables and seat every guest with drag-and-drop.',
    cta: 'Open seat plan',
    studioGroup: 'branding',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #1F2A3D 0%, #2E4063 50%, #44608F 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #BFD4F0 0%, transparent 55%)',
      iconBadgeClass: 'bg-sky-100/15 text-sky-50',
    },
  },
];

/**
 * A free core planning tool surfaced in the Studio hub's "Plan & organize"
 * group. These deep-link to existing couple-sidebar routes (Guests / Seating /
 * Budget / Schedule) rather than to an /studio/[feature] detail page.
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
