## 2026-11-27 · docs(audit): speed per page

A read-only speed audit of every page: `docs/audits/2026-11-27/speed.md`. No app code changed.

- **Per route:** database reads before first paint, waterfalls, first-load JS from a `next build`, and live timing for 57 public URLs at 375 px and desktop.
- **Top 15 fixes**, in ten groups that do not share files.
- **Main findings:**
  - The `(shell)` layout's `force-dynamic` makes every marketing page `no-store`.
  - Each page blocks on 845 KB of CSS and uses 3 to 5% of it.
  - Unknown URLs take about 2 s to answer 404.
  - "Add expense" fetches its sheet's code only on the first tap.

SPEC IMPACT: None
