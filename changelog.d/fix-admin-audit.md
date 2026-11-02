## 2026-07-11 · fix(admin): audit fixes — /admin/work auth gate + orphan-queue tiles + bottom-nav activeMatch

Three confirmed admin-doorway audit findings, fixed together (admin files only).

**1 · SECURITY — /admin/work was ungated.** `app/admin/work/page.tsx` called
`getAdminQueueDigest()` (which uses `createAdminClient()`, the RLS-bypassing
service-role client) with NO page-level `requireAdmin()` — the only auth was the
layout, which council-fix-#1 documents as an unsafe boundary (layouts don't
re-run on soft navigation / crafted RSC requests). A crafted RSC request from an
authenticated non-admin could leak per-queue open counts + oldest-open
timestamps. Added `await requireAdmin();` as the FIRST statement of the page
component, matching `app/admin/page.tsx`. Swept all 58 admin pages that touch the
service-role client — `/admin/work` was the ONLY one missing the gate; every
other is already gated.

**2 · Discoverability — 7 orphan queues had no landing entry point.** After the
Overview 'queues' sidebar section defaults collapsed, 7 queues (pax-changes,
completions, repost-watch, corrections, fraud, pakanta, editorial-review)
appeared in NEITHER the `/admin` tiles, the `/admin/work` BASE_ROWS, nor the
digest QUEUE_DEFS — undiscoverable on landing, several SLA-sensitive. These are
deliberately absent from the shared digest because their open count is COMPUTED
per item (cross-table joins / jsonb severity / a JS "stuck" cut), so no live
count exists. Added a count-less "More queues" tile section on
`app/admin/page.tsx` — each of the 7 is now a clickable destination, no
fabricated numbers — restoring the "reachable via the page tiles" contract.

**3 · Mobile bottom-nav activeMatch drift.** `app/admin/_components/admin-bottom-nav.tsx`
never got the Studio/Accounts/Ugat consolidation-hub landing paths, so landing
on `/admin/studio`, `/admin/accounts`, `/admin/ugat`, or `/admin/fraud` lit NO
tab. Added the missing pathnames: 'home' += `/admin/fraud`; 'directory' +=
`/admin/accounts`; 'ugat' += `/admin/ugat`; 'more' += `/admin/studio`.

SPEC IMPACT: None — audit fixes: /admin/work auth gate, 7 orphan-queue tiles,
bottom-nav activeMatch.
