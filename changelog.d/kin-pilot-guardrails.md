## 2026-07-31 · feat(kin): pilot guardrails — nothing is stored about someone with no account, and /privacy finally says so

The connection tree runs as a **test pilot** ahead of the NPC submission, with the PH counsel requirement waived by the owner-as-DPO until January 2027. Two controls make that bounded rather than open-ended.

### 1 · Both people must have an account

The sharpest exposure in a kin graph is not the graph. It is storing named, dated records of people who have **no account**, never agreed to anything, and cannot see or delete their own data. `people.claimed_by_user_id` is nullable by design, so an unclaimed node — someone's lola who never signed up — is entirely possible.

During the pilot, a connection may only exist when **both endpoints are claimed accounts**. Both parties then accepted the terms, can see the claim, can decline it, and can delete it. That removes the question rather than arguing it, and it is enforced in the database, so it is **provable to the NPC later rather than merely asserted**.

The cost is real and stated: you cannot add a relative who has no account. For a pilot that is the right trade; for the full product it probably is not, which is why it is a separate, named, droppable trigger rather than a change to the schema's shape. Ending the pilot is one `DROP TRIGGER` — and that decision should be recorded when it happens.

It covers `UPDATE OF from_person_id, to_person_id` as well as `INSERT`. Without that it would be a front door with an open window: insert between two accounts, then re-point at the unclaimed node.

### 2 · The disclosure, which did not exist

`/privacy` said **nothing** about the connection tree, third-party person records, or retention. Data before disclosure is the failure mode with no good explanation, and it is the single thing external counsel would most reliably have caught.

The new section states plainly: nothing is recorded about someone without an account; the other person must agree before anything counts; only the person a claim is about can answer it; drafts are private; unanswered and declined connections are deleted after 30 days; and the wider family words (lolo, tito, tita, pinsan, pamangkin) are **calculated, not stored**. It says outright that this is a limited pilot while the NPC filing is completed.

### A real bug, caught by a positive test

The guardrail function first shipped `SECURITY INVOKER` — and `people` is governed by `people_owner_all`, so a user can only SELECT their **own** person row. The check therefore could not see whether the *other* endpoint was claimed: the lookup returned nothing, read as "not claimed", and refused **every legitimate connection**.

Caught because the suite asserts the allowed case as well as the refused ones. A negative-only security suite would have shipped a guardrail that blocked everything and called it success. Now `SECURITY DEFINER` with a pinned `search_path`, returning a boolean decision and exposing no row, column or name.

SPEC IMPACT: `DECISION_LOG.md` — pilot guardrails recorded; the mutual-accounts constraint is pilot-scoped and must be revisited when the pilot ends.
