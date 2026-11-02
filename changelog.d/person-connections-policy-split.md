## 2026-07-31 · fix(security): a relationship could be forged AND self-confirmed by one person

`person_connections` shipped with a single policy, `person_connections_participant`, declared `FOR ALL`. Its `WITH CHECK` was byte-identical to its `USING`, and both accepted **either** endpoint. Verified against live production before touching anything:

- either side could **INSERT** a row naming the other → **forgery**
- the **same** side could then **UPDATE** it to confirmed → **self-approval**

So "X is my sibling" could be declared and confirmed by one person, with X never involved. Today that is harmless — zero rows behind an off flag — which is precisely why it is the right moment.

### Why a policy split alone would have looked like a fix and left the hole open

RLS answers **who** may touch a row. It cannot express **which transition** each party may make. Both endpoints legitimately need `UPDATE` — one to retract, the other to confirm — so *any* update policy admitting both also admits the declarer setting `confirmed`.

The transition rule therefore lives in a `BEFORE UPDATE` trigger that can compare `OLD` to `NEW`. **RLS decides who is in the room; the trigger decides what they may do there.** Both are required; neither is sufficient, and shipping only the first would have been the more dangerous outcome — a fix that reads as complete.

### What the trigger enforces

- **Only the recipient** may set `confirmed` or `declined`. This is the rule the whole migration exists for.
- Only a `pending` connection may be answered.
- **Endpoints are immutable** — otherwise a confirmed relationship can be silently re-pointed at a third person.
- Only the declarer may send a draft; nothing returns to draft once seen; an answered connection is final (re-asking is a new declaration).

### Drafts (owner OD2)

`status` widens by one value. A `draft` is visible **only to its declarer** — the counterparty must not see a claim that has not been put to them. That lets someone build their connection tree before counsel clears the flag, which was the point of asking.

### Eleven tests, every one a negative

Each asserts an attack **fails**: bob cannot declare as alice; alice cannot confirm her own claim; nobody can insert a pre-confirmed edge; endpoints cannot be transplanted; a draft is invisible to its subject; an answered connection cannot be re-litigated. A security test that only proves the happy path is decoration.

Writing them surfaced a schema fact worth recording: **`person_spine_self_claim_trigger` auto-creates each account holder's person node**, and `people.claimed_by_user_id` is UNIQUE ("one account claims ≤ 1 person"). Creating a person in a fixture fights the trigger and fails on the constraint — look the node up, do not insert it.

### Gate

The owner, who is the **DPO, approved 2026-07-31**. **PH counsel has not.** `NEXT_PUBLIC_PEOPLE_CONNECTIONS` stays **off** and this migration does not touch it.

This is safe ahead of counsel because it is purely a **narrowing** — it removes capability that exists today and grants none. Counsel gates *storing relationship data about third parties*; it does not gate *tightening who may write a row*.

Exposure baseline regenerated in the same commit, as required whenever `USING`/`WITH CHECK` changes: one `cmd=ALL` policy removed, four per-command policies added.

SPEC IMPACT: `DECISION_LOG.md` row — the `person_connections` forgery + self-confirm hole is closed by per-command policies plus a transition trigger; `draft` status added per OD2. Counsel gate on the flag unchanged.
