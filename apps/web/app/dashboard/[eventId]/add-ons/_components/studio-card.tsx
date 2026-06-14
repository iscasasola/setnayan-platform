import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';

/**
 * StudioCard — the calm paper card used across the couple Studio hub
 * (/dashboard/[eventId]/add-ons). Replaces the prior cinema-poster card
 * (service-poster.tsx) with the v2.1 paper palette (premium-calm): a soft
 * paper surface, a tinted icon square, the feature name, a one-line benefit,
 * a status/Free chip, and a single CTA.
 *
 * Two card states:
 *   • available → "Open" CTA linking to `href` (deep-links to the feature's
 *     own page, which handles buy-vs-use). A "Free" chip shows when free.
 *   • coming soon → a non-interactive "Soon" chip, no CTA, no working
 *     Notify-me backend (deferred). The whole card is non-clickable.
 *
 * Server component — no client JS; only Links.
 */

type Props = {
  /** Feature / tool name. */
  label: string;
  /** One-line, JTBD-framed benefit. */
  blurb: string;
  /** Lucide icon shown in the tinted square. */
  Icon: LucideIcon;
  /**
   * Destination for the "Open" CTA. When null/undefined the card renders in
   * the coming-soon (non-interactive) state.
   */
  href?: string | null;
  /** True → coming-soon state: muted chip, no CTA, non-clickable. */
  comingSoon?: boolean;
  /** True → show a subtle "Free" chip (genuinely-free items only). */
  free?: boolean;
};

export function StudioCard({
  label,
  blurb,
  Icon,
  href,
  comingSoon = false,
  free = false,
}: Props) {
  const available = !comingSoon && Boolean(href);

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'var(--m-paper-2)',
            color: comingSoon ? 'var(--m-slate-3)' : 'var(--m-orange-2)',
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>

        {comingSoon ? (
          <span
            className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ background: 'var(--m-line-soft)', color: 'var(--m-slate-3)' }}
          >
            Soon
          </span>
        ) : free ? (
          <span
            className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          >
            Free
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-1">
        <h3
          className="text-base font-semibold leading-snug"
          style={{ color: comingSoon ? 'var(--m-slate-2)' : 'var(--m-ink)' }}
        >
          {label}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--m-slate)' }}>
          {blurb}
        </p>
      </div>

      {available ? (
        <p
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Open <span aria-hidden>›</span>
        </p>
      ) : (
        <p className="mt-4 text-xs font-medium" style={{ color: 'var(--m-slate-3)' }}>
          Not yet available
        </p>
      )}
    </>
  );

  const baseClass =
    'group flex h-full flex-col rounded-2xl border p-5 transition-all';
  const baseStyle = {
    background: 'var(--m-paper)',
    borderColor: 'var(--m-line)',
    boxShadow: 'var(--m-shadow-sm)',
  };

  if (!available) {
    return (
      <div
        className={baseClass}
        style={baseStyle}
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href as string}
      className={`${baseClass} hover:-translate-y-0.5 hover:shadow-[var(--m-shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-orange)] focus-visible:ring-offset-2`}
      style={baseStyle}
    >
      {inner}
    </Link>
  );
}
