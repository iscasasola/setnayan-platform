## 2026-08-02 · sec(erasure): ten more settled — and the first case with no clean answer, written down instead of picked quietly

Fourth batch, same recipe. **10 of 10 survived** (the lone "overturn" returned *"keep the settlement exactly as written"* and flagged only a companion edit). Backlog **47 → 37**.

### The case with no clean answer

`vendor_admin_motions` names **two** people: the admin a motion is about (`target_user_id`) and the peer who raised it (`proposed_by`). Both are `CASCADE` + `NOT NULL`, so the schema's verdict is that the motion dies with either.

We delete on the target only:

- **Deleting on `proposed_by` would destroy a governance record about a THIRD PARTY** — the `event_delegates` over-deletion in a different suit.
- **`NOT NULL` forecloses nulling it instead.** Postgres rejects the update and, per this file's opening docblock, one bad column voids the whole statement.

Neither option is clean. So the residual is **recorded** in `KNOWN_RESIDUAL_SUBJECT_UUIDS` with the argument, and **G7** keeps it honest: every entry must be a real `table.column`, must carry a written reason, and **the list may not exceed three** before it has to be settled rather than grown.

A silent residual is how the first 78 tables ended up unclassified. This one is visible and capped.

### The splits

| delete on (`CASCADE` + `NOT NULL`, or no FK) | null (`SET NULL`, or nullable no-FK) |
|---|---|
| `referral_codes.owner_user_id` — `UNIQUE`, so 1:1 with the subject | `event_journey_steps.completed_by` |
| `referral_redemptions.referred_user_id` + `referrer_user_id` — the row cannot exist without both | `event_meaningful_dates.created_by_user_id` |
| `vendor_admin_motion_votes.voter_user_id` — half the PK; a row *is* one person's ballot | `proposal_amendments.proposed_by_user_id` — ⚠ no FK |
| `vendor_admin_motions.target_user_id` | `stewardship_transfers.created_by_user_id` / `from_user_id` / `to_user_id` |
| `event_vendor_working_notes.author_user_id` — ⚠ `NOT NULL`, no FK, so nulling would void the statement | `vendor_meetings.created_by_user_id` |

`stewardship_transfers` nulls all three party columns, and that is safe because the purge is subject-scoped: `.update({[col]: null}).eq(col, targetUserId)` touches only the occurrence that *is* the leaver, never the counterparty's.

All 13 columns exact-matched against `prod-schema.snapshot.txt`; every split matches the FK map's own verdict, so **G6 needed no exception entry**.

Verified: full DB suite **752/752**, erasure guards **32/32**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — ten more gaps closed in an existing RA 10173 obligation.
