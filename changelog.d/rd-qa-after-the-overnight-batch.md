## 2026-10-22 · fix(features): /features names the bars that ship — Today · Customers · Shop · Hub, and Hub for the host

QA regression walk after the 21→22 Oct overnight batch (≈35 merged PRs; the findings list is in the PR
body, evidence in `shots-2026-10-22/qa-overnight/`). One small, safe fix from it:

- `/features` and `/tl/features` ("How it works · who's who") still said a supplier works in
  "Today · Customers · Shop · **More**" after the supplier bar became **Today · Customers · Shop · Hub** (#6748), and
  the host line said "**Event Hub**" where the couple's bar says **Hub** (the bare "Event Hub" is the guest page).
  Both lines now say the shipped bars, in both locales.
- Guard: `app/features/the-features-bars-are-the-shipped-bars.test.ts` holds each line against the bars' own label
  sources (`VENDOR_BOTTOM_NAV_ITEMS`, `buildCustomerMenuTree`), not a typed copy — so the next bar change fails here
  instead of leaving the public page behind. Sabotage-checked (each old line restored → red).

SPEC IMPACT: None — copy now matches the 2026-10-21 supplier-bar ruling already in DECISION_LOG.
