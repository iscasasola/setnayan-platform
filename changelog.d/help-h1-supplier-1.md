## 2026-11-14 · feat(help): H1 — 35 supplier answers for opening a shop, Today, setup, verification, your page, cards, the booking fee and plans

Fills `apps/web/lib/help/supplier-1.ts` (areas S1–S6, S8, S9, S22 of the help coverage map) with 35 new public Help answers in 8 topics. Each answer's source is named in a comment above it (a greppable string in the shipped code). No rate, price, credit amount or plan limit is typed; plan names are Supplier Plus · Supplier Pro · Supplier Ultra; the plan answers and every in-app wording that would name a price carry an `appBody` (the Plan page and /for-suppliers are not in the iPhone app).

Left out on purpose: S7 Packages (behind `NEXT_PUBLIC_PACKAGE_AUTHORING`), the per-plan feature list (behind the server flag `VENDOR_TIER_FEATURE_GATE` — the answer points at the plan table instead), and what paying the booking fee opens (flag + DB switch).

The Settings row "How booking works" (`app/vendor-dashboard/settings/settings-rows.ts`) now opens `/help/how-booking-works` instead of the /help index.

SPEC IMPACT: None.
