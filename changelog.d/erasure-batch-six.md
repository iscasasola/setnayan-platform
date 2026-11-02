## 2026-08-02 · sec(erasure): ten more settled — and internal-team records are not exempt

Sixth batch, same recipe. **10 of 10 survived, zero overturned** — the cleanest round so far. Backlog **27 → 17**.

Most are exactly what they look like: an admin's identity stamped on platform configuration — which staff member last swapped a homepage clip, changed a feature's policy, acknowledged an internal ops alert. The row holds no subject; only the stamp does, and only the stamp goes.

### Internal-team records are not exempt

`founder_seats` and `founder_time_log` are internal records, and both are `CASCADE` + `NOT NULL` on `user_id` — the schema's own verdict is that they die with the account.

A founder seat is a **per-person entitlement**, not config. A time log is **hours worked by that person**. So an internal team member's erasure request reaches their own records exactly like anyone else's. Nothing here is exempted for being ours.

### The one that splits both ways

`event_schedule_suggestions` carries two person columns and the schema sorts them opposite:

| column | behaviour | disposition |
|---|---|---|
| `suggested_by_user_id` | ⚠ `NOT NULL`, **no FK** | **delete** — nulling is rejected and would void the whole statement |
| `resolved_by_user_id` | `SET NULL`, nullable | **null** — the couple's accept/decline stamp survives |

The vendor's own proposal goes; the couple's decision record is not disturbed by it.

### The rest

Nulled: `feature_policy.updated_by_admin_id` · `force_majeure_flags.couple_user_id` + `admin_handler_user_id` · `founder_seats.granted_by` · `homepage_background_videos.updated_by_admin_id` · `homepage_hero_config.updated_by_admin_id` · `manpower_gigs.posted_by_user_id` · `moodboard_library_assets.uploaded_by` · `owner_alerts.acknowledged_by`.

`force_majeure_flags` nulls **both** party columns — it is a two-party dispute record, so the vendor's side survives the couple leaving and vice versa; the purge is subject-scoped, so only the leaver's own occurrence is cleared.

All 13 columns exact-matched against `prod-schema.snapshot.txt`; every split matches the FK map's verdict, so **G6 needed no exception**.

Verified: full DB suite **752/752**, erasure guards **32/32**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — ten more gaps closed in an existing RA 10173 obligation.
