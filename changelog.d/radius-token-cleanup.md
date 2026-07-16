## 2026-07-16 · fix(ui): route the 3 remaining ad-hoc corner radii through the --m-r-* tokens

The `lint radius tokens` CI job (RADIUS_LINT_STRICT=1) was red on main with three pre-existing hardcoded pill radii from the creator-program surfaces: `creator-badge.tsx` (inline `borderRadius: '999px'`) and `app/u/[userSlug]/page.tsx` (2× `border-radius: 999px`). All three now use `var(--m-r-full, 999px)` — the same convention the rest of the `/u` page already follows — per the owner-locked "softer corners" token scale (2026-06-20). Zero visual change (`--m-r-full` is the pill radius; the old value remains as fallback). Lint verified clean locally; the check can now be promoted to required whenever the owner wants.

SPEC IMPACT: None
