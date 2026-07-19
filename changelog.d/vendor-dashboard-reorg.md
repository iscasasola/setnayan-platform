## 2026-07-01 · refactor(vendor-nav): regroup vendor dashboard into the 6-menu IA (Phase 1)

Reorganizes the vendor dashboard sidebar from 4 groups (Home · Work · Grow ·
Business) into the 6-menu IA (Overview · My Shop · My Customers · My
Performance · My Services · On the Day). This landing ships the 5
existing-route menus; the 6th ("On the Day") arrives with its route in a later
phase (orphan-prevention — no nav entry without a page).

- `app/vendor-dashboard/_components/vendor-sidebar.tsx` — rewrote
  `VENDOR_NAV_GROUPS`. Every item's key/href/matchPrefix/icon is byte-identical
  to the 4-group layout; ONLY the grouping + group labels changed. All 30 items
  preserved, none dropped. New group keys where the grouping is new
  (localStorage section-open state resets for those sections — cosmetic).
  Subscription/Tokens/Redeem sit under My Shop for now (a follow-up moves
  Subscription+Tokens to sidebar chrome chips; a later money-integrity phase
  hard-deletes Redeem code).
- `app/vendor-dashboard/_components/vendor-bottom-nav.tsx` — docstring only (the
  5-tab mobile strip is route-based, unaffected by the sidebar regroup).

The item-key role filter (`filterVendorNavGroups`), the `/more` landing + the
mobile landing (both derive from `VENDOR_NAV_GROUPS`), and the nav-registry
`vendor.sidebar.<item.key>` overrides all stay valid because item keys are
unchanged. Verified: typecheck, ESLint, lint:navicon, lint:botnav all pass.

SPEC IMPACT: None. The 6-menu IA is already captured in
`03_Strategy/Vendor_Dashboard_Build_Plan_2026-07-01.md` (the working spec for
this reorg); iteration 0022's "6 surfaces" list is stale reference per the
2026-06-07 code-is-canonical flip.
