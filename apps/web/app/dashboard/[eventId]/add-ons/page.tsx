import Link from 'next/link';
import {
  Receipt,
  Palette,
  Camera,
  Tv,
  CloudUpload,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react';

export const metadata = { title: 'Add-ons' };

// Add-on launcher manifest. Each card registers here. When a new iteration
// ships, it adds one entry. Wallet card REMOVED per the 2026-05-11 token-wallet
// retirement; "Orders" links to the apply-then-pay surface from iteration 0034.
const ADD_ONS: ReadonlyArray<{
  key: string;
  label: string;
  Icon: LucideIcon;
  iteration: string;
  blurb: string;
  cta: string;
}> = [
  {
    key: 'orders',
    label: 'Orders',
    Icon: Receipt,
    iteration: '0034',
    blurb: 'View your in-app purchases · reference codes · payment status',
    cta: 'View orders',
  },
  {
    key: 'mood-board',
    label: 'Mood Board',
    Icon: Palette,
    iteration: '0010',
    blurb: 'Per-role palettes · Setnayan Guide rule engine · 20 themes',
    cta: 'Open',
  },
  {
    key: 'save-the-date',
    label: 'Save the Date',
    Icon: Video,
    iteration: '0024',
    blurb: '12-template gallery · 60s video · vertical + square + horizontal · ₱99 per render',
    cta: 'Browse templates',
  },
  {
    key: 'papic',
    label: 'Papic',
    Icon: Camera,
    iteration: '0012',
    blurb: 'Candid capture · gesture shutter · QR tagging · personal reels',
    cta: 'Set up',
  },
  {
    key: 'panood',
    label: 'Panood',
    Icon: Tv,
    iteration: '0011',
    blurb: 'Live stream · YouTube delivery · AI Highlights · Same-Day Edit',
    cta: 'Set up',
  },
  {
    key: 'photo-delivery',
    label: 'Photo Delivery',
    Icon: CloudUpload,
    iteration: '0009',
    blurb: 'Google Drive integration for full-resolution photo handoff',
    cta: 'Connect',
  },
  {
    key: 'led',
    label: 'LED Background',
    Icon: Sparkles,
    iteration: '0005',
    blurb: '8K template render · Photo Pool blend · USB delivery',
    cta: 'Choose template',
  },
];

type Props = { params: Promise<{ eventId: string }> };

export default async function AddOnsPage({ params }: Props) {
  const { eventId } = await params;

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
          Each Setnayan feature lives here. Cards light up as the iterations behind them ship.
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
          return (
            <li key={addon.key}>
              <Link
                href={href}
                className="group flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                    {addon.iteration}
                  </span>
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{addon.label}</h2>
                <p className="text-sm text-ink/60">{addon.blurb}</p>
                <p className="mt-auto text-sm font-medium text-terracotta">
                  {addon.cta} <span aria-hidden>›</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
