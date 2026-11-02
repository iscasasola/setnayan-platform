## 2026-09-24 · docs(controller): the working corpus enters version control

Until this commit, **eleven** files in `build-sessions/` were tracked by git. The other **193** —
`CONTROLLER.md`, the 3,971-line register, the sequence, and every owner-approved prototype — existed
only on one Mac's disk. The only way they reached a new Claude Code account was a zip file on a
Desktop.

🔑 **A document that lives where only one process can see it is not documentation.** It is the same
defect this codebase keeps finding in its own code — an answer that exists and never reaches the
surface that needs it. Here the surface was the next account. `make-handoff-zip.sh` is now a
convenience, not the carrier.

Adds `build-sessions/README.md`, which maps all 204 files and separates the live registers from the
one-shot session scaffolding — a `CTRL-*` brief says what a session was *asked* to do and never what
it did, so `git log origin/main` is the only answer to "what shipped".

Adds `CONTROLLER.md` §11–12: the documentation risk itself; the 2026-09-24 board; the sweep for
finished branches carrying no PR, which are invisible to `gh pr list` and therefore to every status
question a controller asks; the production `select` that killed an Event Hub premise (the brief's
"35 roles → 12 groups" is the *vocabulary* — the busiest live event has 15 roles folding into 6);
and a peer's flat "never render `onboarding_price_php`" being measured and narrowed, since a rule
stated as an unqualified *never* is usually an unmeasured one.

Adds `SCHEDULE-event-menu-by-moment.md` — the event sidebar / phone bar / ☰ rebuild, owner-approved
and owner-scheduled but **not started**, with the guards that go red on purpose and the live
`CustomerBottomNav` `websiteEnabled` bug worth pulling forward on its own branch.

No code changes: documentation and prototypes only.

SPEC IMPACT: None. The owner rulings captured in `SCHEDULE-event-menu-by-moment.md` (Browse by
category removed inside an event · Papic as the spine · the Studio heading dissolved ·
Personalization → Details) are **not yet in `DECISION_LOG.md`** — that corpus edit belongs with the
build that implements them, and the schedule file says so rather than assuming it.
