## 2026-09-06 · fix(admin/gifts): return_to for grant forms, real SKU-level vendor comps, close the tier-source trip-wire

`build-sessions/GIFTS-PLAN.md` § G6 — three defects on `/admin/gifts`.

### 1 · A grant issued from `/admin/gifts` bounced you off the page

`setVendorTier` and `issueCompGrant` always redirected to their own home page
(`/admin/vendors/:id/plan`, `/admin/users`) even when the form was rendered
inside `/admin/gifts`'s search-and-grant flow — so comping a vendor or a user
from the gifts console lost your place. Both actions now accept an optional
`return_to=/admin/gifts` hidden field (an allowlist, mirroring
`free-windows-actions.ts`'s `RETURN_TARGETS` — never a bare passthrough), and
land back on `/admin/gifts` with a banner it already knew how to render
(`?banner=`). Every other caller (the vendor's own `/plan` page,
`/admin/users`, `/admin/accounts?tab=users`) doesn't set the field, so their
existing redirects are byte-identical to before.

### 2 · `comp_grants.vendor_profile_id` was dormant — no SKU-level vendor comp existed

An admin could comp a vendor's whole subscription tier (`setVendorTier`) but
had no way to comp ONE add-on without touching the tier. New action
`issueVendorSkuComp` (apps/web/app/admin/vendors/actions.ts) wires exactly one
SKU — Papic Challenges, the vendor product this plan already named — through
`comp_grants.vendor_profile_id`. The grant is real, not a ledger entry that
looks like one: it writes the exact column
`public.vendor_papic_challenge_entitled()` checks
(`vendor_profiles.papic_challenge_expires_at`), stacking from the later of now
/ the current expiry, same rule the vendor's own self-serve free-cycle path
uses. `comp_grants` gets the audit row (`source: 'external_promo'`, `scope:
'specific_skus'`, `vendor_profile_id` set, `user_id` null).

⚠ Read `enforce_vendor_self_comp_quota` (BEFORE INSERT trigger, migration slug
`self_review_gate`) before touching this column again — it only counts a
`vendor_profile_id` row against a vendor's quarterly self-comp quota when
`source = 'vendor_self_comp'`. `issueVendorSkuComp` always writes
`'external_promo'`, so it can never silently consume that allowance — verified
by reading the trigger body, not assumed.

Deliberately NOT generalized to "any vendor SKU": every other add-on (3D
Booth, Deep Search, seats, branches, the portfolio pack) has its own resolver
with no shared choke point (`lib/promo-free-windows.ts`), so widening this
would mean shipping a comp that records itself but grants nothing for those
SKUs — the exact disease this codebase's CLAUDE.md is themed around. Comping
another add-on means writing that SKU's own direct-grant branch, documented at
`VENDOR_COMPABLE_SKUS`'s docblock.

Surfaced on both `/admin/vendors/:id/plan` (a new "Papic Challenges" section,
current state + a comp button) and `/admin/gifts` (a second small form under
the tier form; the "Active comp grants" table now resolves a vendor-targeted
row's business name instead of rendering a blank "—" for it, and
`describeReach` names the vendor-shop case instead of falling through to the
account-wide "not tied to an event" wording it wasn't).

### 3 · Closed the `fetchCompedVendors` trip-wire instead of just re-flagging it

That reader's own docblock already warned: `tier_state <> 'free'` reads as
"comped" only because `setVendorTier` is the ONLY writer of a non-free tier
today; the day self-serve vendor billing ships, a paying vendor would read
identically to a gift, with no column to tell them apart. Migration
`20271209332066` adds `vendor_profiles.tier_source` (`'admin_comp'` |
`'self_serve'`, defaulting every existing + new row to `'admin_comp'` — true
of every row in production today). `setVendorTier` stamps it explicitly on
every write; `fetchCompedVendors` now filters on it. The trip-wire is closed,
not just documented: the future self-serve writer falls out of "comped"
automatically by stamping `'self_serve'`, no code change needed here.

SPEC IMPACT: None — no price, SKU, or entitlement rule changes. Papic
Challenges' price, cadence and gate are unchanged; this only adds an
admin-triggered way to grant it for free, using the same entitlement column
the paid path already writes.
