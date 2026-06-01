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
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  ServicePoster,
  type PosterStyle,
} from './_components/service-poster';

export const metadata = { title: 'Add-ons' };

// Add-on launcher manifest. Each card registers here. When a new iteration
// ships, it adds one entry. Wallet card REMOVED per the 2026-05-11 token-wallet
// retirement; "Orders" links to the apply-then-pay surface from iteration 0034.
//
// `status` controls the user-facing pill on the grid:
//   live        → no pill (fully shipped; click goes to feature)
//   web_v1      → "Web V1" pill in terracotta; clickable (reduced-quality web build)
//   coming_soon → "Coming soon" muted pill; card is NOT clickable
//
// `iteration` is internal — only rendered for admins (is_internal / is_team_member),
// hidden from couples and vendors. Keeps the spec cross-reference handy for
// internal debugging without leaking SKU-looking codes to real users.
//
// `poster` defines the visual treatment per service. Owner directive 2026-05-23
// PM converted this grid from static cards to live/animated posters per
// _components/service-poster.tsx. Each entry picks a motion variant (drift /
// pulse / scan) plus a per-service color pair. Brand discipline: each gradient
// harmonizes within the cream / ink / terracotta palette family so the grid
// reads as one editorial poster wall, not 11 unrelated visuals.
type AddOnStatus = 'live' | 'web_v1' | 'coming_soon';

const ADD_ONS: ReadonlyArray<{
  key: string;
  label: string;
  Icon: LucideIcon;
  iteration: string;
  status: AddOnStatus;
  blurb: string;
  cta: string;
  poster: PosterStyle;
}> = [
  {
    key: 'orders',
    label: 'Orders',
    Icon: Receipt,
    iteration: '0034',
    status: 'live',
    blurb: 'View your in-app purchases · reference codes · payment status',
    cta: 'View orders',
    // Drift · warm amber-on-cream — receipt paper feel
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
    blurb:
      '12-template gallery · 60s video · vertical + square + horizontal · ₱99 per render',
    cta: 'Browse templates',
    // Scan · sepia-on-ink — vintage film projection
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
    status: 'coming_soon',
    blurb:
      'Customize the public landing page guests see when they scan your QR or open your link',
    cta: 'Customize',
    // Drift · cool teal-on-ink — globe / network feel
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
    status: 'coming_soon',
    blurb:
      'Pick from Setnayan-owned music or generate a custom track for your event reels',
    cta: 'Browse music',
    // Pulse · deep purple-on-ink — soundwave breathing
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #1A0B2E 0%, #3D1F5C 50%, #6B3FA0 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #C8A0FF 0%, transparent 50%)',
      iconBadgeClass: 'bg-purple-100/15 text-purple-100',
    },
  },
  // Playlist Builder · 2026-05-24 owner directive (via AskUserQuestion)
  // = "create your song list" for the booked DJ/band. Free utility · the
  // booked Music vendor reads through the music-vendor RLS policy on
  // event_playlist_picks. Live status from day 1 because the surface
  // works even without a booked vendor (host can pre-build; sync flips
  // active the moment a Music vendor locks).
  {
    key: 'playlist',
    label: 'Playlist',
    Icon: Music,
    iteration: '0016',
    status: 'web_v1',
    blurb:
      "Pick songs by slot · processional · first dance · dinner · open floor · don't-play list. Synced to your DJ or band the moment you book them.",
    cta: 'Build your lineup',
    // Drift · warm gold-on-ink — vinyl record glow feel
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
    key: 'monogram-creator',
    label: 'Monogram Creator',
    Icon: Type,
    iteration: '0004',
    status: 'coming_soon',
    blurb:
      'Design your wedding monogram · animated SVG trace · custom hero background',
    cta: 'Open studio',
    // Pulse · cream-on-ink — ink/calligraphy feel
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
    blurb:
      'A branded QR for every guest · your monogram + palette colors · print-ready',
    cta: 'Brand my QRs',
    // Drift · terracotta-on-cream — QR module grid feel
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
    blurb: 'Candid capture · gesture shutter · QR tagging · personal reels',
    cta: 'Set up',
    // Pulse · terracotta-on-ink — camera lens iris dilation
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
    blurb: 'Live stream · YouTube delivery · AI Highlights · Same-Day Edit',
    cta: 'Set up',
    // Scan · broadcast red-on-ink — TV studio LIVE feel
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
    blurb:
      'Connect Google Drive · photographer post-event handoff · share albums with guests',
    cta: 'Set up',
    // Drift · cool blue-on-ink — cloud / Drive feel
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
    blurb: 'Vertical-reel template gallery · render-on-demand · 9:16 1080p MP4',
    cta: 'Browse templates',
    // Scan · neon-on-ink — TikTok-vibes within brand
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
    blurb:
      'Wedding-day print pack + favors from vetted PH suppliers — direct to your venue',
    cta: 'Browse Paprint',
    // Scan · kraft-on-cream — paper printer feel
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
    blurb: '8K template render · Photo Pool blend · USB delivery',
    cta: 'Choose template',
    // Pulse · cyan-on-ink — LED screen pixel glow
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
    blurb:
      'Your seating chart, turned into wayfinding · each guest finds their table from the entrance',
    cta: 'Map my venue',
    // Drift · deep terracotta-on-ink — venue floor-plan / aisle path feel
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #1A1410 0%, #3A281C 55%, #6B4A30 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 60%, #F4D9B0 0%, transparent 50%)',
      iconBadgeClass: 'bg-amber-100/20 text-amber-100',
    },
  },
];

type Props = { params: Promise<{ eventId: string }> };

async function isInternalAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(me?.is_internal || me?.is_team_member);
}

export default async function AddOnsPage({ params }: Props) {
  const { eventId } = await params;
  const showDevCodes = await isInternalAdmin();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Add-ons
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What would you like to set up?
        </h1>
        <p className="max-w-prose text-base text-ink/60">
          Each Setnayan feature lives here. Cards light up as they ship.
        </p>
      </header>

      {/* Poster grid — owner directive 2026-05-23 PM. Each service renders
          as a cinema-style poster with a per-service animated CSS
          background + dark gradient mask + text in the lower third.
          See _components/service-poster.tsx for the per-poster anatomy
          and globals.css `@keyframes poster-*` for the motion primitives.
          Grid stays at 3-col desktop / 2-col tablet / 1-col mobile so
          the 4:5 posters tile cleanly without horizontal scroll on PH
          mid-tier devices. */}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADD_ONS.map((addon) => {
          const href =
            addon.key === 'orders'
              ? `/dashboard/${eventId}/orders`
              : `/dashboard/${eventId}/add-ons/${addon.key}`;
          const comingSoon = addon.status === 'coming_soon';

          // Iteration codes only leak to internal admin accounts. Couples
          // and vendors see the human-readable Coming-soon / Web V1 pills
          // OR no pill at all for fully-live services.
          const pill = showDevCodes ? (
            <span className="rounded-full bg-cream/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-cream/80 backdrop-blur-md">
              {addon.iteration}
            </span>
          ) : addon.status === 'web_v1' ? (
            <span className="rounded-full bg-cream/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-cream backdrop-blur-md">
              Web V1
            </span>
          ) : comingSoon ? (
            <span className="rounded-full bg-cream/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-cream/70 backdrop-blur-md">
              Coming soon
            </span>
          ) : null;

          return (
            <li key={addon.key}>
              <ServicePoster
                label={addon.label}
                blurb={addon.blurb}
                cta={addon.cta}
                href={comingSoon ? null : href}
                Icon={addon.Icon}
                style={addon.poster}
                pill={pill}
                comingSoon={comingSoon}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
