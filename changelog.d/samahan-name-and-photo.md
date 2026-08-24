## 2026-08-24 · feat(samahan): anyone can rename the samahan, and it has a group photo

Owner: *"we also want to rename our samahan anytime. anyone can rename. and
also place a photo/logo as their samahan group photo."*

- Migration `20271162795119`: `communities.photo_url` (r2:// stored-asset
  ref) + the UPDATE policy widened from organizer-only to EVERY MEMBER.
- 🔑 **A policy is ROW-level, so widening it alone would also have handed
  every member the archive switch and the identity columns** — the
  row-is-yours-field-is-not shape. `communities_member_field_guard` (BEFORE
  UPDATE) scopes the widened policy: members get name · description ·
  photo_url; `archived` stays organizer-only; community_id / public_id /
  created_by are immutable for everyone below the service role.
- ⚠ The trigger is deliberately NOT `SECURITY DEFINER` — inside a definer
  function `current_user` is the function OWNER, so the privileged check
  would read every caller as the service role and the guard would never fire.
- Upload tenancy: `samahan/<communityId>` declared as a `community` root with
  its own arm in `/api/upload` (checked against `communities`, where RLS
  admits members only). Without it the default treats the id as an EVENT id
  and refuses every member 403 — the `payments/<orderId>` break, one prefix
  later.
- Name & photo card on the samahan overview, for every member; the header
  chip renders the photo when set and the initial when not.

5 db tests pinning the boundary in both directions; 4 measured mutations.

⚠ **The exposure-baseline diff is mostly NOT this change.** Measured: with
this migration removed, regenerating still moves 174 added / 189 removed
lines — pre-existing drift on `main` from the merged anon-grant batches (the
freeze only fails on WIDENING, so narrowings accumulate un-absorbed). This
change contributes exactly 2 new facts: `communities.photo_url` and the
`member_can_update_community` policy.

SPEC IMPACT: DECISION_LOG.md row 2026-08-24 (samahan rename + group photo).
