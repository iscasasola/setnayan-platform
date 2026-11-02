## 2026-08-09 · fix(compliance): the filed data sheet stated a retention the schema contradicts

Repair of three runtime defects in PR #4279 (`compliance(privacy): list the
account-less guest buyer as a data subject`), which merged. This document is
printed and filed with the National Privacy Commission, so a wrong sentence in it
is not a cosmetic defect — RA 10173 binds us to what we declare.

- **The guest-buyer retention text was FALSE.** It said the order, receipt and
  screenshot "outlive the event by design" and that "NO code deletes it". But
  `papic_guest_orders.event_id` is `REFERENCES public.events(event_id) ON DELETE
  CASCADE` (migration `20271019639608`), and `app/admin/events/actions.ts ·
  deleteEvent` is a **hard delete**. One admin pressing Delete removes the buyer
  row and takes `payer_name` and `access_token` with it — no notice, no sweep, no
  schedule. What actually survives is the money trail, because `orders.event_id`
  is `ON DELETE SET NULL`: the order, the payment row and the uploaded screenshot
  stay with the event link nulled. **The typed name survives only where the
  payment had already been approved** — approval copies it to
  `receipts.issued_to_name`, and receipts hang off the order, not the event.
  `guest_buyer.retention` now says exactly that, per the file's own rule: no
  invented retention, each entry states only what the code enforces.

- **The biggest person table on the platform was missing.** `public.people`
  (migration `20270513460125`) stores `display_name`, first/last name, email,
  phone, profile photo and `birth_date`, and its own comment says most Persons
  stay unclaimed — "a guest, a relative, a lola who never signs up". It appeared
  in none of the three lists, and the guard's scan could not see it: the scan
  **skipped any table with a foreign key to `public.users`**, and `people` carries
  two — both NULLABLE. An optional link to an account is not an account. The skip
  is removed. It had hidden exactly five tables; `users` is already anchored,
  `events` / `api_keys` / `setnayan_pay_methods` are declared not-people, and
  `people` is added to `UNCLASSIFIED_PERSON_TABLES` as a DPO question (an
  unclaimed Person is not obviously any of the five categories, and `birth_date`
  makes the minors question live). The ratchet is raised 3 → 4 in the same change.

- **Two sections were numbered B.3.** The new "B.3 — Categories of data subjects"
  rendered directly beneath the existing "B.3 — Scale of processing". In the
  ADOPTED source sheet (`NPC_Compliance/03_DPO_Designation_and_NPCRS_ADOPTED_
  2026-07-24.md` line 185) categories of data subjects is a **row inside B.3**,
  not a section. It now renders as an `h3` within the single B.3 section, so the
  printed sheet matches the adopted artifact.
  While pinning that: the page also printed **"B.4 — Breach response"** alongside
  "B.4 / B.5 — Processing declarations". The adopted sheet has no B-numbered field
  for breach response (its B.4 is sensitive personal information). The number is
  **removed rather than replaced** — picking a different B-number would be
  inventing a second claim to fix the first. ⚠ **DPO to confirm** whether breach
  team/contacts should carry an NPC field number at all.

### Guard

`lib/data-subject-register.test.ts` grows from 9 to **15** tests:

- **G4** now pins the blind spot itself — `people` must stay visible to the scan,
  and the scan must keep finding ≥ 18 name-bearing tables, so a future narrowing
  fails loudly instead of quietly shrinking the guarded set.
- **G5** (new, 3 tests) reads the FK and the admin action off the tree: it fails
  if `papic_guest_orders.event_id` stops cascading, if a later `ALTER` re-points
  that FK behind the guard's back, if `deleteEvent` stops hard-deleting, or if the
  prose stops naming the cascade / the hard delete / `receipts.issued_to_name` —
  and it fails on the two exact false phrases that shipped.
- **G6** (new, 2 tests) fails if any two rendered sections claim the same `B.n`,
  and if the categories block is promoted back out of B.3.

**Mutation-tested, baseline `# tests 15 / # pass 15 / # fail 0` before each run,
each sabotage verified applied by grep count before running:** the old false
prose (RED), FK flipped to `SET NULL` (RED), `deleteEvent` made non-destructive
(RED), the `userFks` skip reinstated (RED ×2), `people` dropped from the backlog
(RED), the categories block promoted back to a second B.3 (RED ×2), a 5th table
parked in the backlog (RED), and the reviewer's own break-shape — **the cascade
named only in a COMMENT next to the entry and not in the retention data** (RED:
G5 reads the register value, not the file).

SPEC IMPACT: None in this PR. The adopted NPC registration sheet in the corpus
still lists four categories of data subjects and remains a DPO act to amend —
unchanged from #4279, still queued for the January 2027 filing pass.

No migrations. No product, pricing or scope decisions.
