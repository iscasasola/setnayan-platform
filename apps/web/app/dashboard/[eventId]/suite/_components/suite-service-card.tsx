import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import type { RowPill } from '../../studio/_components/studio-app-row';
import { ServiceTags } from '../../studio/_components/service-tags';

/**
 * SuiteServiceCard — the Suite's grid tile. A compact BOX (icon + status/price
 * pill on top, name, two-line blurb, tags at the bottom) so the Recommended /
 * Yours / Free / search sections read as an app-store grid of many features
 * instead of full-width rows stretched end-to-end (owner 2026-07-23: "we want
 * it in boxes like a grid view … make them feel there are multiple features").
 * The whole card is one tap target. Server component — a Link, no client JS.
 *
 * Pill tone classes mirror StudioAppRow's PillEl so price/status reads
 * identically across the row and card idioms.
 */

const PILL_CLS: Record<NonNullable<RowPill>['tone'], string> = {
  price: 'bg-ink/[0.06] text-mulberry',
  free: 'bg-ink/[0.06] text-mulberry',
  trial: 'bg-terracotta/10 text-terracotta-700',
  active: 'bg-success-100 text-success-900',
  pending: 'border border-warn-300/60 bg-warn-50 text-warn-900',
  soon: 'bg-ink/5 text-ink/45',
};

export function SuiteServiceCard({
  href,
  label,
  blurb,
  Icon,
  gradient,
  pill,
  tags,
}: {
  href: string | null;
  label: string;
  blurb: string;
  Icon: LucideIcon;
  gradient: string;
  pill: RowPill;
  tags?: readonly string[];
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cream shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
          style={{ background: gradient }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        {pill ? (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold tracking-tight ${PILL_CLS[pill.tone]}`}
          >
            {pill.text}
          </span>
        ) : null}
      </div>

      <div className="mt-3 min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-ink">{label}</span>
        <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-ink/60">{blurb}</span>
      </div>

      <ServiceTags tags={tags} className="mt-3" />
    </>
  );

  const cardClass =
    'flex h-full flex-col rounded-xl border border-ink/10 bg-cream/40 p-4 transition-colors';

  if (!href) {
    return (
      <li className="list-none" data-reveal-item>
        <div aria-disabled="true" className={`${cardClass} opacity-70`}>
          {body}
        </div>
      </li>
    );
  }

  return (
    <li className="list-none" data-reveal-item>
      <Link
        href={href}
        className={`${cardClass} hover:border-ink/20 hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta`}
      >
        {body}
      </Link>
    </li>
  );
}
