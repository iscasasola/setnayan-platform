## 2026-08-19 · feat(admin): the work list counts four more queues, and says why three are out

The Work page said *"You're all caught up"* while counting **14** queues and
ignoring ten other queue-shaped admin surfaces. Asked which of the ten mattered,
the owner answered each in turn. **14 → 18.**

### Now counted

| queue | its open filter, mirroring the page |
|---|---|
| **Fees to sync** | a fee charge still `pending` — the vendor has not paid the fee that syncs them to an event |
| **Completions** | a booking neither side has settled — unresolved, and disputed / awaiting-vendor / vendor-marked |
| **Chat flags** | a message flagged for taking a deal off-platform, still `open` |
| **Profile corrections** | a verified shop asking to fix a locked detail, still `open` |

Each filter **mirrors its destination page's own default** — the rule that list
already states, because a count that disagrees with the rows an admin finds on
arrival is its own defect.

⚠ **"Fees owed" is relabelled "Fees to sync".** Owner: *"there is no fee they owe
since they need to pay first before they sync to the event."* Payment is a
precondition, not a debt, and "owed" read as debt collection.

### Deliberately NOT counted — the reasons matter more than the omission

- **Verification documents** — a document **browser** (what a vendor uploaded to
  prove who they are), not work awaiting a decision.
- **Data privacy** — a compliance checklist plus the NPC document set.
- **Repost watch** — **two** source tables (`vendor_image_flags` *and*
  `vendor_qr_media_flags`). One definition counts one table, so adding it would
  **undercount**, and a lane quietly reporting less than its own page is worse
  than a lane that is absent. Summing two tables is a separate change.
- **Payouts** — owner: *"we do not have a payout."* Already off the list since
  2026-08-04 because it can never accrue new work.

### 🪤 Two stale docblocks are why one of these stayed uncounted

`corrections/page.tsx` and `corrections/actions.ts` both still say **nothing
anywhere can file a correction request**. That was true when written and is now
false — `vendor-dashboard/shop/_components/request-correction-card.tsx` imports
that path. So the queue looked permanently empty and nobody counted it.

🔑 **A COMMENT THAT WAS TRUE WHEN WRITTEN IS STILL A CLAIM.** Same family as the
note recording a page as "reachable" three weeks after its menu was unmounted,
and the card advertising payouts "ready to release" that can never arrive. This
session found four of them.

SPEC IMPACT: None.
