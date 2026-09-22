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
