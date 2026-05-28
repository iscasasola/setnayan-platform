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
  // v2.1 deep-fix (2026-05-28) — Overview tile card chrome adopts
  // --m-paper surface + --m-line hairline + --m-shadow-sm + sienna
  // accent on icon chip + Open CTA. Matches the .m-card pattern
  // and mirrors couple planning-groups tiles from PR #587 deep-fix.
  // Disabled state uses dashed --m-line-soft + muted --m-slate body.
  // Tile geometry + Link wrapper + ArrowRight micro-affordance
  // unchanged per [[feedback_setnayan_button_preservation]].
  const Inner = disabled ? (
    <div
      className="group flex h-full flex-col gap-3 rounded-xl border p-5"
      style={{
        background: 'var(--m-paper-2)',
        borderColor: 'var(--m-line-soft)',
        borderStyle: 'dashed',
        opacity: 0.7,
        cursor: 'not-allowed',
      }}
    >
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: 'var(--m-blush)', color: 'var(--m-slate)' }}
      >
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h2
        className="text-base font-semibold tracking-tight"
        style={{ color: 'var(--m-ink)' }}
      >
        {title}
      </h2>
      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        {body}
      </p>
    </div>
  ) : (
    <div
      className="group flex h-full flex-col gap-3 rounded-xl border p-5 transition-colors"
      style={{
        background: 'var(--m-paper)',
        borderColor: 'var(--m-line)',
        boxShadow: 'var(--m-shadow-sm)',
      }}
    >
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: 'var(--m-blush)', color: 'var(--m-orange-2)' }}
      >
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h2
        className="text-base font-semibold tracking-tight"
        style={{ color: 'var(--m-ink)' }}
      >
        {title}
      </h2>
      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        {body}
      </p>
      <span
        className="mt-auto inline-flex items-center gap-1 text-sm"
        style={{ color: 'var(--m-orange-2)' }}
      >
        Open <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  );
  return disabled ? Inner : <Link href={href}>{Inner}</Link>;
}
