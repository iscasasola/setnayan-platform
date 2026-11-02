## 2026-07-10 · fix(vendors): animate the Shortlist bench accordion expand/collapse

The couple **Shortlist** bench (`ShortlistCategories`) folders + categories snapped open/closed with no motion — the body was conditionally UNMOUNTED (`{open ? <body/> : null}`), so there was nothing to animate in either direction (the old `slcat-rise` keyframe only ran a small fade-in on mount, never on collapse).

Ported the prototype's technique: each `fold-body` / `cat-body` is now **always mounted** inside a grid-rows wrapper (`.fold-collapse` / `.cat-collapse`), and toggling the existing `.open` class animates `grid-template-rows: 0fr ↔ 1fr` — a smooth height transition **both ways** (300ms), with an opacity fade. The single-open behavior, deep-link open, saved-request icons, and connecting rail are unchanged (still driven by the same `openFolder` / `openTile` state).

Accessibility + motion preserved: collapsed bodies get `overflow:hidden` + a **delayed `visibility:hidden`** (flips after the collapse finishes) so collapsed content leaves the tab order without cutting the animation; `prefers-reduced-motion` disables the transitions (instant open/close). No behavior/logic change — pure render-structure + CSS.

Files: `apps/web/app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx`.

SPEC IMPACT: None — animation/render-structure only; no schema, pricing, SKU, or engine change.
