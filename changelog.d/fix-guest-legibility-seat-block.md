## 2026-06-22 · fix(a11y): bump the "Your seat" kicker to 12px — clears the guest-legibility guard on main

The advisory `lint guest legibility` guard was RED on `origin/main`: PR #2012's `app/[slug]/_components/your-seat-block.tsx` shipped a guest-facing `text-[11px]` "Your seat" kicker that isn't in `.guest-legibility-baseline.json`, so every in-flight PR inherited a failing (non-required) check.

Fix: `text-[11px]` → `text-xs` (12px — the guard's stated minimum for small labels). Raising the size is the on-mandate fix (Setnayan has a guest-legibility mandate); the baseline was deliberately NOT touched. `node scripts/lint-guest-legibility.mjs` now prints OK; `tsc` clean.

SPEC IMPACT None (1-line Tailwind size token on a guest surface).
