/**
 * The drafted category proposal — feature flag (C4, ships OFF).
 *
 * ⚖ WHY DARK. Production holds ZERO category requests, ever (measured by the
 * object 2026-08-28), so there is nothing for this to draft and no way to watch
 * it behave on real words. The owner switches it on the day a real supplier
 * first types something we have no trade for — which is also the first moment
 * the draft can be judged against anything true. Never auto-flip it.
 *
 * Server-only, not `NEXT_PUBLIC_*`: the drafting runs inside the
 * `proposeCategory` server action and never in a browser, so it takes the
 * `SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED` / `CSAM_HASH_MATCH_ENABLED` shape.
 * Opt-in (`=== 'true'`, default OFF) because it spends money on a model call
 * and writes a suggestion beside a control that mints a permanent public
 * category — never the `!== 'false'` shape used for safe, proven cleanup jobs.
 *
 * 🔒 OFF IS A COMPLETE PRODUCT, NOT A BROKEN ONE. With the flag off nothing is
 * drafted, the drafts table stays empty, and both screens render exactly as
 * they do today: the supplier's request lands in the same queue and the admin
 * sees the same four buttons. Nothing about the supplier's path is gated on it.
 */
export function isCategoryProposalDraftEnabled(): boolean {
  return process.env.CATEGORY_PROPOSAL_DRAFT_ENABLED === 'true';
}
