'use client';

import { useState } from 'react';
import { Trophy, X, MessageSquareOff } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { recordInquiryOutcome } from '../outcome-actions';

/** Shape passed from the server — the LIVE admin-managed taxonomy, never a
 *  hardcoded list. `appliesTo` lets us filter chips to the chosen outcome. */
export type OutcomeReasonOption = {
  reasonCode: string;
  label: string;
  appliesTo: 'won' | 'lost' | 'no_response' | 'any';
};

type OutcomeState = 'won' | 'lost' | 'no_response';

const OUTCOME_META: Record<
  OutcomeState,
  { label: string; icon: typeof Trophy; activeClass: string }
> = {
  won: {
    label: 'Won',
    icon: Trophy,
    activeClass: 'border-mulberry bg-mulberry/10 text-mulberry',
  },
  lost: {
    label: 'Lost',
    icon: X,
    activeClass: 'border-terracotta bg-terracotta/10 text-terracotta-700',
  },
  no_response: {
    label: 'No response',
    icon: MessageSquareOff,
    activeClass: 'border-ink/40 bg-ink/[0.04] text-ink',
  },
};

/**
 * Won & Lost Reasons capture card (Wave 6) — the vendor self-reports how this
 * inquiry ended. Shown once a thread is resolved (accepted or declined) so the
 * vendor can log the outcome + a reason from the admin-managed taxonomy.
 *
 * "Won" is a SELF-REPORTED signal, not a verified on-platform payment (Setnayan
 * settles off-platform) — the copy says so.
 *
 * The reason options come straight from the DB taxonomy (passed as `reasons`);
 * this component NEVER hardcodes the list — it only filters the given options to
 * the chosen outcome (plus the 'any' codes).
 */
export function InquiryOutcomeCapture({
  threadId,
  reasons,
  current,
}: {
  threadId: string;
  reasons: OutcomeReasonOption[];
  /** A previously-recorded outcome for this thread, if any. */
  current?: { outcome: OutcomeState; reasonCode: string | null; freeText: string | null } | null;
}) {
  const [outcome, setOutcome] = useState<OutcomeState | ''>(current?.outcome ?? '');

  const reasonsForOutcome = outcome
    ? reasons.filter((r) => r.appliesTo === outcome || r.appliesTo === 'any')
    : [];

  return (
    <form
      action={recordInquiryOutcome}
      className="rounded-xl border border-ink/10 bg-cream p-4"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="outcome" value={outcome} />

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          {current ? 'Update this inquiry’s outcome' : 'How did this inquiry end?'}
        </p>
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
          Private to you
        </span>
      </div>
      <p className="mt-1 text-xs text-ink/55">
        Self-reported — “Won” means they booked you (off-platform), not an
        on-platform payment. It helps you see what wins and loses your inquiries.
      </p>

      {/* Outcome picker */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(OUTCOME_META) as OutcomeState[]).map((key) => {
          const meta = OUTCOME_META[key];
          const Icon = meta.icon;
          const active = outcome === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOutcome(key)}
              aria-pressed={active}
              className={
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ' +
                (active
                  ? meta.activeClass
                  : 'border-ink/15 bg-cream text-ink/70 hover:border-ink/35')
              }
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Reason (from the live taxonomy) + note — only once an outcome is picked */}
      {outcome ? (
        <div className="mt-3 space-y-2.5">
          {reasonsForOutcome.length > 0 ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/65">
                Reason (optional)
              </span>
              <select
                name="reason_code"
                defaultValue={current?.reasonCode ?? ''}
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-mulberry focus:outline-none"
              >
                <option value="">No reason given</option>
                {reasonsForOutcome.map((r) => (
                  <option key={r.reasonCode} value={r.reasonCode}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="reason_code" value="" />
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/65">
              Note (optional)
            </span>
            <textarea
              name="free_text"
              rows={2}
              maxLength={1000}
              defaultValue={current?.freeText ?? ''}
              placeholder="Anything you want to remember about this one…"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-mulberry focus:outline-none"
            />
          </label>

          <SubmitButton
            pendingLabel="Saving…"
            className="inline-flex h-10 items-center rounded-lg bg-mulberry px-4 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            {current ? 'Update outcome' : 'Save outcome'}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
