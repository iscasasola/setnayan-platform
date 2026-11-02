## 2026-10-15 · fix(papic): the onboarding card says credits, not pts — and its kicker wraps instead of clipping

Owner 2026-10-15, "do the fixes" (after #6563 went live).

- `app/onboarding/_shared/services-step.tsx`: the ladder and steppers read "50 credits / +3,000 credits" (were "pts"), through `formatCount`. The kicker "Unlimited cameras · shared credits" now wraps under the title; it ran out of the card at 320/375/390.
- Every other "pts" a person reads, fixed: `lib/vendor-papic-tier.ts` `tierReadout` (supplier on-the-day badge, "Papic Lite · 1,000 credits · photos + video") and `lib/vendor-dayof-modules.ts` (the Papic module blurb, "50 credits … 70 credits").
- Guard `lib/papic-unit-is-credits.test.ts`: why it missed this — a hand-picked file list without these files, and a rule that only knew spelled-out words. Now: both files on the list, plus a tree-wide property (no number labelled "pts" in shipped code). Sabotaged once.

SPEC IMPACT: None.
