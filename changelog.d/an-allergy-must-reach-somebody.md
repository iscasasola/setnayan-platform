## 2026-08-21 · fix(event-hub): the host is told what MOVED, not what was posted

The RSVP notification fired only on `attending` / `declined`. That omitted far
more than "maybe":

* **After the guest list is final the answer control is not rendered at all**, so
  the posted status arrives EMPTY — a guest typing *"severe nut allergy"* twelve
  days out reached **nobody**, in the exact fortnight a caterer needs it.
* Every **`maybe`** was silent, at any time.
* Every **details-only edit** was silent — the write ran, `updated_at` moved, no
  human was told.

The action already knew the control was gone and had taught every other branch to
cope. **This was the one branch never revisited.**

🔑 **It now fires on the CHANGE, never on the WRITE.** Every field on the reply
card is `defaultValue=`, so a guest who opens it and taps Save reposts their own
answer, meal, allergy and note byte-for-byte; the update is unconditional and
`updated_at` always moves. Neither is a change signal. One hoisted read of the
stored row, and a pure comparison (`guest-details-changed.ts`) decides.

⚠ **A deliberate behaviour REMOVAL:** reposting an unchanged `attending` used to
notify the couple again. It is now silent.

Other things the change had to get right:
* 🪤 **`maybe` reaches the notification now**, and the old label mapped
  everything-not-attending to *"not attending"* — which would have reported an
  **undecided** guest to the couple as a **no**. There is an `undecided` label.
* 🪤 **A NULL meal is not a change.** The column is nullable with no default while
  the write stores `'no_preference'`; comparing raw would email the couple on the
  first save of every guest who never opened the dropdown.
* 🪤 **A refused answer is not a reply that moved** — when the list is locked the
  answer is not stored, so `answerChanged` carries `!replyLocked`.
* 🔒 **The dietary value is named, never quoted.** Compliance classes dietary
  notes as data that may reveal health or religious belief; the deep link keeps
  the words inside the app rather than in an inbox.
* ⚠ The membership loop now **dedupes** — two rows for one person notified twice.

🪤 **MY OWN COMMENT TURNED AN EXISTING GUARD RED.** A note warning that a write
here would retarget a guard contained the literal call it named — so the guard
found the comment instead of the code. The comment now describes it in words.
Third time this session that prose satisfied a pattern match; the test file gained
a comment-stripping helper.

📊 Prod: `notifications WHERE type='rsvp_received'` = **0 rows, ever** — the arm
has never fired. 28 of 36 guests carry a reply, every one typed by the host on
the dashboard. Nothing regresses because nothing has ever run.

Tests: 8 unit on the comparison (real values, not greps — it is the half that
decides whether the couple is spammed) + 7 source guards. **10 sabotages, all
landed by occurrence count, all RED** — including "add `maybe`", the partial fix
that leaves the allergy silent.

SPEC IMPACT: None. Two small owner questions are raised in the PR body.
