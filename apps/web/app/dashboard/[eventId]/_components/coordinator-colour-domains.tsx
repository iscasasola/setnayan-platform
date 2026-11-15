'use client';

/**
 * MB16 · the coordinator's colour domains — a CHECKLIST, never one switch.
 *
 * A port of `vendor-colour-access.html`'s coordinator card. The prototype's own
 * framing, and the owner's ruling behind it: *"A coordinator isn't tied to one
 * craft the way a vendor is — they can hold access across several parts of your
 * design at once. Grant only what makes sense; each one is its own switch."*
 *
 * 🔑 IT IS KEYED TO THE PERSON, NOT TO A BOOKING. Their grant is the
 * `event_members` row with `member_type = 'coordinator'` that
 * `sync_delegate_membership` mints when a delegate accepts — a coordinator has
 * no `vendorId` of their own. It moved off the Hosts page in the Hosts fold
 * (2026-09-30): the hired planner's copy sits on their supplier workspace
 * (`promote-coordinator-card.tsx`); a limited helper's goes on their guest
 * card with the rest of the helper grants (build F2, after the card redesign).
 * Who is listed is assembled once, in `lib/colour-access.server.ts`.
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
import { formatCount } from '@/lib/format-number';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

const LABEL = 'text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';

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
    // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 7 · 13 · 14): no tile and no card per person — grey capitals with the
    // explaining paragraph behind the ⓘ; each person is a bold line over plain hairline rows, their "N of M on" a soft
    // chip; sub-section labels in grey capitals (never 10 px typewriter); full-strength ink.
    <section id="colour-domains" aria-labelledby="colour-domains-heading" className="space-y-3">
      <h2 id="colour-domains-heading" className="flex items-center gap-1.5">
        <Palette aria-hidden className="h-3.5 w-3.5 text-terracotta-700" strokeWidth={1.75} />
        <InfoTip label="Colour access" labelAs="span" labelClassName={LABEL} align="start">
          A coordinator isn’t tied to one craft the way a supplier is — they can hold access across several parts of
          your design at once. Grant only what makes sense; each one is its own switch. You’re told about every change,
          and you can undo any single one without touching their access.
        </InfoTip>
      </h2>

      <ul className="space-y-6">
        {people.map((p) => (
          <li key={p.userId}>
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-ink/10 pb-2">
              <div>
                <p className="text-[15px] font-bold text-ink">{p.displayName}</p>
                <p className="text-[13px] text-ink/75">{p.roleLine}</p>
              </div>
              <Badge tone={p.active.length > 0 ? 'ok' : 'quiet'}>
                {formatCount(p.active.length)} of {formatCount(COLOUR_DOMAINS.length)} on
              </Badge>
            </div>

            <p className={`mt-[18px] ${LABEL}`}>Colour domains</p>
            <ul className="divide-y divide-ink/10">
              {COLOUR_DOMAINS.map((domain) => {
                const on = p.active.includes(domain);
                const key = `${p.userId}:${domain}`;
                return (
                  <li key={domain} className="flex min-h-14 items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={busy === key}
                      aria-describedby={`${key}-desc`}
                      onChange={() =>
                        run(key, () => setDomainAction(p.userId, domain, !on), {
                          not_a_coordinator:
                            'That person isn’t an accepted host on this event any more.',
                        })
                      }
                      className="mt-0.5 h-5 w-5 flex-none cursor-pointer rounded-md border-[1.5px] border-ink/20 text-success-600 accent-success-600 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                    />
                    <div className="flex-1">
                      <p className="text-[15px] font-semibold text-ink">
                        {COLOUR_DOMAIN_LABEL[domain]}
                      </p>
                      <p id={`${key}-desc`} className="mt-0.5 text-[13px] text-ink/75">
                        {COLOUR_DOMAIN_BLURB[domain]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className={`mt-[18px] ${LABEL}`}>Recent changes</p>
            {p.changes.length === 0 ? (
              <p className="py-2 text-sm text-ink/75">No changes yet.</p>
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
        <p role="alert" className="text-[13px] text-danger-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
