## 2026-07-09 · style(vendors): two-column Merkado layout (PR-4 · S1)

First slice of the two-column Merkado workspace (owner asks a + e). Reflowed the couple **Services** takeover (`ServicesTakeover`) from a single vertical stack into a **two-column desktop layout**: the tall **shortlist** on the left, **build + compare** in a **sticky right rail** that stays in view while you browse categories.

- **Mobile is unchanged** — the grid collapses to one column and the right wrapper is a normal block, so shortlist → build → compare still stack exactly as before; the docked sub-nav, `BB_TAB_EVENT` bus, anchor nav, and scroll-spy all keep working.
- **Same single DOM** — the shortlist/build/compare slots are only reflowed by CSS grid + `position: sticky`, **never mounted twice**, so there's zero duplicate client state. No slot/prop/`page.tsx` changes; the 3-state build engine, package cascade-lock, and `BuildCompare` internals are untouched.
- Layout-only: `grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start` with the right rail `lg:sticky lg:top-4 lg:self-start`.

Behind `BUDGET_BUILD_ENABLED` with the rest of the takeover. Next slices (S2–S6): vendor hub · search-first IA · watch guard + demand watch · premium mode (AI-sub gated) · 1-click 3-option build + concierge.

Files: `apps/web/app/dashboard/[eventId]/vendors/_components/services-takeover.tsx`.

SPEC IMPACT: None — responsive layout reflow only; no schema, pricing, SKU, or engine change.
