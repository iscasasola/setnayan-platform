import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

/**
 * StudioAppRow — an iOS App Store-style list row for the Studio hub.
 *
 * A colourful squircle "app icon" (the feature's poster gradient), the feature
 * name, a one-line subtitle, and a GET/price/status pill on the right. The
 * WHOLE row is one tap target → the feature's App Store detail page (single
 * link, no nested interactive elements). The pill is a visual price/status
 * indicator styled like the App Store GET button, not a separate action.
 *
 * Server component — Links only, no client JS.
 */

export type RowPill = {
  text: string;
  tone: 'price' | 'free' | 'trial' | 'active' | 'pending' | 'soon';
} | null;

type Props = {
  href: string | null;
  label: string;
  blurb: string;
  Icon: LucideIcon;
  /** The feature's poster gradient — becomes the app-icon tile background. */
  gradient: string;
  pill: RowPill;
};

function PillEl({ pill }: { pill: NonNullable<RowPill> }) {
  const cls: Record<NonNullable<RowPill>['tone'], string> = {
    price: 'bg-ink/[0.06] text-mulberry',
    free: 'bg-ink/[0.06] text-mulberry',
    trial: 'bg-terracotta/10 text-terracotta-700',
    active: 'bg-success-100 text-success-900',
    pending: 'border border-warn-300/60 bg-warn-50 text-warn-900',
    soon: 'bg-ink/5 text-ink/45',
  };
  return (
    <span
      className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-bold tracking-tight ${cls[pill.tone]}`}
    >
      {pill.text}
    </span>
  );
}

export function StudioAppRow({ href, label, blurb, Icon, gradient, pill }: Props) {
  const inner = (
    <>
      <span
        aria-hidden
        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-cream shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
        style={{ background: gradient }}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{label}</span>
        <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ink/60">
          {blurb}
        </span>
      </span>

      {pill ? <PillEl pill={pill} /> : null}
      {href ? (
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={2} />
      ) : null}
    </>
  );

  if (!href) {
    return (
      <li>
        <div
          aria-disabled="true"
          className="flex items-center gap-3.5 px-4 py-3 opacity-70 sm:px-5"
        >
          {inner}
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta sm:px-5"
      >
        {inner}
      </Link>
    </li>
  );
}
