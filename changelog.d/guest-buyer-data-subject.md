## 2026-08-09 · compliance(privacy): the account-less guest buyer is now a listed data subject

The person who buys shots at a party with no Setnayan account — typing a name for
their receipt and uploading a screenshot of their bank or GCash confirmation —
was never named as a category of data subject anywhere in the written record.
The feature shipped 2026-07-29; a row declaring them was drafted 2026-07-30
(`ROPA_Drafted_Rows_2026-07-30.md` § 1, "Row 21a") and was never folded in. The
adopted NPC registration sheet still listed four categories; the code collected
from five.

- **NEW** `apps/web/lib/data-subject-register.ts` — the categories-of-data-subjects
  register (NPC registration sheet field B.3) as data: five categories, each with
  the personal data actually collected, the purpose, the `table.column` anchors
  where that person is stored, and the retention **the code enforces** with the
  enforcing module named. No retention period is invented: every entry carries
  `disposalDateSettled: false` because no automatic disposal clock exists in
  code, and the screen prints `[TO CONFIRM]` rather than a plausible number.
  Two open-question lists ship with it — name columns that are not people, and a
  ratcheted backlog of three account-less person sources that still have no
  category (`couple_waitlist_signups`, `dependents`, `event_sponsors`).
- `apps/web/app/admin/compliance/data-sheet/page.tsx` — renders the register as a
  new B.3 block, iterating the register data (no re-typed second copy).
- **NEW** `apps/web/lib/data-subject-register.test.ts` — 9 guards, all
  mutation-tested: a dropped category, a phantom `table.column` anchor, the
  register going unrendered, an unaccounted account-less person table, a grown
  backlog, and a stale excuse for a table the scan no longer sees.

Retention facts stated for the buyer, read off shipped code (not off the draft):
the order, the receipt and the uploaded screenshot are held with the payment
record and **nothing in the app deletes them** — the only retention sweep (chat,
5 years, `lib/retention-sweep.ts`) expressly skips any event carrying an order on
the 10-year BIR books-of-account floor. Erasing the guest record does not remove
them either: `papic_guest_orders.guest_id` is `ON DELETE SET NULL`.

SPEC IMPACT: The adopted NPC registration sheet
(`NPC_Compliance/03_DPO_Designation_and_NPCRS_ADOPTED_2026-07-24.md` line 185)
still lists four categories of data subjects and omits the account-less buyer.
Amending an ADOPTED filing artifact is a DPO act, not a code change, so it is
flagged here rather than edited: the DPO should adopt the fifth category (and
rule on the three backlog entries) at the January 2027 filing pass.
