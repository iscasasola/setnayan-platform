## 2026-08-31 · docs(claude.md): RULE 0 now covers the work in flight, and a flagged guess is still a guess

Two rules added to RULE 0, both earned in a single session on 2026-08-31.

**8 · Grep the open PRs, not just `origin/main`.** Searching main answers "does
this ship"; it cannot answer "is somebody building this right now". Twice in one
session: a comeback-offer feature was rebuilt from scratch while another session
had already opened a *better* version as a PR (theirs caught a hard-coded rate
the rebuild reproduced), and a `guests.papic_excluded` migration was one step
from being written when `papic_guest_spend_ceilings` — shipped the day before —
already expressed exactly that, `ceiling_points = 0` being the documented "may
not spend". That column would have become a second, competing source of truth
for one fact. Neither near-miss would have been caught by a test: two mechanisms
that disagree about the same fact each pass their own suite.

**9 · "I flagged it" does not make a guessed number safe.** Owner, verbatim:
*"don't guess."* A `DEFAULT_CAPTURE_MIX` was shipped as an owner-tunable default,
labelled a guess in the code, the changelog AND the PR body — and it was still
wrong, because it sized a top-up recommendation, i.e. it told couples how much
money to spend, and nobody had measured it. The real answer was already in the
tree (`papic_event_pool_config`, admin-editable, live since migration
`20270826385580`).

SPEC IMPACT: None — repo guidance only. The corresponding corpus entry is the
2026-08-31 `DECISION_LOG.md` row for the Sai rename session.
