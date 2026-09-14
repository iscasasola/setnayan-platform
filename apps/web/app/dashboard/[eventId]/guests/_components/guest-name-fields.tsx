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
import { parsePersonName } from '@/lib/person-name-parse';

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
 * Name inputs for the detailed Add-guest form, with the same
 * live duplicate detection the quick-add sheet uses (shared matcher in
 * `lib/guest-dedupe`). The inputs keep name="first_name" / "last_name" so
 * the server action (createGuest) receives them unchanged — this island
 * only layers a NON-BLOCKING "possible duplicate" warning on top. Two
 * guests legitimately can share a name, so the host can always submit;
 * the warning links to each existing match (new tab, form state intact)
 * so they can check before they do.
 *
 * NAME SPLITTING (2026-09-14). Prefix / middle / suffix are OPTIONAL inputs
 * beside the two required ones. A host who types a whole name into First —
 * "Atty. Bob Casasola Jr.", which is exactly how prod ended up with 30 guests
 * whose first name was a bare title — gets it distributed across the boxes
 * when they leave the field.
 *
 * It splits on BLUR, never on keystroke: rewriting the box mid-word fights the
 * typist, and the split is only useful once the name is whole. Nothing is
 * hidden — every part lands in a real, editable input the host can correct,
 * and a box they have already filled by hand is never overwritten.
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
  const [prefix, setPrefix] = useState('');
  const [middle, setMiddle] = useState('');
  const [suffix, setSuffix] = useState('');
  const [dismissed, setDismissed] = useState(false);

  /**
   * Split whatever is in the two required boxes across all five. Called on
   * blur of First or Last.
   *
   * Deliberately conservative: it only WRITES a part the host has not already
   * typed themselves, and it leaves first/last alone when the parser found
   * nothing to move — so a plain "Bob" + "Casasola" is untouched, and a host
   * who hand-entered a prefix keeps it.
   */
  const splitNow = () => {
    const line = `${first} ${last}`.trim();
    if (!line) return;
    const p = parsePersonName(line);
    // Nothing to redistribute — leave the host's typing exactly as it is.
    if (!p.prefix && !p.middleName && !p.suffix && p.firstName === first.trim()) {
      return;
    }
    if (p.firstName) setFirst(p.firstName);
    if (p.lastName) setLast(p.lastName);
    if (p.prefix && !prefix.trim()) setPrefix(p.prefix);
    if (p.middleName && !middle.trim()) setMiddle(p.middleName);
    if (p.suffix && !suffix.trim()) setSuffix(p.suffix);
    setDismissed(false);
  };

  const dups = useMemo(
    () => (dismissed ? [] : findDuplicates(first, last, pool)),
    [first, last, pool, dismissed],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="name_prefix">
            Prefix
          </label>
          <input
            className="input-field"
            id="name_prefix"
            name="name_prefix"
            type="text"
            autoComplete="off"
            placeholder="Atty."
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
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
            placeholder="Maria — or paste the whole name"
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              setDismissed(false);
            }}
            onBlur={splitNow}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="middle_name">
            Middle name
          </label>
          <input
            className="input-field"
            id="middle_name"
            name="middle_name"
            type="text"
            autoComplete="off"
            placeholder="M."
            value={middle}
            onChange={(e) => setMiddle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
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
            onBlur={splitNow}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="name_suffix">
            Suffix
          </label>
          <input
            className="input-field"
            id="name_suffix"
            name="name_suffix"
            type="text"
            autoComplete="off"
            placeholder="Jr."
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
          />
        </div>
      </div>

      {dups.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-warn-300/70 bg-warn-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold leading-tight text-warn-800">
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
                    ? 'bg-danger-100 text-danger-700'
                    : kind === 'nick'
                      ? 'bg-info-100 text-info-800'
                      : 'bg-warn-200/70 text-warn-800'
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
