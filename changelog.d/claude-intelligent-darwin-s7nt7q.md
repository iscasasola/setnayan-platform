## 2026-11-27 · docs(audit): themes + design consistency

Read-only audit of every route under `apps/web/app/**` for hard-coded colours, dark-mode coverage and consistency with the house design standard. The full report is `docs/audits/2026-11-27/themes-design.md`.
- Live public pages were checked at 375 / 820 / 1440 px, light and dark.
- The report has a per-route table, 20 fixes in 7 builder groups with no file overlap, a SEAT section and a "not covered" list.
- No app code changed.

SPEC IMPACT: None. A read-only audit. Two owner calls are flagged inside: `/forgot-password` following the phone like `/login`, and the dark ready-list's reach.
