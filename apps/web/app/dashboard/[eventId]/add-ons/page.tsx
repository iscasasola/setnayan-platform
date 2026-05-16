import Link from 'next/link';
import {
  Receipt,
  Palette,
  Camera,
  Tv,
  CloudUpload,
  Sparkles,
  Video,
  Film,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

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
type AddOnStatus = 'live' | 'web_v1' | 'coming_soon';

const ADD_ONS: ReadonlyArray<{
  key: string;
  label: string;
  Icon: LucideIcon;
  iteration: string;
  status: AddOnStatus;
  blurb: string;
  cta: string;
}> = [
  {
    key: 'orders',
    label: 'Orders',
    Icon: Receipt,
    iteration: '0034',
    status: 'live',
    blurb: 'View your in-app purchases · reference codes · payment status',
    cta: 'View orders',
  },
  {
    key: 'mood-board',
    label: 'Mood Board',
    Icon: Palette,
    iteration: '0010',
    status: 'live',
    blurb: 'Per-role palettes · Setnayan Guide rule engine · 20 themes',
    cta: 'Open',
  },
  {
    key: 'save-the-date',
    label: 'Save the Date',
    Icon: Video,
    iteration: '0024',
    status: 'live',
    blurb: '12-template gallery · 60s video · vertical + square + horizontal · ₱99 per render',
    cta: 'Browse templates',
  },
  {
    key: 'papic',
    label: 'Papic',
    Icon: Camera,
    iteration: '0012',
    status: 'web_v1',
    blurb: 'Candid capture · gesture shutter · QR tagging · personal reels',
    cta: 'Set up',
  },
  {
    key: 'panood',
    label: 'Panood',
    Icon: Tv,
    iteration: '0011',
    status: 'web_v1',
    blurb: 'Live stream · YouTube delivery · AI Highlights · Same-Day Edit',
    cta: 'Set up',
  },
  {
    key: 'photo-delivery',
    label: 'Photo Delivery',
    Icon: CloudUpload,
    iteration: '0009',
    status: 'web_v1',
    blurb: 'Google Drive integration for full-resolution photo handoff',
    cta: 'Connect',
  },
  {
    key: 'patiktok',
    label: 'Patiktok',
    Icon: Film,
    iteration: '0017',
    status: 'coming_soon',
    blurb: 'Vertical-reel template gallery · render-on-demand · 9:16 1080p MP4',
    cta: 'Browse templates',
  },
  {
    key: 'supplies-marketplace',
    label: 'Supplies Marketplace',
    Icon: ShoppingBag,
    iteration: '0018',
    status: 'coming_soon',
    blurb: 'Wedding-day supplies + favors from vetted PH suppliers — direct to your venue',
    cta: 'Browse supplies',
  },
  {
    key: 'led',
    label: 'LED Background',
    Icon: Sparkles,
    iteration: '0005',
    status: 'web_v1',
    blurb: '8K template render · Photo Pool blend · USB delivery',
    cta: 'Choose template',
  },
];

type Props = { params: Promise<{ eventId: string }> };

async function isInternalAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

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

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADD_ONS.map((addon) => {
          const { Icon } = addon;
          const href =
            addon.key === 'orders'
              ? `/dashboard/${eventId}/orders`
              : addon.key === 'mood-board'
                ? `/dashboard/${eventId}/add-ons/mood-board`
                : addon.key === 'save-the-date'
                  ? `/dashboard/${eventId}/add-ons/save-the-date`
                  : `/dashboard/${eventId}/add-ons/${addon.key}`;

          const isClickable = addon.status !== 'coming_soon';
          const pill = showDevCodes ? (
            <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              {addon.iteration}
            </span>
          ) : addon.status === 'web_v1' ? (
            <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
              Web V1
            </span>
          ) : addon.status === 'coming_soon' ? (
            <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              Coming soon
            </span>
          ) : null;

          const cardClass = isClickable
            ? 'group flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5'
            : 'flex h-full flex-col gap-3 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-5 opacity-80';

          const inner = (
            <>
              <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                {pill}
              </div>
              <h2 className="text-lg font-semibold tracking-tight">{addon.label}</h2>
              <p className="text-sm text-ink/60">{addon.blurb}</p>
              {isClickable ? (
                <p className="mt-auto text-sm font-medium text-terracotta">
                  {addon.cta} <span aria-hidden>›</span>
                </p>
              ) : (
                <p className="mt-auto text-sm font-medium text-ink/40">
                  Not yet available
                </p>
              )}
            </>
          );

          return (
            <li key={addon.key}>
              {isClickable ? (
                <Link href={href} className={cardClass}>
                  {inner}
                </Link>
              ) : (
                <div className={cardClass} aria-disabled="true">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
