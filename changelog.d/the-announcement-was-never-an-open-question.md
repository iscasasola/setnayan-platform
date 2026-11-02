## 2026-08-24 · docs(roster) + test: the day-of announcement was never an open question

**A correction to a claim I shipped hours earlier, and the evidence for it.**

The roster's docblock, the people page's header and one test name all said that
whether a coordinator may message the guests is **"an owner decision"**. The
owner corrected it the same day: *"yes on the event hub they have an
announcement they can type on."* He is right, and it is live end to end:

- **The composer ships** — `coordinator-broadcast-card.tsx` on the couple's
  day-of screen writes `coordinator_broadcasts`.
- **Guests read it on the Event Hub** — `loadDayOfBroadcast` →
  `<DayOfAnnouncement>` in `site-body.tsx`. **Live window only**, and the
  **latest one only, never a feed**.
- **The gate is already the exact rule the caveat was worried about:** the
  couple, or a delegate the couple gave `schedule: 'edit'`, enforced by the
  `coordinator_broadcasts` INSERT policy. ⇒ **a coordinator nobody promoted
  cannot** — the question answers itself.
- The Data Privacy control `coordinator_day_of_broadcast` is **`active` in
  production** (approved 2026-07-22), and migration `20271132843141` derives the
  sender columns from `auth.uid()`, so nobody can sign somebody else's name.

🔑 **THIS IS "A DECISION LOOKS LIKE A DEFECT" IN ITS OTHER COSTUME.** The usual
shape is proposing to undo something the owner chose. This was the mirror:
**withholding a shipped feature as owner-gated.** Same root cause, same cheap
cure — grep the noun before writing a *caveat*, not only before writing code.

⚖ **THE RULE IS UNCHANGED — ONLY ITS REASON.** The roster still has no compose
box, for a better reason: the composer already has a home, and a second one here
would be **a second writer of the same row**.

🛡 **AND THE CORRECTION IS PINNED RATHER THAN DESCRIBED**, because a claim is
only as durable as its evidence. Three new tests assert the chain
composer → row → **mounted** on the Event Hub, the live-window and latest-only
rules, and the schedule-edit gate.
🚨 **That chain has broken before, in exactly the place these watch.** The
loader's own header records it: the composer shipped *"for months"*, the table
was live, the control was active — and **nothing on the guest site ever read
it**, so an announcement reached only the couple's own dashboard. **A writer
with no reader is invisible to every test that checks one end.**

**Proof:** 3 mutations, each verified to have LANDED, each RED — unmount the
guest-side announcement (1→0, the exact months-long bug) · let anyone the event
admits announce (1→0) · drop the live-window gate so it becomes a feed that
outlives the day (1→0). Typecheck exit 0 · 9894/9894.

⚠ Also fixed: this test file used a `read()` helper it never defined (copied
from a sibling suite) — three tests failed with `read is not defined` on their
first run rather than passing vacuously.

SPEC IMPACT: `DECISION_LOG.md` + `WHATS_NEXT_SESSION_PROMPTS_2026-08-23.md`
corrected in the same session — both carried the same false "open decision".
