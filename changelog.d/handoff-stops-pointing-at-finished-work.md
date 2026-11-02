## 2026-08-31 · docs(claude.md): the handoff stops pointing at two finished jobs

`CLAUDE.md`'s "what is left" block — the passage at the TOP of the file, which
every session reads before anything else — listed two items that are both done
and both fenced by a guard:

- the wedding-onboarding gate no longer posts `public_summary_consent` as a
  hidden field. `onboarding-shell.tsx` carries a `NO HIDDEN CONSENT` marker,
  held by `apps/web/app/signup/consent-is-affirmative.test.ts`.
- `guests.invitation_sent_at` now has a writer
  (`apps/web/app/dashboard/[eventId]/sponsors/actions.ts`), held by
  `apps/web/lib/the-invite-step-counts-what-is-true.test.ts`, so the guest
  list's "N to send" can decrease.

RULE 0 exists to stop sessions rebuilding what already ships. The file that
carries RULE 0 was itself directing sessions at completed work. The replacement
states both as done, cites the greppable guard for each, and says plainly that
a handoff decays fastest where it is read most — including that block.

SPEC IMPACT: None — repo guidance only.
