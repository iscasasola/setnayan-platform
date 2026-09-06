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

### Follow-up in the same PR — the new column needed the value-level guard too

CI caught `tier_source` as an exposure widening. It is not one **in the sense the
guard means**: `vendor_profiles` grants `authenticated` SELECT+INSERT+UPDATE on
all ~105 of its columns, and `tier_state`, `tier_expires_at`,
`papic_challenge_expires_at`, `pending_tier` and `subscription_credit_php` are
every one of them already `authenticated=SIU` in the baseline. On this table the
gate is not the grant — it is `guard_vendor_profiles_entitlement`, a BEFORE
INSERT/UPDATE trigger that refuses vendor-initiated changes to exactly those
columns. So the baseline is regenerated (one added line, `anon=-
authenticated=SIU`, sitting between its two already-accepted neighbours) rather
than narrowed with a column REVOKE, which would have been inconsistent with 110
siblings and would break any ordinary profile save that names the column.

**But `tier_source` had not joined that trigger, and that WAS a real hole.**
`vendor_profiles_owner` is `FOR ALL … USING (user_id = auth.uid())`, so a vendor
can PATCH their own row over PostgREST with the public anon key. RLS is
ROW-level: the policy that lets a vendor edit their own shop cannot stop them
writing a particular VALUE into it. Flipping `tier_source` to `'self_serve'`
grants no tier — which is exactly why it slipped past review — but it makes a
GIFTED tier read as PURCHASED, removing the vendor from `fetchCompedVendors` and
from `/admin/gifts`: the one distinction the column exists to record.

🔑 **The guard that fired was pointing at the accepted half.** The exposure
freeze measures GRANTS, and on this table the answer is always "granted, on
purpose". The half that mattered — the missing trigger clause — had nothing
watching it at all.

The migration now re-emits `guard_vendor_profiles_entitlement` in full
(CREATE OR REPLACE, the house pattern) with `tier_source` added to both the
INSERT and UPDATE branches, and nothing else changed. Service-role writes are
deliberately unaffected, so self-serve checkout can still record `'self_serve'`
truthfully when it ships. Held by four new cases in
`apps/web/tests/db/vendor-addon-selfgrant-guard.db.test.ts` — the vendor cannot
flip it, cannot be born with it, service_role still can, and re-stating the
current value does not break an ordinary save. Both refusal cases were
mutation-proven: with the two guard clauses removed they go red.


SPEC IMPACT: None — no price, SKU, or entitlement rule changes. Papic
Challenges' price, cadence and gate are unchanged; this only adds an
admin-triggered way to grant it for free, using the same entitlement column
the paid path already writes.
