## 2026-08-22 · feat(dashboard): retire the all-events calendar subscription feed

Owner, looking at the block on My Events after per-event "Add to calendar"
shipped on each board card (#4717 / #4718): *"block delete."*

**Removed:** the subscribe block on My Events, the unauthenticated
`webcal:` feed route, the token mint/reset server actions, the feed builder,
and the `calendar_feed_tokens` table (migration `20271157440480`).

⚠ **This is a real reduction in behaviour, decided with the trade-off
stated — not a refactor.** The feed handed out ONE link the person's phone
re-read on its own schedule, so moving a date moved it in their calendar
too. The per-card `.ics` that replaces it is a copy taken once: change the
date afterwards and the copy in somebody's phone is silently wrong. This
was put to the owner before deleting and accepted. Nobody should re-derive
it later as an oversight.

🔢 **Safe by arithmetic, measured in prod first:** `calendar_feed_tokens`
held exactly one row (the owner's own, minted by rendering his board) with
`last_read_at` NULL — no calendar has ever fetched this feed, so no live
subscription broke. Dependency check also measured, not assumed: zero
inbound FKs, functions, views or triggers; only its own three RLS policies,
which drop with it. `DROP TABLE` is deliberately written without `CASCADE`.

🔑 **The two RA 10173 registries take OPPOSITE and both-correct actions, and
this is the part worth reading before touching either.** The repo's schema
parsers union every historical `CREATE TABLE` and never read `DROP TABLE`,
and the original migration is left on disk (deleting an applied migration
makes `db push` refuse and stops every deploy) — so the table stays
*visible* to them forever:

- `lib/erasure/coverage.ts` → **entry REMOVED.** That list is executable:
  `erasure/purge.ts` issues a real DELETE per entry, and against a dropped
  table `step()` records an erasure **audit failure** rather than throwing.
  Left in place it would have stamped a permanent meaningless failure on
  every erasure request forever.
- `lib/erasure/coverage-guardrail.test.ts` → **entry ADDED** to
  `DELIBERATE_EXCLUSIONS` (matching the `homepage_hero_config` precedent),
  because removing the purge rule makes G3 report the table unclassified.
- `lib/export-coverage-guardrail.test.ts` → **entry KEPT but REWRITTEN.**
  Its old reason ended by promising "the subject can see and reset the link
  on My Events at any time" — a control that no longer exists. Left alone it
  would have become a compliance document asserting a capability the product
  does not have.

Both "the entry must stay" claims were **mutation-tested**, not assumed:
deleting the export entry turns T1 red (`Unclassified user-identifying
table(s): calendar_feed_tokens`) and deleting the erasure entry turns G3 red
with the same table named.

Baselines regenerated rather than hand-edited (`exposure:baseline`,
`port:baseline`, `UPDATE_FK_BEHAVIOUR=1`). Exposure diff is removal-only —
**zero added lines**, i.e. nothing became newly reachable; the port baseline
absorbed one unrelated *addition* (a new papic-challenges route) and lost no
control beyond the three deleted here.

SPEC IMPACT: None — no schema the product depends on, no pricing, no SKU.
The retired table carried only subscription tokens.
