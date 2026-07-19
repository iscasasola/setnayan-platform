## 2026-06-26 · fix(desktop): splash uses the current gold mark, not the stale glyph

The Tauri desktop loading splash (`src-tauri/shell/index.html`, the "Loading
Setnayan…" screen shown for the instant before the WebView redirects to
setnayan.com) carried a **pre-2026-05-31 black glyph** inline SVG. The actual app
icon (`src-tauri/icons/icon.svg`) was already the current champagne-gold mark, so
the splash was the only surface still showing the old artwork (owner-reported).

Swapped the inline SVG for the canonical mark — byte-identical to
`src-tauri/icons/icon.svg` + `apps/web/public/brand/setnayan-mark.svg` — so the
splash now matches the app icon and the in-app `<Logo>`. Dropped the now-unused
`.mark { color }` rule (the mark carries its own `fill="#cb9e4b"`).

⚠ Native-shell change: takes effect only in a NEW desktop build (`build-desktop`
is manual `workflow_dispatch`), after which the static `/download` dmg +
`apps/web/lib/desktop-release.ts` must be swapped. No effect on already-installed
apps until they update.

SPEC IMPACT: None — desktop-shell asset correction, no schema/pricing/SKU/copy
change.
