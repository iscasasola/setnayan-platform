# HANDOVER — rd/maker-first-load-headroom · started 2026-10-18 ~20:50 PHT by the controller

BLOCKER: the Maker's first-load JS is AT its budget (507.0 KB of 507.0 KB gz, measured by CI's "bundle size check" on
main 1e5178d). Any PR merged now fails the check by a few bytes even when it touches no Maker code (webpack runtime
holds every chunk hash) — #6643 (copy-only) is red for exactly this. Every future Maker PR (Desktop, overlay effects)
will hit the same wall.
FIX: make real headroom — target ≥ 6 KB gz under budget — WITHOUT raising the budget (raising it needs an owner ruling).
Measure first: the bundle check's own report (the per-chunk list for the Maker route) + `pnpm --filter @setnayan/web
analyze` or the repo's bundle script if one exists. Then move the biggest pieces that are NOT needed for the Maker's first
paint into lazy chunks (dynamic import on open: sheets, pickers, panels behind a tap, desktop-only code, dev-only code,
large constants/registries read only after a tap). No behaviour change; phone first paint must stay identical.
Prove: CI bundle check numbers before → after in the PR body; the Maker's touched tests green; a 375 px walk that the
Maker opens and the lazy pieces load on tap.
Commit + push after every step; HANDOVER current — the account may stop you any time; this is the top item for the next
controller if unfinished. Fragment changelog.d/rd-maker-first-load-headroom.md.
