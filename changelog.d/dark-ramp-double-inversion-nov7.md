## 2026-11-07 · fix(dark): a `dark:` shade on a mirrored ramp flipped it back — 13 removed, guard added

Under `html.dark`, `globals.css` already redeclares every `--ramp-{success,warn,danger,info,terracotta,mulberry,gold,champagne,sage}-*` token read from the other end of its ladder (50 ↔ 950, 100 ↔ 900 …), so `text-danger-800` is already light in dark. A `dark:text-danger-200` written in the pre-token mental model flips it back to the dark shade: measured 1.42–3.00:1 on the dark page (#17160F), against 7.4–15.4:1 once the override is deleted. Found on PR #7374 (booking-ask-panel, 1.67:1).

- Removed 13 overrides in 7 files: `own-pay-ways`, `book-this-build`, `merkado-guard-banner` (×3, incl. a `/30` border that made a dark border vanish), `add-your-own-walk`, `supplier-connect-panel` (×5), `supplier-share-button`, `pay-ways-editor`. Light is unchanged (only `dark:` classes removed).
- Kept on purpose (3, in ALLOW with measured contrast): `swipe-to-delete` `dark:bg-danger-400` ×2 (white words: 4.65:1 vs 3.43:1 mirrored) and `colour-access-card` `dark:text-danger-800` (on the danger-100 chip: 6.15:1 vs 4.44:1).
- Left for open PRs (22, in DEBT; count may only fall): booking-ask-panel (#7374), new-manual-vendor-modal + payment-plan-rows (#7365), crew-panel + access-grants (#7308), change-the-schedule (#7307), day-check-line + waitlist-form (#7269).
- New guard `apps/web/lib/a-mirrored-ramp-takes-no-dark-override.test.ts` reads the mirrored families from `tailwind.config.ts` + `globals.css` and fails on any `dark:` utility of one outside ALLOW/DEBT. 38 → 25 overrides app-wide.

SPEC IMPACT: None
