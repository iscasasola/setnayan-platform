import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { relativeTime, type ActivityItem } from '@/lib/activity';
import type { AttributedActivity } from '@/lib/activity-attribution';

// V1 pilot Home v2 — owner directive 2026-05-22.
// Extracted from page.tsx so the same renderer can host both the
// existing source-feed activity rows (guests / vendors / orders /
// schedule) and the new event_action_log rows that carry host
// attribution. The renderer treats them as one stream sorted by
// `at` desc; the attribution-bearing rows pick up a "[Host] · Role"
// prefix while the source rows keep their existing "Guest added"
// shape unchanged.
//
// Once event_action_log gets wired into the V1.x write paths, the
// attribution rows will progressively replace the source rows for
// the same underlying events (e.g. a vendor flip from contracted →
// deposit_paid will write a `payment_confirmed` action with a
// `performed_by_user_id`, and the older `event_vendors` row's
// generic "Vendor added" message stays anchored to the original
// add date — different events, different rows).

type Row =
  | { kind: 'source'; row: ActivityItem }
  | { kind: 'attributed'; row: AttributedActivity };

type Props = {
  eventId: string;
  sourceActivity: ReadonlyArray<ActivityItem>;
  attributedActivity: ReadonlyArray<AttributedActivity>;
  limit?: number;
  /** Localized "Recent activity" heading + "See all" copy. */
  headingLabel: string;
  seeAllLabel: string;
};

export function ActivityFeed({
  eventId,
  sourceActivity,
  attributedActivity,
  limit = 20,
  headingLabel,
  seeAllLabel,
}: Props) {
  const merged: Row[] = [
    ...attributedActivity.map((row) => ({ kind: 'attributed' as const, row })),
    ...sourceActivity.map((row) => ({ kind: 'source' as const, row })),
  ];
  merged.sort((a, b) => (b.row.at ?? '').localeCompare(a.row.at ?? ''));
  const slice = merged.slice(0, limit);

  if (slice.length === 0) {
    return (
      <section aria-labelledby="recent-activity-heading" className="space-y-3">
        <h2
          id="recent-activity-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {headingLabel}
        </h2>
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          Nothing yet. Add a guest, book a vendor, or place an order — it&rsquo;ll show up here.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="recent-activity-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          id="recent-activity-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {headingLabel}
        </h2>
        <Link
          href={`/dashboard/${eventId}/activity`}
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta hover:text-terracotta-700"
        >
          {seeAllLabel}
          <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-1">
        {slice.map((entry) => (
          <ActivityRow key={entry.row.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function ActivityRow({ entry }: { entry: Row }) {
  if (entry.kind === 'attributed') {
    const a = entry.row;
    const prefix = a.isSelf ? 'You' : (a.actorLabel ?? 'A host');
    return (
      <li>
        <Link
          href={a.href}
          className="-mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-terracotta/5"
        >
          <span className="min-w-0 truncate text-ink/80">
            <span className="font-medium text-ink">{prefix}</span> {a.description}
            {a.actorRoleLabel ? (
              <span className="text-ink/55"> · {a.actorRoleLabel}</span>
            ) : null}
          </span>
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
            {relativeTime(a.at)}
          </span>
        </Link>
      </li>
    );
  }
  const s = entry.row;
  return (
    <li>
      <Link
        href={s.href}
        className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-terracotta/5"
      >
        <span className="truncate text-ink/80">{s.description}</span>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
          {relativeTime(s.at)}
        </span>
      </Link>
    </li>
  );
}
