## 2026-11-23 · fix(copy): the supplier plan names the first sweep had to skip

Words only, second half of the 22 Nov copy sweep (#8150): files that were owned by open PRs then and are free now.

- Supplier plans read **Free · Plus · Pro · Ultra**, with Verified part of Free (DECISION_LOG 2026-11-14 "NAMED PLUS · PRO · ULTRA (NO "SUPPLIER")"; 2026-11-22 "THE SHARED BRAIN" (5)):
  - the Help "what does Setnayan cost" answer no longer says "Supplier Plus, Supplier Pro and Supplier Ultra";
  - the features register no longer lists Verified as its own plan (two rows);
  - the Branches panel and the add-branch refusal say "Pro and Ultra"; the refusal now reads both names from `TIER_LABEL`, as its sibling line already did.

Still owned by open PRs and left for later: `app/vendor-dashboard/actions.ts` (#8205), `app/vendor-dashboard/team/actions.ts` (#8219), `lib/locks.ts` and `lib/cake-demo.ts` (#8231 and others), `app/admin/pricing/_surfaces/pricing-surface.tsx` (#8018).

SPEC IMPACT: None — copy brought in line with existing DECISION_LOG rows; no ruling changed.
