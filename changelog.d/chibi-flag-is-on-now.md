## 2026-08-31 · docs(chibi): two comments that went false when the flag was set

`NEXT_PUBLIC_FIGURE_CHIBI` was set to true in Vercel Production on 2026-08-31,
which lit C5's avatar maker. Two comments described the world as it was before
that.

- `lib/venue-avatars.test.ts` — the test was named *"the flag defaults OFF, so
  production is on the fallback path"* and its comment read *"unset in this
  process, AS IT IS IN PROD"*. The production half is now false. **The assertion
  is unchanged and still correct** — an unset env var must read false. Only the
  claim about the deployment is rescoped, because a unit test cannot know it.
  Had this gone red it would have read as an avatar bug rather than a stale fact.
- `app/_components/plan3d/kit/chibi-figure.tsx` — said *"NOTHING mounts this
  yet"* and *"ships flag-dark"*. C5 (#5042) mounts it twice and the flag is on.
  Also records that PR-2 (poses) and PR-3 (the instanced chibi crowd) never
  landed, so the "later PRs" list reads as a design record rather than an
  inventory.

⚠ NOT CHANGED: `lib/chibi-config.test.ts` asserts the same default and was left
alone deliberately — its comment says *"unset in the test environment"*, which is
correctly scoped and remains true. Only claims about PRODUCTION went stale.

SPEC IMPACT: None. Comments only; no behaviour, no assertion weakened.
