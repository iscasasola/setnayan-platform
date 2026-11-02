## 2026-08-02 · sec(erasure): ten more settled — and a financial identifier that cannot be attributed to either partner

Fifth batch, same recipe. **10 of 10 survived** (the lone "overturn" returned *"keep the column contract exactly as proposed, fix the filing"*). Backlog **37 → 27**.

Most are harmless staff stamps on platform content — which admin last verified a knowledge-base entry, minted a discount code, flipped a per-event feature. The row holds no subject; only the stamp does.

### 🔴 `event_egift_methods` — filed PARTIALLY, and it needs an owner ruling

This table holds where wedding guests send money: `method_kind` (gcash / maya / bank / paypal), `account_name`, `handle` — a GCash number, a bank account number, or a PayPal.me URL — and the couple's uploaded payment QR.

`created_by_user_id` is nulled. **The financial identifiers are retained**, and the reason is a data problem, not a policy preference:

> The stamp records **who first pressed Add**, not whose account it is. The update path rewrites `method_kind`, `label`, `account_name`, `handle`, `qr_r2_key` and `note` — but deliberately never rewrites `created_by_user_id`. So a row now holding **the other partner's** GCash number still carries the leaver's uuid forever.

Nothing in the schema maps a payout destination to partner 1 or partner 2 (`event_members.role` is only `'host'|NULL`; `events` has `bride_name`/`groom_name` but no partner FK). So:

- **Deleting on the stamp** strips the surviving partner's payout destination off their own live guest page.
- **Keeping the row** means a financial identifier can outlive an erasure request when its owner cannot be proven.

Under the owner's 2026-07-26 ruling — *delete only what is provably the leaver's* — it is retained and flagged. ⚠ **This needs a DPO/owner call**; it is the same shared-record question already deferred for `events.our_photos`, but with bank details rather than photos.

### `discount_code_eligible_users` — also partial

`added_by_admin_id` is nulled. `user_id` is `CASCADE` + `NOT NULL`, so the schema's verdict is that the row dies with the account — but the grant is the platform's record of a commercial concession it made. Retained on that basis and **flagged rather than silently deleted**.

### The rest

| delete on | null |
|---|---|
| `community_members.user_id` — `CASCADE` + `NOT NULL`; the row *is* this person's membership | `concierge_brain_chunks.last_verified_by_user_id` |
| `coordinator_feature_recommendations.recommended_by_user_id` — ⚠ `NOT NULL`, no FK, so nulling would void the statement | `concierge_plan_templates.admin_edited_by_user_id` |
| | `concierge_response_cache.admin_edited_by_user_id` |
| | `discount_codes.created_by_admin_id` |
| | `event_feature_policy_override.set_by_admin_id` |
| | `event_inspiration_assets.added_by_user_id` |

All 10 columns exact-matched against `prod-schema.snapshot.txt`; every split matches the FK map's verdict, so **G6 needed no exception**.

Verified: full DB suite **752/752**, erasure guards **32/32**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — but `event_egift_methods` raises an owner/DPO question about retaining unattributable financial identifiers.
