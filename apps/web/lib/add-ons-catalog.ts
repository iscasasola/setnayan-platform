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
  Sparkles,
  Video,
  Film,
  Printer,
  ImageDown,
  QrCode,
  MapPin,
  Palette,
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
    key: 'orders',
    label: 'Orders',
    Icon: Receipt,
    iteration: '0034',
    status: 'live',
    category: 'tool',
    blurb: 'View your in-app purchases · reference codes · payment status',
    cta: 'View orders',
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
    label: 'Save the Date Video',
    Icon: Video,
    iteration: '0024',
    status: 'live',
    category: 'photography',
    blurb:
      '12-template gallery · 60s video · vertical + square + horizontal · ₱99 per render',
    cta: 'Browse templates',
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
    key: 'animated-monogram',
    label: 'Monogram Creator',
    Icon: Type,
    iteration: '0004',
    status: 'web_v1',
    category: 'digital_services',
    blurb:
      'Design your wedding monogram · animated SVG trace · custom hero background',
    cta: 'Open studio',
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
