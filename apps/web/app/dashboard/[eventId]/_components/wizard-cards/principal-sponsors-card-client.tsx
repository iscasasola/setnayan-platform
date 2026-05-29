'use client';

/**
 * Card 20 Principal Sponsors · client UI · inline list builder.
 *
 * Three sub-surfaces stacked in the card body:
 *   1. Cultural brief — short paragraph explaining what principal sponsors
 *      do in a Filipino wedding (witness · sign marriage contract · stand
 *      with the couple at the altar). Helps non-PH partners / first-time
 *      hosts understand why this card matters.
 *   2. Picked pairs list — every existing principal sponsor pair on this
 *      event, with a polite Remove affordance per pair (calls
 *      removePrincipalSponsorPair).
 *   3. Inline form — two name inputs (ninong + ninang) + an optional
 *      side picker for each. Submit calls addPrincipalSponsorPair which
 *      creates BOTH event_sponsors rows atomically sharing a pair_index.
 *   4. [Mark sponsors done] CTA — calls generic markTaskDone with
 *      task_id='principal_sponsors'. Civil-only / non-Catholic hosts can
 *      skip via the same CTA when no pairs are locked (label flips to
 *      "Skip · no principal sponsors").
 *
 * Filipino convention: typically 4 pairs (PRINCIPAL_PAIR_DEFAULT in
 * lib/event-sponsors.ts). Range 2-12. The wizard doesn't enforce this —
 * any pair count ≥1 is enough to advance. Hosts who already have a long
 * list from /sponsors page see it summarized here automatically.
 *
 * NO LINKS to /sponsors from inside the focus-card body per the wizard
 * contract. The full /sponsors page stays reachable via the dashboard
 * sub-nav for secondary sponsor tiers + richer per-sponsor editing.
 */

import { useState, useTransition } from 'react';
import { CheckCircle2, Plus, Trash2, Users } from 'lucide-react';
import {
  addPrincipalSponsorPair,
  removePrincipalSponsorPair,
  markTaskDone,
} from '../../wizard-actions';

type SponsorRow = {
  id: string;
  pair_index: number | null;
  side: 'groom' | 'bride' | 'neutral';
  full_name: string;
  invitation_status: string;
};

type PairBucket = {
  pairIndex: number | null;
  sponsors: SponsorRow[];
};

type Props = {
  eventId: string;
  pairs: ReadonlyArray<PairBucket>;
};

type SponsorSide = 'groom' | 'bride' | 'neutral';

const SIDE_LABEL: Record<SponsorSide, string> = {
  groom: "Groom's side",
  bride: "Bride's side",
  neutral: 'Neutral',
};

export function PrincipalSponsorsCardClient({ eventId, pairs }: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(pairs.length === 0);
  const [ninongName, setNinongName] = useState('');
  const [ninangName, setNinangName] = useState('');
  const [ninongSide, setNinongSide] = useState<SponsorSide>('groom');
  const [ninangSide, setNinangSide] = useState<SponsorSide>('bride');
  const [pendingPairIndex, setPendingPairIndex] = useState<number | null>(null);
  const [isAddingPair, startAddPairTransition] = useTransition();
  const [, startRemovePairTransition] = useTransition();
  const [isMarkingDone, startMarkDoneTransition] = useTransition();

  function handleAddPair(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    if (ninongName.trim().length === 0 || ninangName.trim().length === 0) {
      setErrorMessage('Both ninong and ninang names are required.');
      return;
    }

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('ninong_full_name', ninongName);
    formData.set('ninang_full_name', ninangName);
    formData.set('ninong_side', ninongSide);
    formData.set('ninang_side', ninangSide);

    startAddPairTransition(async () => {
      try {
        await addPrincipalSponsorPair(formData);
        // Reset for the next pair — most hosts add 2-4 pairs in a row.
        setNinongName('');
        setNinangName('');
        setNinongSide('groom');
        setNinangSide('bride');
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't add this pair. Try again.";
        setErrorMessage(message);
      }
    });
  }

  function handleRemovePair(pairIndex: number) {
    setErrorMessage(null);
    setPendingPairIndex(pairIndex);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('pair_index', String(pairIndex));

    startRemovePairTransition(async () => {
      try {
        await removePrincipalSponsorPair(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't remove this pair. Try again.";
        setErrorMessage(message);
      } finally {
        setPendingPairIndex(null);
      }
    });
  }

  function handleMarkDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'principal_sponsors');

    startMarkDoneTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't advance — try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Cultural brief — explains why this card matters in PH weddings */}
      <div className="rounded-xl border border-ink/10 bg-white/50 p-4">
        <div className="flex items-center gap-2">
          <Users
            aria-hidden
            className="h-4 w-4 text-terracotta"
            strokeWidth={2}
          />
          <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            What a principal sponsor does
          </h4>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink/75">
          Your ninong and ninang stand with you at the altar, sign your
          marriage contract as witnesses, and become guides for your
          marriage going forward. Filipino weddings typically invite{' '}
          <strong>2 to 12 pairs</strong> — pick the people whose
          guidance you want to carry with you.
        </p>
      </div>

      {/* Picked pairs list */}
      {pairs.length > 0 ? (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {pairs.length} principal sponsor pair{pairs.length === 1 ? '' : 's'} locked
          </p>
          <ul className="space-y-2">
            {pairs.map((pair, idx) => {
              const isPending =
                pair.pairIndex !== null && pendingPairIndex === pair.pairIndex;
              return (
                <li
                  key={pair.pairIndex !== null ? `pair-${pair.pairIndex}` : `solo-${idx}`}
                  className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 sm:py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      Pair {pair.pairIndex ?? idx + 1}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {pair.sponsors.map((sponsor) => (
                        <li
                          key={sponsor.id}
                          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                        >
                          <span className="font-semibold text-ink">
                            {sponsor.full_name}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                            {SIDE_LABEL[sponsor.side]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {pair.pairIndex !== null ? (
                    <button
                      type="button"
                      onClick={() => handleRemovePair(pair.pairIndex!)}
                      disabled={isPending}
                      title="Remove this pair"
                      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-ink/50 transition-colors hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      <span className="sr-only">Remove pair {pair.pairIndex}</span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Inline form */}
      {showForm ? (
        <form
          onSubmit={handleAddPair}
          className="space-y-3 rounded-xl border border-terracotta/30 bg-cream p-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Add a new pair
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ninong-name"
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
              >
                Ninong full name <span className="text-rose-700">*</span>
              </label>
              <input
                id="ninong-name"
                type="text"
                value={ninongName}
                onChange={(e) => setNinongName(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g. Tito Marcel Reyes"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
              <select
                value={ninongSide}
                onChange={(e) => setNinongSide(e.target.value as SponsorSide)}
                className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              >
                <option value="groom">Groom&apos;s side</option>
                <option value="bride">Bride&apos;s side</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="ninang-name"
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
              >
                Ninang full name <span className="text-rose-700">*</span>
              </label>
              <input
                id="ninang-name"
                type="text"
                value={ninangName}
                onChange={(e) => setNinangName(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g. Tita Cora Santos"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
              <select
                value={ninangSide}
                onChange={(e) => setNinangSide(e.target.value as SponsorSide)}
                className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              >
                <option value="bride">Bride&apos;s side</option>
                <option value="groom">Groom&apos;s side</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isAddingPair}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
              {isAddingPair ? 'Adding…' : 'Add this pair'}
            </button>
            {pairs.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isAddingPair}
                className="text-sm text-ink/55 transition-colors hover:text-ink disabled:opacity-50"
              >
                Hide form
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add another pair
        </button>
      )}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Mark-done CTA */}
      <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-5">
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isMarkingDone}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          {isMarkingDone
            ? 'Saving…'
            : pairs.length > 0
              ? 'Mark sponsors done'
              : 'Skip · no principal sponsors'}
        </button>
        {pairs.length === 0 ? (
          <p className="text-xs text-ink/55">
            Civil weddings often skip this — pick at least one pair above
            or mark done to move on.
          </p>
        ) : (
          <p className="text-xs text-ink/55">
            You can refine each sponsor&apos;s contact info, send
            invitations, and track responses later from your Sponsors
            page.
          </p>
        )}
      </div>
    </div>
  );
}
