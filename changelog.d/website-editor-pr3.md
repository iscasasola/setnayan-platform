# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(website): inline edit panels in the unified editor + `return_to` (PR-3)

PR-3 of 5 for the Unified Website Editor — the couple starts editing **inside** the editor instead of navigating to a sub-page.

- **`lib/editor-return.ts` (new) — the blocker the build plan didn't anticipate.** Every `/website/*` action ends with `redirect('/dashboard/[id]/website/<sub>')`, so an inline panel calling one would bounce the couple OUT of the editor — exactly the jumping the editor exists to end. Rather than fork the write layer (a second set of actions is the drift hazard this whole program removes), actions now ask `resolveReturnTo(formData, fallback, suffix)` where to land. **Opt-in and default-identical:** with no `return_to` field — i.e. every existing sub-page form, untouched — it returns the action's own fallback, so those flows behave exactly as before. The value is attacker-supplied form data feeding a `redirect()`, so it is fenced to plain internal `/dashboard/…` paths (no scheme, host, `//`, backslash, whitespace or control characters); **4 unit tests** cover the open-redirect shapes.
- **Adopted in** `what-to-bring` · `special-message` · `our-story` · `dress-code` actions (success redirect only; error paths unchanged).
- **Inline panels** — `_components/text-panel.tsx` (new): a plain `<form action={serverAction}>` posting to the **same** action the sub-page uses, with the hidden `return_to` pointing back at `editor?open=<row>`. Form-only, no client state (works on slow 4G, matching the widgets editor's no-JS posture). Wired for **Special message** and **What to bring**, which are clean single-field writes.
- **Rail rows expand in place** — a row WITH a panel is now a disclosure button (chevron, `aria-expanded`) that opens inline; a row without one still deep-links to the editor that owns it. `?open=<rowKey>` re-opens the row after a save round-trip, so the couple lands back exactly where they were, preview refreshed alongside.

Deliberately still deep-linked (correctness over completeness, per the build plan): `our-story` (merged `love_story` + `together_since` shape), hero photo / gallery (R2 upload flows), dress code (multi-field), editorial, Save-the-Date, and the Pro set — **PR-4** takes the Pro rows + unlock sheet, **PR-5** thins the sub-pages to `editor#anchor` redirects. No migration.

SPEC IMPACT: None — implements the design's PR-3; the `return_to` mechanism is an additive extension of the existing write layer, not a new one.
