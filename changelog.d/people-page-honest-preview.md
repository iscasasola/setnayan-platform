# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · fix(people): honest "coming soon" preview — no fake buttons

Owner (2026-07-05): the reserved People page rendered `+ Spouse` / `+ Parent` chips that *looked* tappable but did nothing ("how do I send an invite?" had no answer). The connect flow is Phase 2 (gated behind the people graph + PH counsel), so nothing there can be interactive yet.

- **`app/dashboard/(account)/people/page.tsx`** — rewritten as an unmistakable, non-interactive preview: a clear "Connections are coming soon… there's nothing to do on this page yet" banner, and the three layers (Family · Godparents/Ninong-Ninang · Friends) shown as **descriptive rows, not buttons** (no `+` chips, no lock-icon rows that read as controls). Guardrail chips reframed as descriptions. Keeps the feature's permanent nav home so the real flow drops in without a repaint.

Verified: `tsc` clean · `next lint` clean.

SPEC IMPACT: None — copy/UX honesty on the reserved People surface; no behavior, no schema.
