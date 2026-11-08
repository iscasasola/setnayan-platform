/**
 * The thread page's banner words for the Won & Lost Reasons card (`?notice=outcome_*`, `outcome-actions.ts`). Read by
 * the page's banner (`PROPOSAL_NOTICE` in `page.tsx` spreads them) and by the stay door
 * (`app/_actions/stay-registry/svMessages.ts`), so a refusal said on the card is the SAME sentence the banner says.
 */
export const OUTCOME_NOTICE: Readonly<Record<string, string>> = {
  outcome_saved: 'Outcome saved — thanks for logging it.',
  outcome_invalid: 'Pick won, lost, or no-response to log this inquiry.',
  outcome_bad_reason: 'That reason is no longer available — pick another.',
  outcome_failed: 'Couldn’t save that outcome. Please try again.',
};

/** The outcome codes that are a refusal (nothing was saved) — everything but `outcome_saved`. */
export const OUTCOME_REFUSALS: readonly string[] = ['outcome_invalid', 'outcome_bad_reason', 'outcome_failed'];
