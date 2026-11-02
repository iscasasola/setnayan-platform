## 2026-08-02 · sec(erasure): the last seventeen — the 78-table backlog is now ZERO

Final batch. **14 of 17 survived outright; the other three returned "keep the disposition, fix the evidence"** — no decision changed. `UNDECIDED_BACKLOG` is **empty**, `BACKLOG_HIGH_WATER = 0`.

Every subject-bearing table in the schema now carries a decision: purged, partially purged with the deferral stated, or deliberately excluded with a reason.

### 🔴 A live Instagram token erasure never reached — and the obvious fix was a no-op

`vendor_ig_connections.access_token_enc` is an encrypted Instagram OAuth token. Three stale rows of this table once blocked account deletion outright.

The settlement proposed a row-delete on `vendor_profile_id`. **That would have matched nothing.** The generic loop is `.eq(column, targetUserId)` — comparing a vendor-profile id against a user id — so it would have shipped a silent no-op wearing the shape of a fix. The table has **no user column at all**.

Its `CASCADE` is a decoy for the same reason as everything else in this run: it fires from `vendor_profiles` on a **hard** delete, and erasure never issues one.

Routed instead through the subject's own shop, the pattern `vendor_push_tokens` already uses.

### Two guards caught what review did not

- **G3** flagged `vendor_ig_connections` as unclassified — the detector sees `ig_user_id` and reads it as a subject column. It is an *Instagram* account id, not a Setnayan user, but the table needed a bucket either way.
- **G3** also caught `vendor_release_history`, which had been marked done while its rule was never written. That was my slip, not the settlement's.

### The splits

**Deleted** (`CASCADE` + `NOT NULL`): `vendor_team_members.user_id` — a seat is a credential ⚠ *collides with the open `VENDOR_LAST_ADMIN` question; that is a decision about the STORE, not a reason to keep a departed person's access* · `vendor_member_token_wallets.user_id` — an earlier pass called this "lawful retention" and was refuted; the money history lives in `vendor_token_purchases` and the redemption logs, untouched · `vendor_review_appeals.reviewer_user_id` · `vendor_event_access_grants.grantee_user_id`.

**Nulled** (staff/actor stamps): `photo_delivery_jobs.triggered_by_user_id` · `platform_compliance_facts.updated_by` · `platform_expenses.created_by` · `promo_free_windows.created_by` · `reveal_studio_config.updated_by_admin_id` · `setnayan_pay_methods.updated_by_user_id` · `site_widgets.updated_by_admin_id` · `vendor_self_comp_caps.raised_by_admin` · `vendor_recommendations.recommended_by_user_id` · `vendor_locked_qr_tokens.claimed_by_user_id` · `vendor_review_appeals.decided_by_admin` · `vendor_event_access_grants.granted_by` · `vendor_release_history.host_user_id` + `vendor_user_id`.

`vendor_event_access_grants` splits both ways deliberately: deleting on `granted_by` would revoke a **third party's** access — the `event_delegates` lesson.

**Excluded:** `platform_settings` — no user-bearing column exists, verified column by column, and zero lines in the FK map.

### The whole run

| | |
|---|---|
| bulk pass over all 78 at once | **41 wrong (53%)**, directionally toward under-erasure |
| seven batches of ~10, each adversarially attacked | **75 of 76 settlements survived** |

The recipe was the difference, not the model.

All columns exact-matched against `prod-schema.snapshot.txt`. Verified: full DB suite **752/752**, erasure guards **32/32**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — closes the RA 10173 erasure backlog. Open owner questions unchanged: the unattributable e-gift handle, and `VENDOR_LAST_ADMIN`.
