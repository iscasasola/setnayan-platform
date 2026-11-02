## 2026-08-10 · fix(outage): a signed-in account could not load the site — two definitions of "is a vendor"

Production, for one account: **`Load cannot follow more than 20 redirections`**. Before Safari gave up it surfaced as a `history.replaceState` storm, because the client router counts every hop of a server redirect chain.

### The cycle

| side | rule | source |
|---|---|---|
| `/dashboard` | `users.account_type === 'vendor'` → go to the vendor tree | a **label** |
| `/vendor-dashboard` | no shop and no team seat → go back to `/dashboard` | the **fact** |

**Neither side was wrong on its own.** Both are correct and both should exist. They were answering one question — *is this person a vendor?* — from two different sources, and an account can satisfy one and not the other the moment a shop is deleted without its label being reset.

🔴 **Which is exactly how it reached production, and I did it.** Resetting a test account this morning meant deleting its shop and its team seat. The `account_type` label stayed `vendor`. From that moment the account bounced between two doors that each pointed at the other.

🔑 **TWO SOURCES OF TRUTH FOR ONE FACT IS THE BUG** — not the redirects.

### The fix

The hop *towards* the vendor tree now asks the same question the vendor tree asks to keep you: `fetchUserRoleSummary().hasVendorAccess`, true only when a `vendor_profiles` row or a `vendor_team_members` row exists. The two can no longer disagree about the same person.

The cheap label is still checked **first**, so a customer pays nothing — the authoritative lookup only runs for accounts already claiming to be vendors. And an account whose label says vendor but which owns nothing now simply **stays on the couple dashboard**: a real place with a real way out, instead of a corridor between two doors.

Mutation-tested against the outage itself: restoring the label-only redirect turns two tests red.

### 🪤 Why this cost most of an afternoon

Everything I checked first was wrong, and the shape of the evidence is why:

- **The symptom named the wrong layer.** A `replaceState` limit reads as a client-side render loop, so that is where I looked. Next calls `replaceState` on every *router-state* change, and a server redirect chain produces one per hop — so a purely server-side loop presents as a client-side storm.
- **A frontend rollback "not fixing it" looked like evidence.** It was not: the state that had changed was a database row, which no rollback touches. **I should have checked what I had altered in the data before touching production at all.**
- **One rollback was silently overridden** by a concurrent merge auto-deploying over it minutes later, so a test I treated as informative was measuring the wrong build entirely.
- 🔑 **`curl` proves the server sends files; it does not prove the page runs.** I reported "the site is fine" on evidence that could not have detected this, and separately checked `/dashboard` while signed out — which just renders the sign-in page. Two of three checks could not have failed.

### Also in here

The temporary probe that found this is **removed** — the client shim, its mount, and the `/api/diag/history-storm` endpoint. It did its job: it is what made the browser show the redirect error instead of the storm. Instrumentation that wraps `history.replaceState` is not something to leave running in production.

Verified: **7430/7430** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None.
