## 2026-09-06 · fix(papic,comps): the free grant was resettable, and a deleted event destroyed the comp record

Two defects shipped 2026-09-05 in migrations `20271204225094` and
`20271205612762`, found by a post-merge audit the same day. Both are money.

**① "First event ever" was stored in a row the customer can DELETE.** The rule
asked `event_members` whether the account had another `'couple'` row — but
`couple_can_delete_member` is `FOR DELETE TO authenticated`, so a signed-in
customer could delete their own membership with one PostgREST call against the
public anon key and the history the rule reads simply vanished. Next event:
another full 50, repeatable, and strictly profitable because the credits
already granted to the older event stay on it. That is exactly the farming the
feature was written that morning to stop, reopened through a different door.

The claim now lives in `papic_free_grant_claims` — one row per account, ever,
PRIMARY KEY on `user_id`, RLS on and `REVOKE ALL … FROM anon, authenticated`,
so no browser role can read or delete it. Its own `event_id` is `ON DELETE SET
NULL`, never CASCADE: deleting the event must not erase the claim, which is
defect ② applied at birth. Backfilled from existing full grants, so no current
account earns a second 50 when this ships.

🔑 **And there is now exactly ONE decision site.** `papic_claim_free_pool()` is
called by both the `event_members` trigger and `lib/papic-free-grant.ts`. The
previous shape kept the rule in SQL *and* in TypeScript, and for a day the two
disagreed about which was even live — that module's docblock described an
insert the trigger had already won the race to perform. The app layer is now a
single `rpc()` call; `hasPriorPapicEvent`, `resolveFreeGrant` and
`freePapicGrantRow` are gone, and a unit test fails if any of them returns.

**② `comp_grants.event_id` CASCADEd, destroying the money record.** A comp
writes no order, payment or receipt, so `deleteEvent`'s money gate does not
block on one; a couple removing their celebration took the grant with it —
retail value, rationale, who granted it. The house pattern for a money-adjacent
event reference is SET NULL (`orders.event_id`).

🛑 **But plain SET NULL would have been a second, worse bug:** a NULL `event_id`
means "every event this user hosts" to `event_has_comp_for_sku`, so nulling on
delete would silently PROMOTE a one-event comp into an account-wide one — a
privilege escalation the customer triggers by deleting an event. So the FK is
SET NULL (integrity for live rows) plus a BEFORE DELETE trigger on `events`
that snapshots the id into `scoped_event_id_snapshot` (no FK, so it survives)
and stamps `revoked_at`. Both entitlement functions already filter
`revoked_at IS NULL`, so the grant confers nothing the instant its event goes —
no resolver change needed.

Exposure baseline regenerated for the one new column
(`comp_grants.scoped_event_id_snapshot`, `anon=SIU authenticated=SIU` — the
inherited table grant, identical to every sibling column including `event_id`
and `user_id`). `papic_free_grant_claims` appears nowhere in the baseline,
which is the proof its REVOKE holds.

Proven by `tests/db/free-grant-claim-and-comp-survives-delete.db.test.ts`
(7 cases). Mutation-checked: with the migration parked, 5 of the 7 fail —
including both headline cases.

SPEC IMPACT: none to the product rules — the free grant is still "first event
ever, per account", and a comp still scopes to one event. What changed is where
that fact is stored and what survives an event deletion.
