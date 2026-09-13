## 2026-09-11 · fix(vendor-dashboard): the retired verify page leads to the papers screen, and its upload gates refuse a foreign ref in plain English

- `/vendor-dashboard/verify` (701-line "12-document … unlock Pro Vendor"
  checklist) is retired as a standalone destination. It now only
  `redirect()`s to `/vendor-dashboard/shop#get-verified` — the current papers
  flow (#5395) — preserving its old deep-link query params (`error` /
  `slot_saved` / `submitted` / `withdrawn`), the same pattern
  `/vendor-dashboard/services` already uses. Its `actions.ts` is left in place
  unused (grepped: nothing outside the retired page calls it). The Event Hub
  "Get verified" link and the `vendor.sidebar.verify` nav entry now point
  straight at the papers anchor instead of bouncing through the redirect.
  `apps/web/scripts/port-control-baseline.json` regenerated from the merged
  tree — the removed route deliberately drops the old checklist's controls
  (`lint-port-no-lost-controls` green).
- Bundle override: the two app-side verification-upload gates
  (`app/vendor-dashboard/verify/actions.ts`,
  `app/vendor-dashboard/shop/inline-docs-actions.ts`) gated their ownership
  check on a plain, exact-case `ref.startsWith('r2://')`. A ref spelled
  `R2://…`, or padded with a leading character beyond what `.trim()` covers,
  took the "not a ref, nothing to check" branch and wrote straight into
  `doc_uploads` — which the database's own #5414 RESTRICTIVE policy
  (`20271219262486_every_cleanup_delete_is_pinned.sql`) then refused with a
  raw `new row violates row-level security policy` error. Both gates now call
  a new shared `looksLikeStorageRef` (`lib/r2-client-ref.ts`), which
  normalises exactly the way that policy judges a ref — strip every leading
  non-alnum character, lower-case, test for `r2:` — so a foreign ref is caught
  and refused with the existing plain "That file reference isn't valid"
  message before the database ever sees it.

SPEC IMPACT: None.
