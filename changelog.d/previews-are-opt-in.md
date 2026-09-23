## 2026-09-23 · fix(vercel): preview builds are opt-in — `preview/*` only

100% of the Vercel bill is Build CPU Minutes (740 CPU-hours / $155.51 in three days; everything
else combined is under $0.50). Measured over 0.84 days, **51 of 64 real builds were previews and
only 13 were production merges** — previews cost four times what shipping does.

`apps/web/vercel.json`'s `ignoreCommand` now builds only `main` and an explicit `preview/*`
opt-in; every other branch skips. Safe because the Vercel check is **not** one of the 13 required
checks, and 175 of the last 200 merged PRs were `claude/*` — already skipping it — and merged
normally.

The strategy is written into `CLAUDE.md` so it survives an account change, per the owner's
instruction: memory does not travel between accounts, the repo does.

SPEC IMPACT: None.
