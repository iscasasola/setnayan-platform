## 2026-06-25 · chore(security): patch dependency CVEs via pnpm.overrides (3 high cleared)

`pnpm audit --prod` surfaced 18 advisories (3 high, 11 moderate, 4 low) — almost all in TRANSITIVE deps (only `postcss` is direct). Added a `pnpm.overrides` block to the root `package.json` pinning each vulnerable range to its patched floor WITHIN the same major (caret target), with the override KEY scoped to the audit's vulnerable range so only the affected instances are bumped — no parent gets a breaking major change:

- **HIGH (all cleared):** `rollup` ≥3.30.0 · `form-data` ≥4.0.6 · `protobufjs` ≥7.6.3
- **moderate/low (cleared):** `postcss` ≥8.5.10 · `dompurify` ≥3.4.11 · `@babel/core` ≥7.29.6

Result: `pnpm audit --prod` → **0 high, 0 low, 2 moderate** (down from 3/11/4). The 2 remaining (`uuid`, `@opentelemetry/core`) are OLDER-major transitive instances with no same-major patch — force-bumping them across a major would risk breaking their transitive parent, so they're deliberately left (moderate, DoS-class, low real exposure); drop the note when the upstream parent bumps.

Verified: `pnpm install` clean; re-audit confirms; `tsc` clean; 482/482 unit tests; **production `next build` succeeds** (the real dep-change check). Lockfile updated to match (CI frozen-install stays consistent).

SPEC IMPACT: None.
