## 2026-08-20 · fix(event-hub): only the ANSWER freezes — the invitation link keeps working

Owner, correcting yesterday's build: *"we already had this invite link. the goal
of the invitation link is to update the guests info and see who will go and not
go"* — and *"they can preview the event hub."*

**Three jobs. Finalizing the guest list settles ONE of them.** PR #4625 hid the
whole reply card, which took the other two with it. This corrects that.

* 🔑 **The card is not a headcount.** It carries five things and only one is the
  count: the answer · the selfie that makes their photos findable · their meal ·
  their dietary notes · a note to the host. The list finalizes **~2 weeks out** —
  exactly when "nut allergy" and "vegetarian" matter most — so hiding it took the
  allergy box away from a caterer's last fortnight.
* **The database had this right all along.** `guard_guest_edits_when_locked`
  blocks only count-affecting writes and lets meal / photo / seating through *by
  design*. The screen now agrees with it instead of over-closing.
* **What a guest sees:** the three choices are replaced by their standing answer
  and one line saying it can no longer change. Everything below stays editable,
  and the button says *Save details*.
* 🪤 **The selfie step would have vanished for exactly the guests who are
  coming** — it is revealed by `:has(rsvp_status=attending:checked)`, and with no
  radio rendered that selector can never match. Locked + attending renders it
  outright; the now-dead style block is omitted too, since its selector text was
  the only `rsvp_status` left in the markup.
* **The action drops the answer and saves the rest**, instead of refusing the
  whole submit. A guest is told which half landed (`details` / `refused`), and a
  stale tab reposting the *same* answer is not called a refusal.
* 🪤 **The old `!RSVP_VALUES.includes(status) → return` became a silent
  data-loss path** once no status control is rendered: an ordinary details save
  posts no status, and that early return would have dropped the meal and allergy
  on the floor without a word.
* `RsvpClosedNote` and `rsvpAskOpen` are retired. `guestListClosed` now gates
  nothing in the body plan — a golden test asserts the plan is byte-identical
  either way.

Tests: 12 render+wiring (new) · 3 plan goldens rewritten · the pre-existing
`say-what-happened` guard **widened, not loosened**, to demand a renderer for all
four outcomes. **16 sabotages, all landed by occurrence count, all RED.**

SPEC IMPACT: None — refines the 2026-08-20 row already in `DECISION_LOG.md`; an
amending row is appended there.
