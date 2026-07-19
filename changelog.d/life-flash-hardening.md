## 2026-07-09 · perf+a11y(life-flash): stream the home card + focus-trap the flash

Two launch-readiness hardenings flagged when the home card / flash shipped:

- **Perf:** the Life-Flash home card (which reuses `fetchMomentGraph`) is now wrapped in `<Suspense>` with a skeleton, so it streams in behind the account home — the dashboard (busiest authed page) paints instantly instead of blocking on the graph summary.
- **A11y:** the fullscreen flash modal now traps Tab within the overlay (wraps first↔last focusable). Tab is treated as navigation, so it never triggers the pause-on-interaction rule. Completes the PR-4 safety contract's keyboard-operability item.

typecheck ✓ · lint ✓ · radius ✓ · tests green. Feature still flag-off in prod.

SPEC IMPACT: None.
