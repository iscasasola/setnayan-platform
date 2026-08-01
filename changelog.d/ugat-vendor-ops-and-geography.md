## 2026-08-01 · feat(ugat): Availability + Geography, and eight findings turned into assertions the guard enforces

Third map-backlog cluster, discovered by a 46-agent fan-out with every proposed claim adversarially attacked before it reached the map. Backlog **35 → 30**. Nodes **15 → 17**.

The fan-out's own recommendation was followed: five families do **not** resolve to five nodes. Two earn one, three fold under VENDOR.

### NEW · Availability

The only place in the schema deciding a **rivalrous** resource — a vendor's day. Everything else under VENDOR describes what a vendor *is* or *sells* and reads concurrently without conflict; this decides who gets the date, and owns concurrency machinery that exists nowhere else (deterministic `FOR UPDATE` ordering against deadlock, a partial unique index for idempotent re-acquire, a capacity number).

**Scoped by concept, not by prefix.** `vendor_calendar_blocks` and `vendor_calendar_day_states` do *not* match `vendor_schedule_%` and are the gates deciding whether a date is bookable at all. A prefix-scoped node ships with its two most decision-bearing tables missing — the reason this had to be drawn deliberately rather than derived.

Marked **unproven, not built**: 1 booking row against 45 `event_vendors`, four of six tables empty. Its behaviour under contention has never actually happened.

### NEW · Geography

Not a vendor concept and not an event concept: ~11 tables across four existing nodes join to it **by text**. Filing it under any one makes a shared vocabulary that node's private property and hides the drift from everyone else.

**Exactly one foreign key in the entire database points at `regions`** (`wedding_destinations.region_code`) — asserted in J31 precisely because it is the exception. If a second ever lands, that is good news worth noticing.

⚠ **A correction to how this was first reported.** The fan-out flagged 10-of-20 drifted rows in `token_burn_bands` as *billing-adjacent*. It is not. I read the code: that table is **retired and unread**, replaced by `regions.burn_band` on 2026-07-01 — and retired *because* it mis-keyed six regions and undercharged them. The drift is real and inert. Long-form slugs (`central_luzon`, `davao_region`) match nothing; the real spelling is short form (`c-luzon`, `davao`). Recorded on the node so nobody re-finds the dead table and trusts it. **A live pricing alarm would have been wrong.**

### Folds under VENDOR — branches, coverage, verification, Instagram

No nodes of their own; recorded as joints because their shapes bite.

- **J32 · the badge is not in the verification tables.** `vendor_profiles.verification_state` is what the product reads; nothing syncs it, and the three tables carry three different status vocabularies — tiles-vs-categories again, on the trust surface. Neither verification table is unique on `vendor_profile_id`, so *"the vendor's application"* is undefined and any `.single()` starts throwing the moment a vendor submits twice.
- **J33 · Instagram media outlives its connection.** `vendor_ig_media` has no link to `vendor_ig_connections` (asserted as `no_column`), so revoking or deleting a connection unpublishes nothing. `ig_user_id` has no unique constraint — two vendors can claim the same account.
- **J34 · "coverage" holds no geography.** It is `canonical_service` + `event_types[]` + `faiths[]` — matching vocabulary, not a service area. Pinned with a `no_column` on `region_slug`, because filing it beside branches under "coverage area" is the obvious and wrong reading. Also: `vendor_services.coverage_id` is nullable `ON DELETE SET NULL` and the coverage row *is* the service's type — delete a coverage and every service under it survives **typeless**.
- **J29/J30 · the availability traps.** `blocks.pool_id` is `ON DELETE SET NULL` and NULL means **org-wide**, so deleting a pool converts its scoped blocks into blocks closing the date for *all* the vendor's pools (day states cascade instead — the two differ). `booked_date` duplicates `events.event_date` with nothing keeping them in step. `event_vendor_id` references `event_vendors(vendor_id)` — column name and target PK name differ, so joining on matching names is wrong.

### Also: a third wrong count of mine, removed rather than corrected

"**83 joints**" appeared in four places. The real figure was **26**. I produced it with a `grep -c` that counted every `{` in the array — including nested claim objects — the same class of error as "47 subsystems" for a file of 44 and "TWO probes" for an array of four. All four sites now read `UGAT_JOINTS.length` or carry no figure at all.

Verified: `tsc --noEmit` clean · **all six Ugat guards green**, including every new claim holding against the replayed schema · 76 unit tests green.

SPEC IMPACT: None — mapping and assertions; the two code defects this cluster surfaced shipped separately in #3992.
