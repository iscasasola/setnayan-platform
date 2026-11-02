## 2026-08-21 · feat(people): the other half of the sentence — ask somebody on your list into a samahan

Owner, 2026-08-21: *"Then you can set a label. **or a samahan**, just like the
guest list."* The label chip shipped; the samahan half did not. It does now.

A connected person's row carries a **+ Samahan** chip. One tap, pick the group,
done — the same interaction as a guest's Groups chip.

⚖ **IT SENDS AN INVITATION; IT DOES NOT ADD THEM — AND THAT IS THE DATABASE'S
RULING, NOT A DESIGN PREFERENCE.** `community_members` has exactly one INSERT
policy, `community_member_admin_insert WITH CHECK (is_admin())`. Through the API
nobody but a Setnayan admin can put a person in a samahan; the only other way in
is redeeming the standing link. So the product's consent model was already
decided: **you are asked into a samahan, never placed in one.** A chip that
silently wrote a membership would have had to route around that policy with the
service key — the exact shape of every "the app layer is not the control" defect
this codebase has already paid for.

So the **interaction** is the guest list's and the **mechanism** is samahan's:
their standing link lands in their inbox, and the chip appears on the roster when
they actually join. Nothing is stored in between, deliberately — there is no
half-membership to render, and inventing one would mean holding a record of an
unanswered ask.

**Scoped three ways, each for a stated reason:**

* **Connected people only.** Asking somebody into your group before they have
  agreed to be connected to you at all stacks a second ask on an unanswered one.
* **Samahan you ORGANISE only.** `invite_tokens_organizer_all` is organiser-only,
  so the roster lists nothing else — a control whose action the database refuses
  is worse than no control.
* **A live link only.** No token, or a revoked/expired one, says so and points at
  the samahan page, rather than reporting a send that never happened.

The token read runs under the caller's own session, so RLS is the gate and a
refusal reads as "no live link" rather than leaking whether a group exists.

Tests: 5 db (`samahan-is-asked-never-assigned`), every one a NEGATIVE — an
organiser cannot insert a membership, a stranger cannot add themselves, a
non-organiser cannot read the link, and the roster read is scoped by membership
rather than by a policy that also admits `is_admin()`. The first of those pins
the premise the chip rests on: if a future migration ever lets an organiser write
a membership directly, that test fails and somebody re-reads this decision before
the UI follows.

SPEC IMPACT: `DECISION_LOG.md` — asking into a samahan from the People roster,
and why it is an invitation rather than an assignment.
