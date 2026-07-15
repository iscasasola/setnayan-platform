'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Camera,
  LayoutGrid,
  MessageSquare,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type TileIconKey =
  | 'users'
  | 'calendar'
  | 'briefcase'
  | 'shield-check'
  | 'wallet'
  | 'layout-grid'
  | 'message-square'
  | 'camera';

const ICONS: Record<TileIconKey, LucideIcon> = {
  users: Users,
  calendar: Calendar,
  briefcase: Briefcase,
  'shield-check': ShieldCheck,
  wallet: Wallet,
  'layout-grid': LayoutGrid,
  'message-square': MessageSquare,
  camera: Camera,
};

export function Tile({
  href,
  icon,
  title,
  body,
  disabled = false,
}: {
  href: string;
  icon: TileIconKey;
  title: string;
  body: string;
  disabled?: boolean;
}) {
  const Icon = ICONS[icon];
  // Glass PR-8 (2026-07-15 · rollout plan § 3.4) — navigating nav-tile re-skin.
  // These render in dense grids (up to ~16 on the Overview), so they stay
  // OPAQUE (`.sn-row` tint, no backdrop-filter) to respect the § 1.6 blur
  // budget — glass is reserved for the focal + lane bento. Gold icon chip +
  // `.sn-sec` title + gold "Open" affordance; a `.sn-press`/hover lift makes it
  // read as a destination. Tile geometry + Link wrapper + ArrowRight
  // micro-affordance unchanged per [[feedback_setnayan_button_preservation]].
  const Inner = disabled ? (
    <div className="flex h-full flex-col gap-3 rounded-card border border-dashed border-ink/15 bg-white/45 p-5 opacity-70">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink/[0.04] text-[color:var(--sn-ink-400)]">
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h2 className="sn-sec">{title}</h2>
      <p className="text-sm text-[color:var(--sn-ink-400)]">{body}</p>
    </div>
  ) : (
    <div className="sn-press sn-lift-3 group flex h-full flex-col gap-3 rounded-card border border-white/60 bg-white/72 p-5 shadow-[var(--sn-sh-tile)]">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--sn-gold-100)] text-[color:var(--sn-gold-700)]">
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h2 className="sn-sec">{title}</h2>
      <p className="text-sm text-[color:var(--sn-ink-500)]">{body}</p>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-[color:var(--sn-gold-700)]">
        Open{' '}
        <ArrowRight
          aria-hidden
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </div>
  );
  return disabled ? (
    Inner
  ) : (
    <Link
      href={href}
      className="block h-full rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sn-gold-500)]"
    >
      {Inner}
    </Link>
  );
}
