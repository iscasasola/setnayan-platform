## 2026-07-01 · feat(vendors): personal (per-member) token wallets — PR2/2

Tokens are now **personal to the holder** (owner-locked 2026-07-01, founder
default). Any member can buy; an admin may buy FOR a teammate; balances are
**non-transferable once credited**. PR2 of 2 — builds on the multi-admin org
model (PR1).

**Design — minimal blast radius on a live revenue table** (migration
`20270401611377_vendor_personal_token_wallets.sql`)

- `vendor_wallets` (PK `vendor_id`) is **unchanged** — it is now, semantically,
  the **founder's** wallet. The entire earned / voucher / 45-day-expiry /
  telemetry-reward / admin-grant / subscription-bundle subsystem keeps running
  on it untouched. **Zero migration of live balances.**
- New `vendor_member_token_wallets(vendor_id, user_id)` holds **non-founder**
  members' personal purchased balances (RLS: member reads own, admin reads team;
  writes only via DEFINER RPCs).
- `unlock_vendor_event` (burn-on-answer) re-keyed from the live body
  (`20270331100000`) with **two** changes only: (a) the gate widens from
  founder-only to any answering member (`admin`/`agent`); (b) the burn debits
  the **answering member's own** balance — founder → store wallet (existing
  voucher→purchased FIFO via `consume_vendor_assets_per_voucher`), member →
  personal balance via new `consume_member_purchased_tokens`. Tier gates, weekly
  cap, region→band, idempotency-per-(vendor,event) preserved byte-for-byte.
- `vendor_token_purchases` gains `holder_user_id` (buyer by default; admin may
  set a teammate; legacy rows back-credited to the founder). `create_…` resolves
  the buyer's store via membership and enforces admin-only "buy for a teammate";
  `approve_…` credits the **holder** (founder → `vendor_wallets`, member →
  `vendor_member_token_wallets`).

**Behavior preservation:** the founder is an admin, so every existing
founder-only flow (burn + buy + grant) is byte-identical; all member paths are
additive.

**UI**

- `/vendor-dashboard/tokens`: a "Credit these tokens to" recipient picker
  (Yourself / a teammate) on the buy card for admins with a team, plus a "Team
  token balances" panel showing where personally-held tokens landed.
- `tokens/actions.ts` passes the chosen `holder_user_id`.

SPEC IMPACT: covered by the 2026-07-01 DECISION_LOG row + memory
`project_setnayan_vendor_org_governance` (the personal-token rule). Memory
`project_setnayan_vendor_token_model` should note: earned/voucher/granted tokens
are founder-held; purchased tokens are personal per holder.
