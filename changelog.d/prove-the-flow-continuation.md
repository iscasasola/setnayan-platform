## 2026-09-08 · docs(build-sessions): the resume path for the two-sided live test

Adds `build-sessions/PROVE-THE-FLOW.md` — the continuation document for the owner's
stated goal: *"you be a vendor/user with an event. then you communicate with me as the
other end… so it will be us 2 trying the app."* Two real accounts completing a booking on
the live site, which no fixture-backed test can stand in for.

It records, each with the query or command that re-measures it:

- **Who drives which side, and why that is a constraint.** The supplier side is the
  owner's (`testnayan2` · Saysay); the couple side is the session's (`testnayan4` ·
  *Ana & Miguel*). A session does not create accounts or handle passwords, so any plan
  that has one logging in as the supplier is not a plan.
- **Where the test actually stands.** `chat_threads = 0` and `chat_messages = 0` — the
  inquiry→chat half has never once run on this database. Both Saysay service cards are
  active on a published, verified shop and carry **no title, no price, no perk, no cover**.
  The couple's wedding has **no `event_date`**, which may legitimately refuse a lock.
- **The six hours of 2026-09-07 that blocked it**, by greppable anchor, so none of it is
  rebuilt — including the one that outlives the file: four production builds OOM'd on
  Vercel while CI's own `production build` job passed on the same commits.
- **The traps**, each of which cost real time: `for x in $LIST` not word-splitting in zsh
  (a watcher printed "ALL MERGED" twice while five PRs were open); an empty `gh` list
  reading as "nothing left"; a source guard over migration text passing a policy that
  would have shown every invited guest the couple's bill.
- **Three open owner calls**, including that the `Vercel` check is a **GitHub** branch
  rule and not a Vercel setting — and that adding it would not have caught this, because
  `claude/*` previews are cancelled-as-pass.

`apps/web/lib/prove-the-flow-doc-is-alive.test.ts` keeps the checkable half honest: every
repo path the document sends a reader to must exist, the SQL identifiers it names must
still be defined in a migration, and the two claims a resuming session must not lose must
still be in it. Mutation-tested four ways — move a referenced file, soften the
side-assignment sentence, rename `chat_threads`, rename the RPC — each turns it red.
(The first attempt at the fourth mutation was a no-op, because suffixing an identifier
leaves the original as a substring; recorded because a sabotage that does not break the
property proves nothing.)

🔑 It cannot check prose. It checks that the document does not send its reader nowhere —
which is how `WHAT_IS_LEFT.md` and CLAUDE.md's own "what is left" block failed, silently,
exactly where they were read most.

SPEC IMPACT: None — documentation and a guard over it.
