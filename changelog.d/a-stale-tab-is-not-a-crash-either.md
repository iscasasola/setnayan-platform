## 2026-09-15 · fix(errors): the error screen after a successful save is a stale tab, not a crash

The owner hit a full-page error screen after saving a guest — twice, days apart
(renaming Billy Loo, then adding Claire Buanhog's email). Both times the natural
reading is "I just lost my work."

**Both times the write had already landed.** The value was in the database, the
`person_id` trigger had fired, no 5xx was logged, and no server error existed on
that route. Reproduced live on 2026-09-15 with the console open, the browser said:

```
An unexpected response was received from the server.
```

…and the error screen carried **no `Reference:` line**, because there was no server
digest to print. That absence is the diagnosis: Next.js serialises a failing Server
Action properly and it arrives WITH a digest. This message is the *transport*
failing — the tab posted to a build that answers differently than the one it loaded
from — and it fires at the one moment a person is most certain their work is gone.

🔑 **The same disease `stale-bundle.ts` already existed for, one layer up.** That
module catches a tab asking for a SCRIPT that moved; this is a tab asking for an
ACTION that moved. Both mean "the tab is older than the server", both are cured by
one reload, and both currently read as an outage on a site that is serving
perfectly. The boundary's reload never fired here only because the message matched
none of its five patterns.

Two patterns added, so the existing one-shot reload now covers the save case. No new
mechanism: the marker, the once-per-session guard and the clear-on-healthy-render
are all untouched.

**⚠ The dangerous direction is explicitly fenced.** The suite's "a REAL crash is not
mistaken for a stale tab" test now also walks five genuine failures — a Server
Components render error, a permission-denied write, a unique-violation, the
near-miss wording *"An unexpected **error** occurred"*, and a 500 — and requires
every one to be refused. Sabotage-verified both ways, with occurrence counts printed
before and after so each mutation is proven to have landed where it was aimed:
removing the new pattern fails the save case; widening it to `/server/i` fails the
real-crash test.

**What this does NOT do, stated plainly.** It does not stop the mismatch happening —
it stops it reading as lost work. The underlying cause is still unconfirmed: Vercel
skew protection IS enabled (12h, verified on the project, not the repo) and the
deployment id IS embedded in the page, so the two candidates are a Server Action
POST resolving against a newer deployment, or middleware — which has NO RSC
awareness anywhere — intercepting the follow-up. Narrowing that needs the
`content-type` of the request after the action's 303, which is in the browser and
was not captured. Deliberately not guessed a third time today.

SPEC IMPACT: None.
