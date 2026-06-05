'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import {
  ROLE_LABELS,
  SIDE_LABELS,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import { findDuplicates, TAG } from '@/lib/guest-dedupe';

// Slim projection of a guest — only what the matcher needs + what the
// warning row renders. The server page maps GuestRow down to this so the
// full guest objects (email / mobile / notes) never get serialized into
// the client island's props.
export type NamePoolGuest = {
  guest_id: string;
  first_name: string;
  last_name: string;
  role: GuestRole;
  side: GuestSide;
  extra_roles: GuestRole[];
};

/**
 * First + last name inputs for the detailed Add-guest form, with the same
 * live duplicate detection the quick-add sheet uses (shared matcher in
 * `lib/guest-dedupe`). The inputs keep name="first_name" / "last_name" so
 * the server action (createGuest) receives them unchanged — this island
 * only layers a NON-BLOCKING "possible duplicate" warning on top. Two
 * guests legitimately can share a name, so the host can always submit;
 * the warning links to each existing match (new tab, form state intact)
 * so they can check before they do.
 */
export function GuestNameFields({
  eventId,
  pool,
}: {
  eventId: string;
  pool: NamePoolGuest[];
}) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const dups = useMemo(
    () => (dismissed ? [] : findDuplicates(first, last, pool)),
    [first, last, pool, dismissed],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="first_name">
            First name *
          </label>
          <input
            className="input-field"
            id="first_name"
            name="first_name"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="words"
            placeholder="Maria"
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              setDismissed(false);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="last_name">
            Last name *
          </label>
          <input
            className="input-field"
            id="last_name"
            name="last_name"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="words"
            placeholder="de la Cruz"
            value={last}
            onChange={(e) => {
              setLast(e.target.value);
              setDismissed(false);
            }}
          />
        </div>
      </div>

      {dups.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold leading-tight text-amber-800">
            <AlertTriangle aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.9} />
            {dups.length > 1
              ? 'You may have already added these guests'
              : 'You may have already added this guest'}
          </p>
          {dups.map(({ g, kind }) => (
            <div
              key={g.guest_id}
              className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream px-2.5 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {g.first_name} {g.last_name}
                </span>
                <span className="block truncate text-[11px] text-ink/55">
                  {[g.role, ...g.extra_roles].map((r) => ROLE_LABELS[r]).join(' · ')}
                  {' · '}
                  {SIDE_LABELS[g.side]}
                </span>
              </span>
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  kind === 'exact'
                    ? 'bg-rose-100 text-rose-700'
                    : kind === 'nick'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-amber-200/70 text-amber-800'
                }`}
              >
                {TAG[kind]}
              </span>
              <Link
                href={`/dashboard/${eventId}/guests/${g.guest_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-none rounded-lg border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/70 hover:border-ink/30"
              >
                View
              </Link>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-xs font-medium text-ink/55 hover:text-ink"
          >
            These are different people — continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
