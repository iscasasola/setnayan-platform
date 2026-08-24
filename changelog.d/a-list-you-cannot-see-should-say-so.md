## 2026-08-25 · fix(dashboard): a list you cannot see should say so

Follow-on to *a delegate's grant means only what the host named*. Once the
guest list is genuinely closed to a delegate the host did not share it with,
two screens go quietly wrong: **an RLS refusal and an empty event are the same
value** — 200, zero rows, no error. So the guests screen would tell a
coordinator the couple has invited nobody, and the seat plan would draw an
empty room for a wedding with two hundred people in it.

Both now say what is true: *"The couple haven't shared the guest list with you…
Ask them if you need it — they can share it from their own screen, one part at
a time."* No button: the host grants access, and a control here would either do
nothing or send an ask from the wrong screen.

🔑 **Three cases, not two.** A stranger · a delegate without the grant · a
delegate with it. Only the middle one gets the notice — telling a stranger "the
couple haven't shared this with you" names a relationship they do not have.

The viewer resolution was already hand-copied across three screens; it is now
one helper, split in two the way `delegate-areas.ts` was split from
`event-moderators.ts`: the database read stays `server-only`, and the rule —
the part that must never be wrong — lives in a file a unit test can import.

4 mutations, each measured by occurrence count before → after, all red,
including the false-positive direction (a stranger being shown the notice, and
the couple being resolved through the delegate grid). Unit suite 9909/9909.

SPEC IMPACT: None.
