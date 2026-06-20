## 2026-06-20 · feat(ui): shared <BackButton> primitive — back-button lever foundation (flow wave E)

The user-flow audit found back navigation drawn ~95 different ways (24 findings): `ArrowLeft` (×80 files) vs `ChevronLeft` (×15), with gap `1/1.5/2/3`, text `xs/sm/base`, and `ink/50–85` all mixed — the classic "same control, designed differently" tell. This adds the single shared affordance every "Back to X" link should use; the per-site sweep follows incrementally (95 files, many on surfaces other PRs touch — converted as each clears).

- **`apps/web/app/_components/back-button.tsx`** (new) — `<BackButton href label className />`. One icon (`ArrowLeft`), size, spacing, tap target (`min-h-[44px]`), and tint, matching the existing pill pattern (`bg-ink/5 rounded-md`). Href-only by design (the audit found 0 `router.back()` back buttons); plain `<Link>`, so it works in server and client components.
- **Converted 2 exemplars** (admin settings back buttons), with clean import removal: `admin/settings/demo-mode/page.tsx` (dropped the now-unused `ArrowLeft` import; kept `Link` — used elsewhere) + `admin/settings/payment-methods/page.tsx` (dropped both `ArrowLeft` and `Link` — only the back button used them).

Verified: BackButton imported+used in both; 0 `ArrowLeft` left in either; demo-mode keeps `import Link` (2 other `<Link>`), payment-methods drops it (0 `<Link>`) — no orphaned imports (the main lint risk). Both files pre-flighted clear of open PRs. tsc/lint/build via CI.

SPEC IMPACT: design-system/UX only (new shared primitive). Flow wave E foundation; the ~93-file sweep is incremental follow-up. Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`.
