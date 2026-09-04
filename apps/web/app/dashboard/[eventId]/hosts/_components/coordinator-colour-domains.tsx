'use client';

/**
 * MB16 · the coordinator's colour domains — a CHECKLIST, never one switch.
 *
 * A port of `vendor-colour-access.html`'s coordinator card. The prototype's own
 * framing, and the owner's ruling behind it: *"A coordinator isn't tied to one
 * craft the way a vendor is — they can hold access across several parts of your
 * design at once. Grant only what makes sense; each one is its own switch."*
 *
 * 🔑 IT IS HERE AND NOT ON A VENDOR PAGE BECAUSE A COORDINATOR HAS NO
 * `vendorId`. Their grant is keyed to the PERSON — the `event_members` row with
 * `member_type = 'coordinator'` that `sync_delegate_membership` mints when a
 * delegate accepts. A booked planner/coordinator who was never promoted to a
 * host has no such row, which is why their vendor workspace card points here
 * instead of offering a switch that would mean the wrong thing.
 *
 * ⚠ THIS IS NOT `permissions_json.areas.mood_board`, AND THE TWO DO NOT
 * OVERLAP. That flag decides whether a delegate may OPEN the mood board;
 * `mood_board: 'view'` is the coordinator default and it confers no write at
 * all — `couple_can_update_event` is `member_type = 'couple'` only, so no
 * delegate has ever been able to change a colour, whatever their areas map
 * said. These grants are the only door, and they go through
 * `apply_colour_change`. Neither reads the other.
 */

import { useState, useTransition } from 'react';
import { Palette } from 'lucide-react';
import {
  COLOUR_DOMAINS,
  COLOUR_DOMAIN_BLURB,
  COLOUR_DOMAIN_LABEL,
  type ColourChangeRow,
  type ColourDomain,
} from '@/lib/colour-access';
import { ColourChangeRowView } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/colour-access-card';

type Result = { status: string };

export type CoordinatorColourGrantee = {
  userId: string;
  /** The person's name as the hosts page already prints it. */
  displayName: string;
  /** "Coordinator · added by you, Aug 12" — resolved on the server. */
  roleLine: string;
  /** The domains currently ACTIVE for this person. */
  active: readonly ColourDomain[];
  /** This person's own changes on this board, newest first. */
  changes: readonly ColourChangeRow[];
};

export function CoordinatorColourDomains({
  people,
  setDomainAction,
  rejectAction,
}: {
  people: readonly CoordinatorColourGrantee[];
  setDomainAction: (userId: string, domain: string, active: boolean) => Promise<Result>;
  rejectAction: (changeId: string) => Promise<Result>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (people.length === 0) return null;

  function run(key: string, fn: () => Promise<Result>, refusals: Record<string, string>) {
    setBusy(key);
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.status !== 'ok') {
          setMessage(refusals[r.status] ?? 'That didn’t go through. Reload and try again.');
        }
      } catch {
        setMessage('That didn’t go through. Reload and try again.');
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <section
      id="colour-domains"
      aria-labelledby="colour-domains-heading"
      className="sn-tile space-y-3 p-5"
    >
      {/* 🔑 A <div>, NOT A <header>. `.sn-eye`'s own spec in globals.css calls it
          a "Tile eyebrow", and this IS a tile — one card inside the hosts page.
          Wrapping it in <header> is the shape that drifted the card token onto
          real page headers, which is what scripts/lint-page-masthead.mjs
          watches for; the page's own masthead is <PageMasthead>, above. */}
      <div className="space-y-1">
        <p id="colour-domains-heading" className="sn-eye">
          <Palette aria-hidden className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.75} />
          Colour access
        </p>
        <p className="max-w-prose text-sm text-ink/65">
          A coordinator isn’t tied to one craft the way a vendor is — they can hold access
          across several parts of your design at once. Grant only what makes sense; each one
          is its own switch. You’re told about every change, and you can undo any single one
          without touching their access.
        </p>
      </div>

      <ul className="space-y-4">
        {people.map((p) => (
          <li key={p.userId} className="rounded-xl border border-ink/10 bg-cream/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 pb-3">
              <div>
                <p className="text-sm font-bold text-ink">{p.displayName}</p>
                <p className="text-xs text-ink/55">{p.roleLine}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${
                  p.active.length > 0
                    ? 'bg-success-100 text-success-900'
                    : 'bg-ink/5 text-ink/50'
                }`}
              >
                <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-current" />
                {p.active.length} of {COLOUR_DOMAINS.length} on
              </span>
            </div>

            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              Colour domains
            </p>
            <ul className="divide-y divide-ink/10">
              {COLOUR_DOMAINS.map((domain) => {
                const on = p.active.includes(domain);
                const key = `${p.userId}:${domain}`;
                return (
                  <li key={domain} className="flex items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={busy === key}
                      aria-describedby={`${key}-desc`}
                      onChange={() =>
                        run(key, () => setDomainAction(p.userId, domain, !on), {
                          not_a_coordinator:
                            'That person isn’t an accepted host on this celebration any more.',
                        })
                      }
                      className="mt-0.5 h-5 w-5 flex-none cursor-pointer rounded-md border-[1.5px] border-ink/20 text-success-600 accent-success-600 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                    />
                    <div className="flex-1">
                      <p className="text-[13.5px] font-semibold text-ink">
                        {COLOUR_DOMAIN_LABEL[domain]}
                      </p>
                      <p id={`${key}-desc`} className="mt-0.5 text-xs text-ink/55">
                        {COLOUR_DOMAIN_BLURB[domain]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              Recent changes
            </p>
            {p.changes.length === 0 ? (
              <p className="py-1.5 text-[13px] text-ink/55">No changes yet.</p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {p.changes.map((row) => (
                  <ColourChangeRowView
                    key={row.change_id}
                    row={row}
                    busy={busy === row.change_id}
                    /* 🔑 THE DOMAIN CHIP IS ON THIS SIDE AND NOT THE VENDOR'S.
                       A vendor's whole log is one lane, so tagging every row
                       with it would be noise. A coordinator can hold four at
                       once, and "which hat were they wearing" is the first
                       thing the couple needs to know about a row. */
                    showDomain
                    onReject={() =>
                      run(row.change_id, () => rejectAction(row.change_id), {
                        already: 'You already put that one back.',
                        frozen:
                          'That part has been signed off since, so its colour can’t move — ask the supplier to re-open it first.',
                        slot_gone:
                          'That colour slot no longer exists on your board, so there’s nowhere to put it back.',
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {message ? (
        <p role="alert" className="text-xs text-danger-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
