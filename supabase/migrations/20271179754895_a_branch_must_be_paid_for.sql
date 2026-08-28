-- a_branch_must_be_paid_for
--
-- Owner-ruled 2026-08-28, two words. "Should customers ever see a supplier's
-- branches?" — YES. "Should paying for a branch be required?" — "paid".
--
-- The behaviour lives in the app (`branchIsUsable` + `resolveBranchAssignment`
-- in apps/web/lib/vendor-branches.ts), because a branch's live status is
-- DERIVED from its latest activation order rather than stored. This migration
-- closes the two database-side traps that sat underneath it.
--
-- 1 · `branch_subscription_active` DEFAULTED TO TRUE.
--     A column whose name reads "this branch is paid up" was born TRUE, so any
--     INSERT that did not name it created a fully-paid-looking branch for free.
--     It is inert as a gate — NOTHING READS IT (three writers, zero readers:
--     createBranch writes false, cancelBranch writes false, the order-activation
--     hook writes true) — and it stays that way. But a default that is the
--     privileged value is how this repo has shipped silent grants before, and a
--     later reader reaching for the obvious-looking column would inherit it.
--     Flip the default and say in the column's own comment that it is not the
--     gate.
--
-- 2 · `anon` HELD EVERY PRIVILEGE ON `vendor_branches`.
--     Read out of production, not from a migration: `anon` held table-level
--     SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES across
--     all eleven columns — the born-open Supabase default. It is inert today
--     (RLS is on and the table's two policies are `TO authenticated`, so an
--     anonymous caller reads zero rows and writes nothing), which is exactly
--     why nobody noticed. It is revoked here because this change PUBLISHES
--     branch data for the first time, and the moment to get a table's grants
--     right is the moment it starts carrying something a stranger wants.
--     🔑 Revoked at TABLE level: a column-level revoke is inert against a
--     table-level grant, and revoking column-by-column leaves the NEXT column
--     granted. `REVOKE … FROM PUBLIC` would not touch a role grant.
--
-- No public read is opened. The public shop page reads these rows with the
-- service-role client it already uses, scoped to the shop it is rendering, and
-- projects only the branch name and city.
--
-- SAFE BY ARITHMETIC AT THE WRITE: production holds ZERO rows in
-- `vendor_branches` (measured 2026-08-29), so nothing is grandfathered, no
-- supplier is locked out of a branch they are mid-term on, and no card
-- anywhere is filed under a branch at all.

ALTER TABLE public.vendor_branches
  ALTER COLUMN branch_subscription_active SET DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_branches.branch_subscription_active IS
  'BOOKKEEPING ONLY — NOT THE GATE. A branch''s live status is derived from its '
  'latest `vendor_additional_branch__{branch_id}` order (paid + inside the 28-day '
  'window = active); see deriveBranchStatus / branchIsUsable in '
  'apps/web/lib/vendor-branches.ts. This flag has three writers and zero readers. '
  'Default flipped TRUE -> FALSE 2026-08-29: it used to be born in the privileged '
  'state, so a direct INSERT produced a paid-looking branch for free.';

REVOKE ALL ON TABLE public.vendor_branches FROM anon;

COMMENT ON TABLE public.vendor_branches IS
  'Enterprise sub-location accounts. A branch is a paid add-on (owner 2026-08-28: '
  '"paid"): until its fee is confirmed and its 28-day window is live it is shown '
  'to no customer and no service card may be newly filed under it. Read by the '
  'vendor through RLS (owner + admin) and by the public shop page through the '
  'service role, scoped to the shop being rendered and projecting name + city '
  'only. `anon` holds no privilege here.';
