## 2026-07-21 · fix(admin): make the "Delete user" button actually work — 41 restrictive FKs + an unconditional vendor guard

The admin console's hard-delete (`/admin/accounts` → Users → Delete / Blacklist)
has been **non-functional for any user with real activity** since it shipped.
The action itself was fine — correct guards, audit logging, RA 10173 pre-purges —
but the DB rejected the underlying `DELETE FROM auth.users` two ways:

1. **41 foreign keys to `auth.users` / `public.users` were `ON DELETE NO ACTION`**,
   which *restricts*: it neither cascades nor nulls, so one referencing row aborted
   the whole delete. Measured against prod 2026-07-21: a single active account had
   **43 blocking rows across 9 tables** (`oauth_state`, `event_inspiration_assets`,
   `vendor_ig_oauth_state`, `discount_codes`, `event_category_build_state`, …).
2. **`vendor_team_guard()` raised `VENDOR_LAST_ADMIN` unconditionally** when a
   store's only admin was removed, with no exemption for "the store itself is
   being deleted". Every vendor is the sole admin of their own store, so **no
   vendor account could ever be deleted.**

Knock-on: `/admin/account-deletions` delegates to the same `deleteUser()`, so the
**RA 10173 right-to-erasure queue was broken too** — a formal erasure request could
not be honored through the product.

**Migration `20270830213463_fix_user_hard_delete_blockers.sql`** re-declares all 41
FKs with a deliberate per-column rule rather than a blanket sweep:

- **CASCADE** where the row is *about* the departing user or is ephemeral scratch
  state — abuse flags, delegate grants, founder time log, OAuth handshake state,
  render jobs.
- **SET NULL** (dropping `NOT NULL` where needed) where the row must **outlive**
  the person — `event_action_log` (per-event audit trail), `order_ledger`
  (BIR-relevant financial ledger), `discount_code_redemptions`, and event content
  like inspiration assets / playlist picks that belongs to the couple rather than
  to whoever typed it. De-identify, don't destroy — which is also what RA 10173
  erasure wants.

Two footguns caught while choosing: CASCADE on `discount_codes.created_by_admin_id`
would have deleted the discount **code** when its author left, and CASCADE on
`order_ledger.actor_user_id` would have punched holes in the financial ledger.
Both are SET NULL.

`vendor_team_guard()` gains a store-teardown exemption: `vendor_team_members.
vendor_profile_id` is `ON DELETE CASCADE`, so during a store delete the parent
`vendor_profiles` row is already gone when the trigger fires — that absence is the
signal. Every other branch (last-admin protection on a live store, the
two-admin-vote rule) is byte-for-byte unchanged.

`deleteUser()` / `blacklistUser()` gain `deleteSoleAdminVendorStores()`, which drops
any store whose **only** admin is the departing user before the auth delete. Stores
with a co-admin are untouched — the leaver's membership just cascades away. Unlike
the RA 10173 purges this is deliberately *not* best-effort: if the stores can't be
cleared the auth delete is guaranteed to fail, so it stops with a legible message
instead of half-running. Store teardown is audit-logged under its own action
(`vendor_store_deleted_with_sole_admin`) — dropping a business shouldn't be buried
inside a user-delete row.

**Verified against prod** (transaction + forced rollback, nothing committed):
the full migration applies with **0 NO ACTION FKs remaining**, and with it applied
a real account that previously could not be deleted — 43 blocking rows plus a
sole-admin store — deletes cleanly (`stores_deleted=1 users_deleted=1`).

Known gap left alone (pre-existing, out of scope): `deleteUser` still does not
delete the departing user's **events** — `events` has no owner FK, so memberless
orphans accumulate. 59 of 63 events were orphans when this was found; they were
cleaned up manually. Worth its own PR.

SPEC IMPACT: `DECISION_LOG.md` — new row recording that admin hard-delete and the
RA 10173 erasure queue were non-functional until this migration, and the
CASCADE-vs-SET NULL retention rule now encoded in the schema.
