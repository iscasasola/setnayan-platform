# Changelog fragment — claude/monogram-swatch-polish

## 2026-07-17 · fix(monogram): one circular swatch language — no more oblong palettes (owner refinement)

Owner: "i do not want oblong color palettes. make them all legible and balanced … follows our website's overall design." Two causes, both fixed in the v2 studio CSS:

- The backdrop row used 34×26 rounded rectangles while ink/outline used circles — mixed shapes read unbalanced. All swatch classes now share ONE language: **36px circles, 1px hairline, gold selection ring, 8px rhythm, gentle hover scale** — the site's gold/cream atelier grammar.
- The deeper bug: the app's global 44px touch-target `min-height` was silently stretching EVERY swatch into a vertical oval (30×44) — the actual "oblong" the owner saw. Width/height/min/max are now pinned on `.sw`/`.bg`/`.cust`, and 36px keeps a comfortable touch size inside the 44px row.
- The transparent-backdrop checker tightened to 8px squares so it reads inside a circle.

Verified live: ink/outline/backdrop/custom all measure exactly 36×36 with the gold ring on selection. v1 markup untouched (flag-off unchanged).

SPEC IMPACT: None.
