## 2026-08-02 · sec(erasure): ten more settled — including a standing request to email someone who asked to be erased

Third batch, same recipe: one agent per table settled against the generated FK map, each attacked independently. **10 of 10 survived** (the one "overturn" returned *"keep the disposition, the split, and every reason"* — a wording fix). Backlog **57 → 47**.

**G6 accepted every split with no exception entry** — each matches the database's own `ON DELETE` verdict, which is the first batch where the schema and the settlement agreed everywhere.

### The one that would have reached a real person

`vendor_date_waitlist` holds *"tell me when this vendor's date frees up"*. It is `CASCADE` + `NOT NULL` — the schema's own answer is that it dies with the account — but erasure issues no DELETE, so the row survived. **A standing instruction to email someone who had asked to be erased.** Now deleted.

### The splits, all schema-derived

| table | delete on (CASCADE, NOT NULL) | null (SET NULL / no FK) |
|---|---|---|
| `vendor_creator_offers` | `creator_user_id` — the offer is *to* them | `holder_user_id` — who pays |
| `vendor_invites` | `invited_by_user_id` — an invitation dies with its sender | `claimed_by_user_id` — the store keeps its record |
| `creator_chapters` | `user_id` — the subject's own body of work | — |
| `lead_token_holds` | `holder_user_id` | — |
| `vendor_date_waitlist` | `user_id` | — |
| `event_appointments` | — | `proposed_by_user_id` (nullable, no FK) |
| `feature_reviews` | — | `couple_user_id` |
| `vendor_disputes` | — | `opened_by_user_id` — the vendor's side survives |
| `vendor_correction_requests` | — | `resolved_by` — a staff stamp |

**`coordinator_broadcasts` is the interesting one.** `sender_user_id` is `NOT NULL` with **no FK**, so nulling is impossible — Postgres rejects it and, per this file's own opening docblock, one bad column voids the whole statement. Nothing could ever have cleared it. The row is 1–500 characters of prose the subject typed to the couple's guests on a day long past, so it takes the same call as `chat_messages`: authored prose goes, the thread stays.

### `vendor_invites` — the open question from #4032 is now partly closed

That PR left `vendor_invites` explicitly *unresolved* because a claimed token still resolves through `resolveClaimContextForService`. The schema settles the half it can: `invited_by_user_id` is `CASCADE` + `NOT NULL`, so an invitation the subject sent dies with them, while the claimed-side stamp is nulled and a store that already accepted keeps its record. The residual credential question is untouched and still needs a product call.

All 12 columns exact-matched against `prod-schema.snapshot.txt`; `event_appointments.proposed_by_user_id` confirmed nullable (the `NOT NULL` variant of that column name belongs to `vendor_lock_proposals`, a different table already handled).

Verified: full DB suite **752/752**, erasure guards **31/31**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — ten more gaps closed in an existing RA 10173 obligation.
