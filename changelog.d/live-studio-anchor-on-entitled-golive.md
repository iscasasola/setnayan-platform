## 2026-07-27 · fix(live-studio): the paid broadcast day no longer starts on a FREE go-live

A completeness audit found this and the owner approved the fix. It is a money defect
that would have cost a couple their multi-cam **at the ceremony, after paying**.

**Two facts, harmless apart, wrong together:**

1. `stampFirstLiveAt` wrote the write-once day anchor with **no entitlement check** —
   and the **free single-camera livestream** (a promise on the live `/pricing` page,
   and the thing § 4d's rehearse-free model actively encourages) runs through the same
   `goLivePanood` action, so it stamped the **paid** clock.
2. `foldWindowEnd` computes `max(firstLiveAt, boughtAt) + 24h`.

**The failure:** stream free on Monday → buy on Thursday, which the apply-then-pay
**24-hour manual reconciliation SLA forces** (buy-ahead is the advice we give) →
window = `max(Mon, Thu) + 24h` = **Friday** → wedding **Saturday**: expired, one
camera, ₱2,999 paid. That inverted § 4f ②'s own promise — *"anchor the window on first
go-live … buying early costs the couple nothing"* — into "your day starts when you
pay", on the one event that cannot be re-run.

**The fix.** `stampFirstLiveAt` now asks `resolveBroadcastWindow` first and refuses an
un-entitled press. Notes on the shape:

- **One rule, not a second one.** It reuses the same window resolver every other
  surface asks. `resolveBroadcastWindow` lives in this module, so there is no import
  cycle — reaching for `canPublishMultiCam` (a thin wrapper over this very call) would
  have created one, since `live-studio-publish.ts` imports *from* here.
- **The base case is not circular.** At the first entitled go-live the anchor is still
  null, and the null-anchor branch returns `multiCam: true, reason: 'awaiting-go-live'`
  — so the gate says yes, we stamp, and the real expiry computes from then on.
- **STRUCTURAL, not caller discipline.** The refusal is inside the stamp, so no future
  call site can forget it. A test pins that the ask precedes the write.
- **Fail-closed on the write is fail-OPEN for the couple.** A transient error means no
  stamp; an unstamped paid event sits in `awaiting-go-live`, which is `multiCam: true`
  with **no clock** — they keep what they bought and simply are not metered for that
  press. Never the reverse.
- **Metering is preserved.** An internal-hosted event still anchors, so § 4i ②'s
  "internal is METERED" ruling is untouched (tested).
- **Ask, then write** — the column is write-once by DB trigger and the audit found **no
  admin void/reset path**, so a wrong stamp is currently unfixable.

7 new tests, **neutralisation-verified**: commenting the gate out fails exactly 3 of
them, restoring it passes 18/18. The regression is proven **both ways** — the old
anchor value resolves to `expired` at a Saturday ceremony, the new one to `open` with a
full day from the ceremony itself.

4236/4236 unit green with the flag OFF and ON, typecheck + lint + production build
pass. No migration.

⚠ **Related rails the audit named and this PR does NOT build** (owner's call): a
go-live confirmation before the day burns · an admin "void this window" for an
accidental press · the "buy at least 2 days ahead" lead-time copy the manual
reconciliation SLA structurally requires.

SPEC IMPACT: restores `Live_Studio_Unified_Spec_2026-07-25.md` § 4f ②'s stated
behaviour; `DECISION_LOG.md` 2026-07-27 records the defect and the ruling.
