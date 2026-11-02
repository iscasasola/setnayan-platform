## 2026-08-25 · fix(vendor): the ask must not depend on a flag

Third and last wave from the adversarial audit of the same day's merged work.

Yesterday's *"asking is not a day-of thing"* moved the coordinator's
ask-the-host-for-access box onto the client card, so a planner working a wedding
for six months no longer had to wait until the morning of it. **It landed on one
branch of a feature flag.** The client card renders two ways — the old body and
the unified relationship shell — and the ask sat only in the first. So whether a
coordinator could ask for the guest list at all depended on an environment
variable whose production value **is not readable from a session**, because it
inlines at build time.

The file's own comment three hundred lines above asserts that both branches
*"render the SAME JSX"*. **A sentence is not a mechanism.** One definition now,
mounted by both.

⏱ **And "what you already hold" was asking a different question from the
database.** The read that decides which areas are still worth asking for counted
an *unaccepted* invitation as already held, while `moderator_area_level` only
ever looks at accepted rows. A coordinator would have been unable to ask for
something they did not have — on both screens at once, since both call it.

🛡 **The guard could not have caught either.** It asked
`src.includes('<AskAccess')` on the whole file, which is true no matter which
branch renders it — the same shape as a colour guard that matches one spelling
and reports a screen clean. It now splits the file at the flag-ON render and
requires a mount on **both** sides, plus exactly one definition, so two copies
cannot drift apart again.

3 mutations, each measured by occurrence count before → after, all red —
including one that restores the shipped defect exactly and one in the opposite
direction (flag-ON only). Unit suite 9921/9921.

SPEC IMPACT: None.
