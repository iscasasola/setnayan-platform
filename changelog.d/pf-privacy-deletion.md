## 2026-09-22 · fix(privacy): the published DPO contact is a role address, not the owner's Gmail

W2 / register LAU-15. The Data Protection Officer contact published to the world
was `iscasasolaii@gmail.com` — the owner's personal Gmail — in **22 places across
10 published surfaces**: `/privacy` (×6), `/terms`, `/refunds`, `/cookies`,
`/acceptable-use`, `/privacy/google-access`, the marketing footer, the JSON-LD
`Organization` block in `app/layout.tsx`, `lib/help.ts` and `lib/llms-txt.ts`.

Under RA 10173 that address is the endpoint a data subject uses to exercise
access, correction, blocking and erasure, and the one the NPC uses to reach the
controller. It also published the owner's private mailbox on six public pages.

**This was already a registered Tier-0 compliance task.** `lib/npc-filing-tasks.ts`
key `t0-3` reads *"One DPO email (dpo@setnayan.com vs iscasasolaii@gmail.com)"* —
the canonical filing documents said `dpo@`, the code said the Gmail. Owner ruled
2026-09-22: use `dpo@setnayan.com`.

**Fixed as a module, not 22 careful edits.** The same value had already drifted
in the other direction — `support@setnayan.com` is declared twice, independently,
in `anniversary-emails-core.ts` and `godchild-reminder-emails.ts`. A string
living in twenty-two places and owned by none of them will be wrong in some of
them. `lib/contact-addresses.ts` now owns it.

`published-contacts-are-canonical.test.ts` asserts the **property** — no
consumer-mail-host address appears on any published surface — rather than banning
one spelling, which would pass the moment a different personal address was pasted
in. Comments are stripped, so the docblock explaining the old Gmail does not
convict itself. Scope is deliberately the public surfaces: a test fixture, an
admin-only note, and the User-Agent contact `lib/geo.ts` sends to an external API
are operational, not published legal contacts.

Proved by sabotage, both directions: swapping one address back to a gmail host
turned it red (`24 addresses, 1 personal`), and "fixing" it by deleting the
contact from `/privacy` turned the third test red (`names dpo@setnayan.com 0
time(s)`) — an unreachable controller is its own violation. Restored, 3/3.

⚠ OWNER DEPENDENCY: `setnayan.com` receives mail via iCloud+ Custom Email Domain
(MX `mx01/mx02.mail.icloud.com`). **`dpo@setnayan.com` must exist before this
merges** — create it at icloud.com/settings → Custom Email Domain. A published
DPO contact that bounces is worse than a personal one that works.

SPEC IMPACT: closes part of NPC filing task `t0-3`. The remaining halves of that
task — one DSR SLA (the live page says 15 business days; the packs say 7) and one
device-fingerprint live/off state — are NOT addressed here.

## 2026-09-22 · fix(erasure): DPO_QUESTIONS exists now — it was cited twice and never written

W2 / register DATA-04, DATA-01.

`lib/erasure/coverage.ts` cited `DPO_QUESTIONS` **twice** — to justify that
jointly-authored event fields are deliberately not cleared, and that
`event_vendors` third-party PII is excluded — and the symbol **had never
existed**. Both references arrived in the commit that mentioned them
(`9637655d5`); `git log -S "DPO_QUESTIONS =" --all` returns nothing.

Those are the two decisions a DPO actually has to defend. Under RA 10173 §16(e)
a controller declining to erase must state the basis, and "see the document that
does not exist" is not one. The failure was silent because **a comment cannot
fail to compile.**

The register now exists with three rows, each stating what erasure does today,
the competing lawful interest, what a ruling for the subject would change, and
the tables it touches. Two are the decisions the docblocks were already citing.
The third is new, found while measuring DATA-04:

⚖ **`event_vendors.deposit_proof_url` is never erased.** It is the COUPLE's own
uploaded proof-of-deposit. It survives erasure indefinitely and is readable on
the admin dispute and force-majeure surfaces. Severity is moderated — it is
stored privately and served through a signed URL by `depositProofDisplayUrl`, so
the migration comment calling it a "public URL" is **stale** — but it is couple
PII surviving an erasure request.

**Deliberately NOT resolved here.** Deleting it destroys the supplier's only
evidence that a deposit was paid, which register row DATA-01 says must survive.
Both interests are lawful and engineering must not pick silently in either
direction. It is written down where the next session reads it, with the likely
middle answer noted (a dispute window, which would need its own column).

`dpo-questions-resolve.test.ts` holds the general class closed: every
`DPO_QUESTIONS` citation in `lib/erasure/` must resolve to the symbol, the
register must be non-empty, and a row whose "tension" restates what the code
already does is rejected as a decision wearing a question's clothes.

Proved by sabotage: a new file citing `DPO_QUESTIONS` without importing it —
reproducing the original defect exactly — turned it red (`2 file(s) cite, 1
dangling`), and hollowing out a question's tension turned the second test red.
Restored, 3/3. Erasure suite unchanged: coverage 11/11, guardrail 17/17,
completeness 41/41.

SPEC IMPACT: three open erasure questions now have a home in code. Answering one
is an owner/DPO ruling — record it in the corpus `DECISION_LOG.md`, then change
the code and the row in the same commit.

## 2026-09-22 · fix(oauth): seal the refresh token the sweep already opened

W2 / register LAU-6 ("Google Drive / YouTube / TikTok connection keys are stored
encrypted, as the privacy page says").

Measured in production, by pattern and never by reading a value:

| | matching Google plaintext |
|---|---|
| access tokens (`ya29.%`) | **0 of 5** — the sweep seals these on every refresh |
| refresh tokens (`1//%`) | **5 of 5** |

The token vault works. What was missing is that the sweep **opens** the refresh
token — it must, to call Google — and then wrote back `access_token`,
`access_token_expires_at` and `last_refreshed_at`, leaving the refresh token
exactly as it found it. So the secret that expires in an hour got sealed on every
run, and the one that grants ONGOING access to a couple's YouTube and Drive
stayed readable in every backup.

`oauth-refresh-sweep.ts`'s own docblock predicted this exactly — *"it seals each
ACCESS token as it refreshes; the five REFRESH tokens stay as they are until a
backfill opens and re-seals them"* — and named it as a separate change rather
than implying it. This is that change, and it is one field: the row is already
being written and the plaintext is already open.

`needsSealing(grant.refresh_token)` keeps it idempotent — an already-sealed
envelope is never re-encrypted, and a healthy row costs nothing.

⚠ HONEST LIMIT: this is a self-healing backfill, not a sweep. Each of the five
rows is sealed the next time the sweep refreshes THAT grant. Rows whose refresh
stops working (a revoked grant) are never re-sealed, because the seal rides on a
successful refresh. Those need a grant re-connect anyway.

Proved by sabotage: computing the re-seal but not spreading it into the UPDATE —
the exact shape of the original defect, a value that never reaches the statement
— turned it red; and re-storing `grant.refresh_token` instead of sealing the
opened value turned red twice, tripping the pre-existing "no write site assigns a
RAW provider token" test as well. Restored, 17/17.

SPEC IMPACT: None — closes the gap between what /privacy already claims and what
the database held.
