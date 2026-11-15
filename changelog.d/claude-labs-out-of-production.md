## 2026-11-14 · perf(build): the /dev labs are no longer built for production

Owner-approved ("yes remove the dev pages from live"). The ~86 `/dev/*` labs already 404 in production
(`app/dev/layout` gate), but `next build` still compiled every one: each dynamic lab route and every
server-action id under `app/dev` counted toward Vercel's 2,048-route cap.

- **Mechanism:** every route file under `app/dev` is renamed `page.lab.tsx` / `layout.lab.tsx` /
  `route.lab.ts` (91 files). `next.config.ts` adds `lab.tsx`/`lab.ts` to `pageExtensions` only when
  `NODE_ENV !== 'production'`, so `next dev` (labs, `E2E_LABS=1`, the lab e2e specs) still serves them and
  `next build` (production and previews) never compiles them. Chosen over a build-time move/delete of the
  folder (mutates the tree, breaks local builds) and over webpack ignore rules (they fight Next's route
  discovery instead of using it) — `pageExtensions` is the one documented Next switch for "these files are not routes".
- **Second lock kept:** `app/dev/layout.lab.tsx` still `notFound()`s in production, and every lab page and
  route handler keeps its own gate.
- **`app/dev/the-labs-never-ship.test.ts`** adds three checks: the production-only `pageExtensions`; no
  plain `page`/`layout`/`route` file under `app/dev` (and no `.lab` file outside it); nothing outside
  `app/dev` imports from it (tests aside — `lib/site-body-fixture.ts` is allowed because only tests reach
  it, which the test proves by walking its importers). Sabotaged four ways, each red.
- **`lint-server-action-budget.mjs`** no longer counts `app/dev` (6 exports): 1,251 → 1,245 against the
  unchanged CEILING of 1,251.
- `lib/ugat/scan-screens.ts` recognises `page.lab.tsx` / `route.lab.ts`, so the Ugat map keeps the labs;
  `screens.generated.json` regenerated (file names only). Tests that read lab files by path follow the rename.

SPEC IMPACT: None.
