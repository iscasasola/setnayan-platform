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

### Amended same day — edited in place, not in a card

Owner, looking at the live header: *"click on this image to upload photo? …
taps the text to rename as well? or an edit button for the text"*. Both
questions answered rather than split: **the photo chip is the button** (with
a camera badge on its corner, because an invisible control is the complaint
that produced this), and **the title is the button too, with a pencil beside
it** — tap-anywhere alone is undiscoverable, a lone pencil is a small target
on a phone, so the whole title is the target and the pencil is what tells
you. The separate "Name & photo" card is **removed**: two places to rename
would drift, and a pinned test now fails if the page grows its own copy.

5 shape pins, 4 measured mutations (chip unwired · pencil deleted · failed
upload keeping a phantom preview · a second form on the page), all red.
