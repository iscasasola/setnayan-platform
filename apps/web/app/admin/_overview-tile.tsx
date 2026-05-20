'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Calendar,
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
  | 'message-square';

const ICONS: Record<TileIconKey, LucideIcon> = {
  users: Users,
  calendar: Calendar,
  briefcase: Briefcase,
  'shield-check': ShieldCheck,
  wallet: Wallet,
  'layout-grid': LayoutGrid,
  'message-square': MessageSquare,
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
  const Inner = (
    <div
      className={`group flex h-full flex-col gap-3 rounded-xl border p-5 ${
        disabled
          ? 'cursor-not-allowed border-dashed border-ink/15 bg-cream/60 opacity-70'
          : 'border-ink/10 bg-cream transition-colors hover:border-terracotta/40 hover:bg-terracotta/5'
      }`}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      <p className="text-sm text-ink/65">{body}</p>
      {!disabled ? (
        <span className="mt-auto inline-flex items-center gap-1 text-sm text-terracotta">
          Open <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      ) : null}
    </div>
  );
  return disabled ? Inner : <Link href={href}>{Inner}</Link>;
}
