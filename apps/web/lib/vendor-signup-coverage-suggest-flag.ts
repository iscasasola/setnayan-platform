/**
 * The signup coverage suggestion — feature flag (C5, ships OFF).
 *
 * ⚖ OWNER + DPO RULING 2026-08-28: *"C5 yes"* — approved reading a shop's own
 * public website, free, on Setnayan's OWN initiative, to SUGGEST coverage
 * trades the shop then confirms. That is a lawful-basis and purpose change
 * from what `/privacy` declared until this same PR (Deep Search as "a paid
 * tool" the "vendor initiates"), not a wording choice — see the new
 * "Free coverage suggestion at sign-up" paragraph in
 * `app/(shell)/privacy/page.tsx`, shipped in this same change per the
 * ruling's first condition.
 *
 * 🔴 WHY DARK ANYWAY, EVEN THOUGH THE PURPOSE IS APPROVED. `vendor_web_dossiers`
 * held ZERO rows, ever, before this PR — there is no stored reading to reuse,
 * so turning this on RUNS a real model call (Anthropic web_search) for every
 * shop that adds a website, a genuine per-shop cost. The owner flips it when
 * he wants it live; this ships the framework only. Never auto-flip it.
 *
 * Server-only, not `NEXT_PUBLIC_*` — the read runs inside a server action's
 * `after()` and never in a browser. Takes the `CATEGORY_PROPOSAL_DRAFT_ENABLED`
 * shape: opt-in (`=== 'true'`, default OFF), because it spends money on a
 * model call per shop.
 *
 * 🔒 OFF IS A COMPLETE PRODUCT, NOT A BROKEN ONE. With the flag off, no
 * dossier is ever written under `kind = 'signup_suggestion'`, no suggestion
 * card ever renders, and the shop's "Your line and your link" card behaves
 * exactly as it does today — the one difference is the on-screen disclosure
 * caption under the website field, which is DELIBERATELY unconditional (it
 * declares the mechanism before it ever performs it, never the reverse).
 */
export function isVendorSignupCoverageSuggestEnabled(): boolean {
  return process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED === 'true';
}
