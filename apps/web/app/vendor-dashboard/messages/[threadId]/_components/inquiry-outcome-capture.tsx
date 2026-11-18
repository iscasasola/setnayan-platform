'use client';

import { useState } from 'react';
import { Check, Trophy, X, MessageSquareOff } from 'lucide-react';
import { recordInquiryOutcome } from '../outcome-actions';
import { StayForm } from '@/app/_components/stay-form';
import { ActionButton } from '@/components/action-button';
import { TemplateSection } from '@/app/_components/template-rows';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';

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
  { label: string; icon: typeof Trophy }
> = {
  won: { label: 'Won', icon: Trophy },
  lost: { label: 'Lost', icon: X },
  no_response: { label: 'No response', icon: MessageSquareOff },
};

/** The field's label — the template's dark grey, never ink at part strength (rule 13). */
const FIELD_LABEL = 'mb-1 block text-[13px] font-medium text-[color:var(--m-slate-2)]';

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
  const [reasonCode, setReasonCode] = useState<string>(current?.reasonCode ?? '');

  const reasonsForOutcome = outcome
    ? reasons.filter((r) => r.appliesTo === outcome || r.appliesTo === 'any')
    : [];

  return (
    <StayForm
      door="svMessages.recordInquiryOutcome"
      action={recordInquiryOutcome}
      className="py-1"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="outcome" value={outcome} />

      {/* Rule 2 · a section on the page, no card; rule 7 · the explaining line behind the ⓘ. */}
      <TemplateSection
        first
        label={current ? 'Update this inquiry’s outcome' : 'How did this inquiry end?'}
        right="Private to you"
        tip={
          <>
            Self-reported — “Won” means they booked you (off-platform), not an on-platform payment. It helps you see
            what wins and loses your inquiries.
          </>
        }
      >
        {/* Outcome picker — one pressed pill of three (rule 3: the button piece, never a hand-made pill). */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OUTCOME_META) as OutcomeState[]).map((key) => {
            const meta = OUTCOME_META[key];
            const active = outcome === key;
            return (
              <ActionButton
                key={key}
                type="button"
                tone={active ? 'brand' : 'neutral'}
                icon={meta.icon}
                label={meta.label}
                aria-pressed={active}
                onClick={() => setOutcome(key)}
              />
            );
          })}
        </div>

        {/* Reason (from the live taxonomy) + note — only once an outcome is picked */}
        {outcome ? (
          <div className="mt-3 space-y-3">
            {reasonsForOutcome.length > 0 ? (
              <div className="block">
                <span className={FIELD_LABEL}>Reason (optional)</span>
                {/* Rule 4 · a set of choices is ONE PickMenu; the hidden field still carries `reason_code`. */}
                <input type="hidden" name="reason_code" value={reasonCode} />
                <PickMenu
                  label="Reason (optional)"
                  value={reasonCode}
                  options={[
                    { key: '', label: 'No reason given' },
                    ...reasonsForOutcome.map((r) => ({ key: r.reasonCode, label: r.label })),
                  ]}
                  onPick={setReasonCode}
                  dataAttr="data-outcome-reason"
                  className="w-full !min-h-11"
                />
              </div>
            ) : (
              <input type="hidden" name="reason_code" value="" />
            )}

            <label className="block">
              <span className={FIELD_LABEL}>Note (optional)</span>
              <textarea
                name="free_text"
                rows={2}
                maxLength={1000}
                defaultValue={current?.freeText ?? ''}
                placeholder="Anything you want to remember about this one…"
                className="w-full rounded-xl border border-[color:var(--m-line)] bg-white px-3 py-2 text-sm text-ink dark:bg-raised placeholder:text-[color:var(--m-slate-3)] focus:border-mulberry focus:outline-none"
              />
            </label>

            <SupplierSubmit
              // Not `main`: Send is this screen's one filled button (rule 3).
              tone="brand"
              icon={<Check aria-hidden strokeWidth={1.9} />}
              label={current ? 'Update outcome' : 'Save outcome'}
              pendingLabel="Saving…"
            />
          </div>
        ) : null}
      </TemplateSection>
    </StayForm>
  );
}
