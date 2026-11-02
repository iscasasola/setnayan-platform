## 2026-09-06 · fix(schema): an actor leaving no longer erases other people's records

Six actor stamps settled against the rule this repo already wrote down and
tested, in `erasure-completeness.db.test.ts`:

> *delegate_user_id is CASCADE + NOT NULL (the row is ABOUT them),
> granted_by/revoked_by are SET NULL (an actor stamp).*

It names the failure "the over-deletion trap": deleting a row because the person
who ACTED on it left, destroying something a THIRD PARTY still needs. Each was
argued on its own — a name is never the argument — and each verdict was attacked
by three independent refuters; all survived unanimously.

**Converted (CASCADE → SET NULL, plus the DROP NOT NULL the two-step requires):**

- **`vendor_admin_motions.proposed_by`** — the sharpest of the three.
  `vendor_admin_motion_votes.motion_id` is itself `ON DELETE CASCADE`, so
  deleting the proposer destroyed **other admins' votes** on a motion to demote
  or remove a third admin. Three parties lost something and none was the actor.
- **`coordinator_access_consents.consented_by_user_id`** — the row is the
  COORDINATOR's RA 10173 permission slip (`coordinatorMoneyScopeGranted` requires
  an un-revoked consent), so deleting it revoked a third party's access as a side
  effect of someone else closing their account. A consent receipt is also the
  evidence that permission was given: de-identify it, never destroy it.
- **`admin_approval_requests.initiated_by`** — decided by its own sibling.
  `decided_by`, the same kind of stamp on the same row, has been `ON DELETE SET
  NULL` since the table shipped. Admin A and admin B are two halves of one
  four-eyes handshake; there is no reading in which B leaving clears a stamp and
  A leaving shreds the record. The subject slot is taken and not by this column —
  `export-coverage-guardrail.test.ts` asserts *"target_user_id is the account the
  motion is ABOUT — the subject, not the operator"* — and `initiated_by` can
  never BE the subject, because `requestPrivilegedGrant` refuses a grant for your
  own account.

**Retired by argument rather than by change:**
`live_studio_encoder_claims.requested_by` stays CASCADE. A single-use 60-second
CSPRNG nonce, referenced by no table, with `requested_by` read by no code: there
is no third party to protect, and the row genuinely IS about the host who asked.
The pinned list's contract is "convert it **or** record why CASCADE is right";
this is the second half of that sentence.

**Converted by owner ruling 2026-09-06, because these two carried a privacy
decision as well as an engineering one:**

- **`vendor_invites.invited_by_user_id`** and
  **`vendor_lock_proposals.proposed_by_user_id`** were in `SUBJECT_ROW_DELETES`,
  so erasing a user DELETED their invites and lock proposals. They now survive
  with the actor nulled — a real change to what happens to a person's data when
  they ask to be erased, which is why it was put to the owner rather than folded
  in. The argument that decided it: the erased person is de-identified either
  way, so the delete's only additional effect is that a THIRD PARTY also loses
  something. A lock proposal is addressed to the COUPLE and a pending one is the
  only thing rendering their confirm strip; a `vendor_invites` row is a live
  claim credential held by the INVITEE and carries THEIR email, which this file
  already excludes from erasure as third-party data.

  🔑 **Both old justifications argued FROM the constraint** — *"CASCADE + NOT
  NULL — the schema's own verdict"* — which is circular: reasoning from the
  setting to the disposition can never notice the setting is wrong. Rewritten to
  argue from who loses what. Their `SUBJECT_ROW_DELETES` entries move to
  `AUTHOR_UUID_NULLS`, because erasure anonymizes in place and issues no delete,
  so the FK alone would never fire on that path.

⚠ **One hazard measured, not reasoned.** `admin_approval_requests` carries
`CHECK (decided_by IS NULL OR decided_by <> initiated_by)`, and this repo has a
recorded case of SET NULL onto a CHECKed column behaving like RESTRICT — the FK
refuses, the parent DELETE fails, and an "erasure" quietly becomes impossible.
Probed against the PGlite replay before the migration was written: nulling the
checked column on an already-decided row **succeeds**, because `false OR (uuid <>
NULL)` is NULL and Postgres treats a NULL CHECK as satisfied. Real hazard in
general; it does not bite here.

⚠ **One behaviour changes, and it fails closed on purpose.** `approveRequest` /
`rejectRequest` claim a row with `.neq('initiated_by', me)`, and SQL `NULL <>
uuid` is NULL — so a request whose initiator was deleted can no longer be decided
by anyone. That is the safe direction: four eyes means two people, and letting a
single admin decide an orphaned privileged request would weaken the gate the
table exists to enforce. The row expires via `expires_at` and the audit record
survives. The error copy is corrected so it stops blaming the reader for a state
they did not cause.

**Render honesty.** A NULL proposer now reads "a departed admin" in both team
views. Widening the types alone would have let `nameOf` fall through
`members.find(...)` to a generic placeholder — printing a stranger's label for a
real person who left, which is this repo's own named disease.

`lib/erasure/coverage.ts`'s residual note for `vendor_admin_motions.proposed_by`
said *"NOT NULL forecloses nulling"*, which this change makes false. Corrected —
and precisely: `ON DELETE SET NULL` fires on DELETE only, while erasure
anonymizes in place and issues none, so the uuid still remains after an erasure
request. **Nulling is now possible; it does not yet happen.** Clearing it for real
needs an `AUTHOR_UUID_NULLS` entry, which is the DPO call that note already asks
for. The technical blocker is gone; the decision is not.

**The pinned list is now empty of unsettled entries for the first time.** Six
shipped with the ratchet, five converted, one kept with its reason recorded. The
guard still fails on any NEW cascading actor stamp — that is the half that
matters.

Baseline regenerated with `UPDATE_FK_BEHAVIOUR=1` (never hand-edited):
CASCADE 65 → 60, SET NULL 170 → 175, exactly five lines.

SPEC IMPACT: None — foreign key delete actions and nullability. No price, SKU or
entitlement rule changes.
