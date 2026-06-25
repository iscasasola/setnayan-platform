## 2026-06-26 · fix(security): close money-path holes (revoke token-mint RPCs + column-write guards)

From the 2026-06-26 adversarial money-path bug-hunt (6 finders × 3-skeptic
verify). Closes 2 blockers + 3 unauthorized-mutation holes — all the same shape:
an RPC/app-layer guard was treated as the gate, but the grant/RLS left the
sensitive surface directly reachable. **Already applied to prod**; this lands the
repo migration + the `logPayment` code guard.

- **BLOCKER #1 — free token minting.** `grant_admin_direct_tokens` +
  `consume_vendor_assets_per_voucher` were `EXECUTE`-granted to anon/authenticated
  with no caller check → any logged-in/anon user could self-mint unlimited
  spendable vendor tokens. **REVOKEd** from anon/authenticated/PUBLIC (internal
  callers are `SECURITY DEFINER`/postgres, the admin path uses `service_role` →
  no legit-path impact; live-tested unaffected).
- **BLOCKER #2 — free everything.** `orders` RLS (`FOR ALL`, owner) let a customer
  UPDATE their *own* order to `status='paid'` / `confirmed_total_php=0` → unlock
  every paid SKU with no payment. New `BEFORE UPDATE` trigger blocks direct
  authenticated/anon non-admin writes to `status` (except the legit self-cancel)
  and all money columns; admin / service_role / DEFINER bypass. **Live-tested:**
  forge BLOCKED, self-cancel allowed, admin exempt.
- **#5 / #10 — forged confirmations.** Same guard on
  `event_vendor_payments.vendor_confirmed_at` (a couple can't forge a vendor
  payment confirmation) and `event_vendor_payment_plan.cleared_at` (a host can't
  self-clear past the all-installments gate). Legit writes go through the DEFINER
  RPCs `confirm_vendor_payment` / `clear_vendor_payment_plan`.
- **#11 — payment pinned to a stranger's order.** `logPayment` now asserts the
  order is one the caller can see (RLS-scoped read) before inserting — previously
  any `order_id` was accepted.

SPEC IMPACT: None (security hardening; no SKU / price / flow change). The
remaining bug-hunt findings — #3 receipt voucher base, #6/#7/#8 surcharge &
stale-proposal amounts, #4/#12/#14 races, #9 client-trusted price, #13
cross-event order, #15 re-lock — are tracked for follow-up PRs.
