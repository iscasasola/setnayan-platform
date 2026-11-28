## 2026-11-29 · chore(deps): clear the critical and high Dependabot alerts

- **Desktop (`src-tauri/Cargo.lock` only):** `zip` 4.6.1 → 9.9.0. The fix for the `zip` advisories exists only in 9.x (RustSec patched `>= 9.0.0` / `>= 9.0.5`). `zip` is pulled in only by `tauri-plugin-updater`, and only for Windows. Its 2.11–2.14.0 releases pin `zip ^4`, so the updater moves 2.11.0 → 2.14.1. That release needs `tauri ^2.12`, so tauri moves 2.11.5 → 2.12.7 (tauri-build/plugin/runtime follow in the same line). Tauri was held at the 2.12 line on purpose: 2.13.0 (out 28 Nov) also swaps the GTK stack (gtk 0.18 → 0.19, webkit2gtk 2 → 3). Cargo.toml is unchanged. `cargo check --locked` of the whole desktop app passes on Linux.
- **Web (`pnpm.overrides`):** the brace-expansion entries are widened to 1.1.21 / 2.1.7 / 5.0.12. `source-map-js` goes to ≥1.2.2 and `postcss-selector-parser` to ≥6.1.5. All are patch bumps in the same line with no code change.
- **Left on purpose:** glob, minimatch, satori, the @opentelemetry/* set and glib (mediums). Each fix needs a major or breaking bump. The reasons are in `package.json` `pnpm.comments` and the PR body.

SPEC IMPACT: None. Dependency patch only; no product, UI or schema change.
