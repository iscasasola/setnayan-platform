# MB0 — Land the boat

**Goal:** everything already built stops being uncommitted or unmerged.

**Model:** Sonnet · high effort — landing work, but the migration needs care.
**Size:** half-day. **Depends on:** nothing. **Do this first.**

## Why it is first

PR #5113 is the platform every other session stands on, and an unmerged 30-file mega-branch is a
merge-conflict factory. Every session after this one branches from `main`, not from a feature
branch.

## Delivers

- Commit the theme-description interpreter: `apps/web/lib/theme-text-intent.ts`,
  `theme-text-intent-model.ts`, its test, and the `festive_celebratory` migration
- Commit `theme-studio.tsx`
- Finish and merge PR #5113

## Verify

- `pnpm exec tsc --noEmit` from `apps/web` — in a worktree that **has** `node_modules`; a fresh
  worktree resolves nothing and passes vacuously
- full `*.db.test.ts` replay for the migration, including `ugat-schema-claims` and
  `ugat-concept-coverage`
- `node scripts/check-migration-timestamps.mjs`
- allocate the migration prefix with `pnpm migration:new` — never hand-typed
- `node apps/web/scripts/port-controls.mjs` against the regenerated baseline

## Owner decides first

Nothing.
