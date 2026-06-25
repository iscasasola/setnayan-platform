## 2026-06-25 · style(brand): CTA colour Rich Mulberry → Terracotta Clay

Owner picked **Terracotta Clay `#9A3B23`** to replace Rich Mulberry `#5C2542` as
the primary call-to-action / brand "focus" colour (the buttons read "purple-ish").

Done at the token source + every surface that bypasses the token, so the change
is coherent (no purple left next to terracotta):

- `globals.css` — `--color-mulberry` family (light + dark) and `--m-mulberry`
  family swapped to the clay ramp (base `#9A3B23` · hover `#7E2F1B` · deepest
  `#642514` · dark-soft `#D89C85` · wash `#F6E9E2`). Token **names kept**
  (`mulberry`) — value-only swap auto-propagates to every `bg-mulberry` /
  `var(--m-mulberry)` / `.m-btn-primary` consumer. WCAG note updated (white on
  clay ≈6.9:1 AA, ample for button labels).
- `tailwind.config.ts` — mulberry 50/100/200/300/400/800 raw-hex shades → clay.
- Hardcoded mulberry literals swept to clay where they bypass the token:
  vendors workspace tints (`rgba(92,37,66,…)`), `onboarding.css`, the whole
  `/tour/*` prototype CTAs, `email-template.ts` (button + wordmark), the social
  share cards, the public monogram-studio CTA button, `global-error.tsx`, and
  the per-couple `site-palette.ts` default CTA seed.
- **Left as-is (genuine content colours, not CTA):** the wax-seal palette,
  monogram *ink* presets/swatches (`monogram*.ts`, `monogram-studio/*`), the
  "royalty" feel-palette + STD background options. `--color-terracotta` is the
  legacy token name for Champagne **Gold** — untouched.

SPEC IMPACT: project_setnayan_palette — the Clean Editorial CTA/focus colour is
now Terracotta Clay #9A3B23 (was Rich Mulberry #5C2542). Decision-log row +
memory update to follow.
