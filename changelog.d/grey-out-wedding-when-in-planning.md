## 2026-09-11 · fix(create-event): the Wedding choice is greyed out — never a click into a wizard that refuses at the end

Owner ruling 2026-09-11 (DECISION_LOG.md), verbatim: *"they shouldn't even
allow the creation/step 1 of clicking the wedding event. it should be greyed
out since it is not available."*

- `dashboard/create-event` picker: tapping Wedding while the account has a
  wedding still IN PLANNING no longer redirects into `/onboarding/wedding`.
  The click handler checked `type.onboardingHref` before the existing
  in-planning check could run, so the guided-router block already built into
  `event-type-picker.tsx` (edit the same-marriage wedding / vow renewal /
  new-marriage-blocked) was dead code for this path — the redirect always won.
  The order is now: in-planning check first, guided router shown in place;
  every other type's redirect is unchanged.
- The Wedding tile itself now shows a plain reason ("Already planning
  <name>") and a dimmed/greyscale treatment, but stays a live tap target
  (reachable-as-disabled) — never a dead `disabled` control — so tapping it
  still reveals the guided router rather than doing nothing.
- `/onboarding/wedding`'s own server page now checks
  `getInPlanningWedding` BEFORE any of the wizard's data fetches. A signed-in
  account with a wedding in planning never renders a single screen of the
  wizard (not even Welcome) — it lands on a small notice naming the existing
  wedding, with a real link to it and to the events dashboard. This covers
  every one of the ~20 marketing pages that link straight to
  `/onboarding/wedding`, without touching any of them. Signed-out visitors are
  unaffected — the check only ever runs for a real signed-in user id.

Deferred by design (not in this PR): the generic onboarding's own
one-at-a-time "You already have one of these in planning" entrance check
(`onboarding/[type]/_components/generic-onboarding.tsx`) and the dead-end
"Go to my dashboard" button fix both live in `onboarding-shell.tsx` /
`generic-onboarding.tsx`, which the parallel FIX-DASHBOARD-BUTTON session is
already editing (uncommitted, no PR yet as of this PR). Touching those files
here would conflict with that work; the DECISION_LOG row for this ruling
explicitly sequences GREY-OUT's onboarding-shell work after FIX-DASHBOARD-BUTTON
merges. A follow-up PR will apply the same entrance check to the generic
onboarding once that lands.

New guard: `wedding-tile-greyed-when-in-planning.test.ts` (source-anchored,
mutation-tested — the redirect-before-guard ordering bug was confirmed to
turn it RED, then restored) asserts (a) the picker's redirect branch is
unreachable for an in-planning Wedding tap, (b) the tile stays a live tap
target rather than a dead disabled control, and (c) the onboarding entrance
guard runs before the wizard's data fetch and before `OnboardingShell` ever
renders.

SPEC IMPACT: None — extends the existing owner-locked one-wedding-in-planning
rule (wedding-guard.ts, 2026-07-12); no new rule, no schema change.
