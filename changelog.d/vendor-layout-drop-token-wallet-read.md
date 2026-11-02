## 2026-08-08 · perf(vendor): the retired token currency was still being read on every navigation

The vendor sidebar's token pill was deleted on 2026-08-07 with the token economy
(owner lock 2026-07-21: *"token can retire, there should be nothing that needs
token anymore"*; PRs #4220/#4222/#4223 removed the last writers). **The query
behind it was not.** `apps/web/app/vendor-dashboard/layout.tsx` kept selecting
`vendor_wallets.purchased_tokens, earned_tokens` — and kept firing an
`evaluate_earned_token_expiry` write RPC in `after()` whenever that read came
back non-zero.

That is not a cold path. This layout reads cookies via `getCurrentUser()`, so it
re-renders **server-side on every sidebar navigation**. Every vendor click paid
one round trip for a value nothing rendered, and any vendor still holding a stale
non-zero earned balance also paid a post-response background write.

The sweep was already a no-op twice over: tokens are retired, and
`20270406637718_tokens_never_expire.sql` had extended every live voucher to a
2999 sentinel — there is no expiry left to evaluate.

- **Removed** the `vendor_wallets` select from the chrome probe, and the
  `evaluate_earned_token_expiry` `after()` block.
- **Kept** the `tier_state` probe unchanged — it is load-bearing for the sidebar
  Plan chip (`VendorSidebarFooter`) *and* for the `sweep_vendor_tier_expiry`
  tier-lapse sweep, which is the live user of the post-response `after()` pattern
  the token sweep used to sit next to.
- **Renamed** `tierWalletPromise`/`tierWallet` → `tierProbePromise`/`tierProbe`.
  A local named `tierWallet` with no wallet in it is the exact shape of stale
  claim this repo keeps getting bitten by.
- The 2026-07-01 perf structure is preserved: the probe still chains off
  `vendorProfilePromise` so it overlaps `getSwitcherData()` rather than queuing
  behind the chrome batch. It is now one query in that slot instead of two.
- `apps/web/lib/ugat/graph.ts` — the F7 `tier-lapsed-badges` trace pointed at
  `layout.tsx:250` for the tier sweep; this change moves it to `:238`. Pointer
  updated so the map does not go quietly stale.

Verified before deleting: `tokenBalance`/`earnedTokens` had **no consumers
outside `layout.tsx` itself** — `VendorSidebarFooter` takes `{ tier }` alone, and
the `/vendor-dashboard/tokens` page named in the old comment no longer exists.
Untouched by design: `lib/ugat/data.ts` and `lib/vendor-autoreply/auto-accept.ts`
still read `vendor_wallets` — both are outside this task's scope and neither sits
on a per-navigation path.

`pnpm --filter web typecheck` clean · `lint` clean (only pre-existing warnings in
unrelated files) · `lib/nav-badges.test.ts` 10/10 · ugat unit suite 68/68.

SPEC IMPACT: None. This came out of a design-only review pass
(`FABLE_Vendor_Dashboard_Spec_2026-08-08.md` § 5.7); the spec records the finding
and is deliberately left untouched. No product decision changes — the token
retirement it implements was already locked 2026-07-21 and shipped 2026-08-07;
this only removes code that outlived it.
