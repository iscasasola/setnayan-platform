## 2026-11-18 · ci: one production build in ci.yml · delete the unused `@setnayan/shared` package

- `bundle size check` was a job of its own that ran a second full `next build` of the same commit, only to measure it. Its two budget steps (shared bundle size, the Maker's first-load JS) now read the `build` job's build, and that job posts `bundle size check` under its exact required name through `scripts/ci-report-checks.mjs` — green only when the build and both budgets passed; a budget failure still does not turn `production build` red. `ci-gate.test.mjs` now fails if ci.yml runs a second production build.
- Per ready PR: ci.yml jobs 15 → 14 (24 before #7981); production builds 4 → 3 (ci.yml 2 → 1; e2e and lighthouse keep their own).
- `packages/shared` (`@setnayan/shared`) deleted: imported by nothing in `apps/web`, `apps/mobile`, `src-tauri`, `scripts` (`git grep "@setnayan/shared"` → only its own package.json). Dropped from `pnpm-workspace.yaml`, the lockfile importers, and `apps/web/vercel.json` `ignoreCommand`. turbo.json named nothing package-specific.
- Not done (deliberately): sharing the build with e2e/lighthouse as an artifact — they are separate workflows that start in parallel, lighthouse builds with different env, and e2e overlaps its build with the apt install; doing it means moving both into ci.yml behind `needs: build`. Left as a follow-up.

SPEC IMPACT: None
