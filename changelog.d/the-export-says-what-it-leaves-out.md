## 2026-09-15 · feat(privacy): every table holding a person's data is exported, excluded with a reason, or on a shrinking backlog

`/privacy` grants an unqualified RA 10173 § 16(c) right: *"download a JSON archive of your data
anytime (served by our `/api/profile/export` endpoint)."*

That route is unusually careful about what it **read** — `listOutcome`, `not_included`,
`export_complete`, and a ban on `?? []` so a refused read can never render as *"you have none"*.

### 🔑 But a table the route never QUERIES is absent from `not_included` too

It is not reported missing; it is outside the universe the route knows about. **Careful accounting
of a set that is itself incomplete still reports completeness** — and `export_complete: true` is
exactly the sentence a regulator would read.

Measured against production by diffing the 31 tables the route reads against every `public` base
table carrying a person-key column. Seven with **live rows** were in neither list:

| | rows |
|---|---|
| `social_posts` | 103 |
| `notifications` | 72 |
| `user_devices` | 32 |
| `order_ledger` | 9 |
| `event_moderators` | 6 |
| `receipts` | 4 |
| `creator_chapters` | 1 |

**`receipts` is the sharpest** — a financial record naming the person, which the same page promises
to KEEP for ten years under the BIR floor while the access right does not hand it back.
**`user_devices` is next** — the page has a whole section promising the fraud-prevention device
identifier is exported and deleted, and it is in neither list.

### The defect was never "seven tables are missing"

It was that **nobody had decided, and there was nowhere to write the decision down.**
`lib/export-completeness.ts` is that place. Three states:

- **exported** — 14 tables, with the payload key they arrive under;
- **excluded, with a reason someone could disagree with** — `admin_audit_log` (it records what an
  ADMIN did; handing it over discloses other people's moderation decisions), `api_keys` and
  `community_invite_tokens` (credentials — an export a person may email to themselves must never
  carry a live key), `push_subscriptions` (the endpoint IS personal *and* is a delivery credential);
- **undecided — and only shrinking.**

### 🔒 The backlog is a ratchet, not a parking space

`every-person-keyed-table-is-decided.db.test.ts` replays the full schema and fails when a
person-keyed table appears in **none** of the three lists. **A new table may not join the backlog** —
it must be decided when it is added, while whoever added it still knows what it holds. That is the
one moment the decision is cheap. A backlog entry that has since been decided, or whose table is
gone, must be removed, so the count cannot drift into meaning nothing.

Writing 46 plausible-sounding exclusions to turn the check green would have been a lie that passes.
**An honest backlog beats a dishonest green** — the gap existed either way; now it is countable and
can only move one direction.

⚠ **Stated, not left to be discovered:** this cannot see personal data held in tables WITHOUT a
person-key column — a row reachable only through an event or a thread. It raises the floor; it is
not a proof of completeness.

### 🛡 Mutation-checked — and test 1 failed twice in the wild before any deliberate sabotage

Omitting a table went RED naming it, **twice, for real**: `vendor_member_token_wallets`, then
`vendor_team_members`. Both had been hidden by reading the guard's own output through `head -40`.
The check reports every unaccounted table at once, so one truncation hid two — and recovering the
first made the second look like a *new* problem rather than the same mistake still in effect.

🔑 **A truncated capture of a correct measurement is a wrong measurement, and it looks complete.**
The list was finally settled by diffing the registry against `information_schema` directly with both
sides printed. That reasoning is recorded in the file so the next person to regenerate it does not
pipe it through anything.

SPEC IMPACT: None yet — this decides nothing that was already decided and adds no table to the
export. The measured gap and the seven live-row tables are recorded in `DECISION_LOG.md`.
