## 2026-08-25 · fix(vendors): a couple's public recommendation outlives the celebration

Owner, 2026-08-24: **keep it, same as reviews.**

`vendor_recommendations` is the **second public endorsement** a couple's delete
silently removed, and it is structurally identical to `vendor_reviews` — the
record the owner named first when he ruled *"vendors get to keep it"*. It is
public-read and feeds the marketplace's "recommended by N couples" signal and the
couple-editorial "vendors we loved" block.

Not new machinery: `recommended_by_user_id` was already nullable + `SET NULL`, so
the endorsement already outlived the **person** who wrote it. Only the **event**
took it down.

### 🚨 The part that is not a copy, and would have shipped a wrong number

The public count dedupes by `event_id` — because both partners on one celebration
can each recommend, and that is one couple. **A `Set` collapses every NULL to one
member.** So with the row preserved and nothing else done, three different couples
who each recommended a supplier and then deleted their events would have read as
**"recommended by 1 couple"** — not zero, which would look like an absence, but a
believable wrong number nobody would question.

⛔ **The obvious fix — stamp the old event id into a new column — was built,
measured, and thrown away.** `exposure-freeze` caught it: prod carries
`ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO anon, authenticated`, so a new
column on this public table is born with anon and authenticated holding
INSERT/SELECT/**UPDATE** — a dedupe key for a public trust number, writable by
anyone signed in. And a **column-level `REVOKE` is inert** against the table-level
grant those roles already hold, so closing it properly would mean re-cutting the
grants on a public table for one bookkeeping field.

⚖ **So the duplicate is removed instead of labelled.** At deletion time the
per-celebration duplicates collapse to one row — the only moment they can still be
grouped — and after that each surviving orphan simply *is* one couple. No key, no
new column, no exposure change.

🔑 **It loses nothing a reader can see.** The only surface that renders an
endorsement's *words* is the couple's own editorial block, which is event-scoped
and dies with the event regardless. After the delete the sole surviving reader is
the count, so a second row contributes nothing except the wrong number. The row
kept is the one that actually says something.

The endorsement also **freezes** once orphaned, for the same reason a review does:
the couple's update/delete policies key on the recommender, not the event, so
without it a person could delete their celebration and then rewrite — or withdraw
— a supplier's public endorsement afterwards.

⚠ The exposure baseline moves by exactly **two lines**, both my narrowings
(`old predicate AND event_id IS NOT NULL`). `exposure-freeze` reports a predicate
change as "widened" because it cannot mechanically prove a narrowing — read them.

Migration `20271165637321`. 5 db tests + 5 unit tests on the count itself; 4
mutations, each measured by occurrence count. Prod dry-run in a rolled-back
transaction; full db suite 1552/1552. Prod holds **0 recommendations**, so nothing
is migrated.

SPEC IMPACT: `DECISION_LOG.md` — owner ruling 2026-08-24.
