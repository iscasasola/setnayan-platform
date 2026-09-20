import Link from 'next/link';
import type { ArrivalAction } from '@/lib/arrival-action';

/**
 * The one accented control, directly under the mark.
 *
 * Renders nothing when the resolver has nothing specific to say — an anonymous
 * reader keeps the page's existing public call to action instead of meeting a
 * second, weaker one.
 *
 * The secondary control is deliberately quiet: one accent per screen is the
 * pattern this slice exists to keep.
 */
export function ArrivalActionRow({ action }: { action: ArrivalAction | null }) {
  if (!action) return null;

  return (
    <div
      data-arrival-action={action.kind}
      className="flex flex-col items-center gap-3 pt-2 text-center"
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={action.href}
          className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-mulberry px-7 text-sm font-semibold tracking-wide text-cream transition-colors hover:bg-mulberry-600"
        >
          {action.label}
        </Link>
        {action.secondary ? (
          <Link
            href={action.secondary.href}
            className="inline-flex min-h-[48px] items-center justify-center border-b border-ink/25 pb-0.5 text-sm text-ink/75 transition-colors hover:border-ink/60 hover:text-ink"
          >
            {action.secondary.label}
          </Link>
        ) : null}
      </div>
      {action.note ? <p className="max-w-prose text-xs text-ink/60">{action.note}</p> : null}
    </div>
  );
}
