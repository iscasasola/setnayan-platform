## 2026-07-17 · fix(monogram): route the upload-mark reveal frame through the radius token scale

`upload-mark.tsx` carried one inline `borderRadius: 16` (+ px padding) from PR #3372,
failing the strict radius guard on main. Swapped to `rounded-2xl p-4` — same 16px,
token-routed — so `RADIUS_LINT_STRICT=1` exits 0 and the guard can be promoted to a
required check.

SPEC IMPACT: None
