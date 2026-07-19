## 2026-07-09 · style(nav): wine the chrome — nav active-state gold → wine across all 3 doorways

The "Energy, not skin" reskin flipped `--color-mulberry` to wine (#5C2542, PR #2931) but that only fed `bg-mulberry` CTAs. The nav chrome uses a SEPARATE `--m-*` token layer whose active accent was still champagne gold (`--m-orange` #C5A059) — so wine content sat behind a gold rail, the first seam a user notices.

Adds a `--m-nav-active` / `--m-nav-active-soft` wine token pair to the `--m-*` block in `globals.css` and repoints every nav active-state at it. The flip is centralized in the two shared primitives, so all three doorways inherit it with zero per-doorway edits:

- **sidebar-item.tsx** — active accent bar, active/ancestor icon, active-row bg wash, tab-child active, focus outline (customer · account · admin desktop rails all delegate to `SidebarItem`).
- **bottom-nav.tsx** — active tab icon (`BottomNavTab` + `AccordionCell`) + focus outlines (customer · admin mobile bars delegate to `BottomNav`).
- **sub-nav.tsx** active-pill icon · **sidebar-shell.tsx** + **top-nav-utils.tsx** focus outlines (the adjacent chrome, so no gold active-state remains anywhere).

Gold (`--m-orange`) is deliberately KEPT as the secondary accent — eyebrows, filter chips, and the "new" badge tones stay champagne; only the nav active-state moves to wine. The neutral ink traveling-pill on the bottom nav is unchanged (it was never gold). `--m-orange` is NOT globally redefined — it still feeds Save-the-Date `--sd-gold`, heading underlines, and eyebrows across ~200 surfaces.

Verified: runtime tokens resolve (`--m-nav-active` → `rgb(92,37,66)`; the `color-mix` soft wash resolves; `--m-orange` gold preserved for badges) + a before/after render proof from the live served tokens. Build compiles clean.

⚠ Owner note: the nav active accent (wine) now equals the primary CTA color (`bg-mulberry`, also #5C2542). The pre-reskin design separated active-state (gold) from CTA (wine); unifying them is the intended wine-forward direction but flattens that distinction — say the word if you want a slightly distinct active-state wine shade.

SPEC IMPACT: None — visual reskin only; no schema, SKU, or pricing change. Implements the owner-flagged "wine the sidebar / chrome" open item from the "Energy, not skin" reskin (see the whats-next backlog).
