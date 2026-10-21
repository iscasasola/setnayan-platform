/**
 * FindCategoryList — Find a supplier's category list, drawn in ONE place.
 *
 * Owner-approved 2026-10-01 (DECISION_LOG "SUPPLIER INBOX + FIND-A-SUPPLIER
 * DESIGN"; `prototypes/supplier_inbox_and_find_2026-10-01_fable.html` frames
 * 4–6): "Popular for <type>" · then the host's groups · "Booked ✓" on a
 * category already booked, else its supplier count ("Joining soon" at none).
 *
 * Two readers (owner 2026-10-21 — the big "Find a supplier" button is gone;
 * the bottom search shows the categories when nothing is typed):
 *   the Find page          `vendors/categories/page.tsx`
 *   the bottom search      `find-thumb-row.tsx`, its empty state
 * Both hand in the same `readFindList` result (`lib/supplier-find-read.ts`), so
 * the same event shows the same rows in the same order with the same states,
 * and a row goes to the same place from either (`?c=<tile>` on the Find page).
 *
 * No hooks and no browser APIs: it renders on the server for the Find page
 * and inside the client thumb row alike. Rows are pressable, so each row is a
 * 44 px+ link; the groups are divided, never framed.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import {
  popularHeading,
  supplierCountLabel,
  type FindCategory,
  type FindList,
} from '@/lib/supplier-find';

/** Where a category row goes — the Find page's own category view. */
export function findCategoryHref(eventId: string, tile: string): string {
  return `/dashboard/${eventId}/vendors/categories?c=${encodeURIComponent(tile)}`;
}

export function FindCategoryList({
  eventId,
  list,
  bookedMeasured,
  eventType,
  solemn,
  query = '',
}: {
  eventId: string;
  list: FindList;
  bookedMeasured: boolean;
  eventType: string | null;
  solemn: boolean;
  /** What the list was narrowed by — only for the "Nothing matches" line. */
  query?: string;
}) {
  const row = (c: FindCategory) => {
    const sub = c.booked ? 'Booked ✓' : supplierCountLabel(c.supplierCount);
    return (
      <li key={c.tile} className="border-t border-ink/10">
        <Link
          href={findCategoryHref(eventId, c.tile)}
          className="flex min-h-11 items-center gap-3 py-3"
          data-find-tile={c.tile}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">{c.label}</span>
            {sub ? <span className="block text-[12.5px] text-ink/55">{sub}</span> : null}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink/35" aria-hidden />
        </Link>
      </li>
    );
  };

  return (
    <div data-find-category-list="">
      {!bookedMeasured ? (
        <p role="alert" className="mt-3 text-[13px] text-ink/60">
          We couldn&rsquo;t check what you&rsquo;ve booked — reload in a moment.
        </p>
      ) : null}

      {list.total === 0 ? (
        <p className="mt-6 text-[15px] text-ink/65">
          {query ? `Nothing matches “${query}”.` : 'No categories for this event yet.'}
        </p>
      ) : null}

      {list.popular.length > 0 ? (
        <section className="mt-6" aria-label={popularHeading(eventType, solemn)}>
          <h3 className="text-[12px] font-medium uppercase tracking-wide text-ink/50">
            {popularHeading(eventType, solemn)}
          </h3>
          <ul className="mt-1">{list.popular.map(row)}</ul>
        </section>
      ) : null}

      {list.groups.map((g) => (
        <section key={g.id} className="mt-6" aria-label={g.label} data-find-group={g.id}>
          <h3 className="flex items-baseline justify-between text-[12px] font-medium uppercase tracking-wide text-ink/50">
            <span>{g.label}</span>
            {g.bookedCount ? (
              <span className="normal-case tracking-normal">{formatCount(g.bookedCount)} booked</span>
            ) : null}
          </h3>
          <ul className="mt-1">{g.categories.map(row)}</ul>
        </section>
      ))}
    </div>
  );
}
