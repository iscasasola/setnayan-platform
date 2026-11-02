## 2026-09-09 · fix(explore): a signed-out couple sees the shops

The marketplace body lists one card per SERVICE. That one read was made with
the VISITOR'S session while every other read on the page uses the admin client.
`vendor_services_public_read` is `TO authenticated`; its sibling
`vendor_profiles_public_read` is `TO authenticated, anon`.

Measured in production through a real anonymous PostgREST client:
`vendor_profiles` → 2 rows, `vendor_services` → 0 rows. The live
`https://www.setnayan.com/explore` returned 176 KB of HTML with zero
occurrences of either shop's name, under the heading "The first shops".

RLS refuses without raising, so the read returned `[]`, the existing `.catch`
fallback never fired, and an access decision rendered as an empty marketplace —
the first screen of the two-sided walk.

Repair: pass the admin client for that read (one identifier). The alternative —
adding `anon` to the policy — is not equivalent: `anon` already holds
table-level SELECT on `vendor_services` with no column allowlist, so admitting
it to the policy publishes all 40 columns (`is_demo`, `demo_batch_id`,
`daily_capacity`, `credit_price_centavos`, `branch_id`) to any holder of the
public key. That widens a table when the thing that needed widening was a page.

The admin client is safe here because `fetchMarketplaceServiceCards` writes the
live rule into its own query (active card + shop verified + publicly visible)
rather than trusting RLS — its docblock says so explicitly. Two paired guards
pin both halves.

SPEC IMPACT: None. No product rule changes; no price, SKU or visibility rule is
moved. The set of shops a stranger may see is unchanged — it is the set the
policy already describes, now actually delivered.
