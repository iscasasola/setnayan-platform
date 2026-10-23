/**
 * shell-search-onward.tsx — the bottom of the SHELL's search results.
 *
 * Its own file (not inside `front-door-results.tsx`, which is `server-only`) so
 * `lib/shell-search.test.ts` can RENDER it and prove it never draws a door out
 * of the shell — the defect it replaces was a link, so a link is what is tested.
 */
import Link from 'next/link';

/**
 * The bottom of the SHELL's results — never a door out of the shell.
 *
 * Empty: one plain sentence naming WHAT was searched and WHERE (owner
 * 2026-10-22 — the page he was sent to said "No suppliers match exactly. Try
 * widening your search… Clear all filters" for a supplier on his own event, a
 * sentence about filters he never set, on a page about suppliers alone).
 *
 * The find row is the in-shell way to look for a NEW supplier: the Suppliers
 * page of the event you host, which carries the category search. It is drawn
 * whether or not something matched, for the same reason the front door's
 * marketplace row is — a name match is not a category search.
 */
export function ShellOnward({
  query,
  total,
  findSuppliers,
}: {
  query: string;
  total: number;
  findSuppliers: { href: string; eventName: string } | null;
}) {
  if (total > 0 && !findSuppliers) return null;
  return (
    <div className="fd-grid">
      <div className="fd-invite fd-invite-full" data-shell-search-onward="">
        <h3>
          {total === 0 ? `Nothing matches “${query}”.` : 'Looking for a new supplier?'}
        </h3>
        {total === 0 ? (
          <p>
            We looked in your events, the suppliers on your events, the shops published on
            Setnayan, and our stories and guides.
          </p>
        ) : null}
        {findSuppliers ? (
          <Link href={findSuppliers.href} className="fd-go">
            Find suppliers for {findSuppliers.eventName} &rarr;
          </Link>
        ) : null}
      </div>
    </div>
  );
}
