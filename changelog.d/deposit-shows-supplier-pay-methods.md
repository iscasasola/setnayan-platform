## 2026-09-18 · feat(payments): the deposit step shows the supplier's payment methods, and a locked card says "Pay your deposit"

Owner, live on the booking run: *"there is no mode to pay the vendor the deposit… the payment
modes of the vendor must show. and an easier way to pay of course."*

Nothing here moves money through Setnayan. It only shows the supplier's OWN approved
destinations (`vendor_payment_methods`), with the owner-locked off-platform disclosure.

- **Deposit card** (`workspace/_components/deposit-reservation.tsx`): while a deposit is owed it
  now reads **1 · Pay {supplier}** (the shipped `VendorDirectPay` sheet, not a rebuild) →
  **2 · Record it here**. The card carries `id="deposit"`.
- **No methods is a sentence, not an empty sheet** (`noPayMethodsSentence`). The couple fetch
  keeps its outcome (`readPublishedMethodsForCouple` → `listed | off_platform | unreadable`), so a
  refused read says "couldn't load", never "they haven't added one".
  `fetchPublishedMethodsForCouple` keeps its old contract for its other callers.
- **After Lock, a next step:** each `contracted` row under "Locked in" shows its deposit state
  (`depositStepOf`): "Pay your deposit" / "Send it again" link to
  `workspace?tab=payments#deposit`, or a quiet "sent" / "confirmed" line. A refused read is
  `unknown` (a neutral link), never "due". `deposit_paid` rows are excluded on purpose: the
  printed Locked-QR path sets that status without stamping `deposit_recorded_at`.
- **"In build" tile → "Still to lock".** It measures `teamMoney().inBuildPhp`, which is the sum of
  build picks NOT yet locked. After a lock it read "In build ₱0" beside "Locked ₱10,170".
- **Supplier nudge** (`PayoutMethodNudge`): shown on the booking ask (Overview feed card + client
  page answer panel) and on a booked client's page while their deposit is outstanding. It uses
  `readSupplierPayoutReadiness`, one visibility rule (`isCoupleVisible`) shared with the couple
  fetch and the proposal fetch. It says nothing when the read fails.
- Two bare `text-terracotta` icon classes in `vendor-direct-pay.tsx` → `-700`. The gold guard was
  already red on `main` for that file, and this PR mounts it on a new surface.
- Guard: `lib/deposit-pay-step.test.ts` (11 tests; 6 sabotages, each printed red).

Measured 2026-09-18: `vendor_payment_methods` has 0 rows in prod. Until a supplier adds one,
every couple sees the sentence, and every supplier facing a booking ask sees the nudge.

Left alone deliberately: the flag-gated lock-time `DownpaymentModal`
(`NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED`). It is skipped on the handshake ASK path by design,
so it cannot serve a deposit that comes after the supplier agrees.

SPEC IMPACT: `Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 tile note ("In-build" → "Still to
lock") + DECISION_LOG 2026-09-18 S19 row (corpus commit `e5c5b15`). No schema, SKU or price change.
