## 2026-06-26 · fix(money): checkout/order hardening — client price, discount counter, event ownership (#9/#12/#13)

Three confirmed money bug-hunt findings (MEDIUM/LOW).

- **#9 — legacy createOrder trusted the client price.** `createOrder`
  (orders/actions.ts) inserted `requested_total_php` straight from the form with
  no server recompute, and is wired to the live patiktok-overage form. Now
  overrides it with the server-authoritative `PATIKTOK_OVERAGE_PHP` for
  `service_key='patiktok:video_overage'`. (The inline checkout `submitOrderAction`
  already server-resolves price via `resolvePaxPricedOrderCentavos`.)
- **#12 — discount use-count race.** The `uses_count` bump was a read-then-write
  (lost updates under concurrency → apply-time cap under-counts). New atomic
  `increment_discount_uses` SECURITY DEFINER RPC (service_role only); checkout
  calls it instead. (Full apply-time atomicity is a noted larger follow-up.)
- **#13 — order not verified against event ownership.** `createOrder` +
  `submitOrderAction` form-trust `event_id`, and the orders RLS only checks
  `user_id = auth.uid()`, so a forged `event_id` bound the order to a stranger's
  event. Both now assert `event_members` membership server-side before insert
  (the self-comp branch is exempt — a vendor self-comping isn't an event member).

SPEC IMPACT: None — security/correctness hardening; no SKU/price/flow change.
