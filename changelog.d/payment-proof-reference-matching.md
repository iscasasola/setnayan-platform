# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-31 · feat(payments): reconcile on the payer's WALLET reference — the strongest signal available without a bank feed

Live testing on 2026-07-31 established that **no automatic arrival signal exists on personal accounts**: GCash→GCash and GCash→BDO both produce no SMS and no email (the earlier `P3500` alert was a cross-bank *incoming* InstaPay). So reconciliation stays human — but it no longer has to be a hunt.

**The insight this is built on.** A payer-visible number deterministically identifies the transaction on our side, and it differs by rail:

- **GCash → GCash** — payer and recipient see the **identical** reference (`0043457367694` on both).
- **Any bank → BDO** — the payer's prominent `Ref No.` is GCash's own and appears **nowhere** on our side. What links them is the **InstaPay Invoice No.**: the payer saw `6991560`, our BDO record read `GXCHPHM2XXXB00000000`**`6991560`**. On this rail the obvious number is a **decoy**.
- The InstaPay fee is **sender-side** (₱2.17 + ₱10 = ₱12.17 paid; **₱2.17** received), so the amount we see stays exact.

**Changes**

- **`lib/payment-proof-scan.ts`** (new) + **17 tests** over transcriptions of the real receipts. `scanPaymentProof` extracts references (tagged `reference` vs `instapay_invoice`) and every peso amount; `preferredReference` picks the right kind **per channel** so the BDO decoy is never chosen; `referencesAgree` compares two references by equality **or tail** (the `endsWith` rule cross-rail matching depends on). `matchesExpected` is deliberately `true | false | **null**` — "could not read" is not "wrong amount", and collapsing them would show a mismatch warning to a couple who paid correctly.
- **`InboxMatcher`** gains a new strongest tier. It previously looked only for **Setnayan's** `SN…` order code in the pasted notification — which a scanned-QR payment can never carry, since Express Send exposes no note and the code cannot ride inside the QR (GCash rejects EMVCo tag 62). Now tier 1 compares the **wallet reference the couple submitted** against references in the text the **admin copied from their own bank app** — two independent sources. Order-code and amount-only remain as tiers 2 and 3.
- **Checkout field** now names the exact number per rail — "Reference number from GCash" vs "InstaPay Invoice No." — with guidance to use the **copy button both apps already provide**. Asking generically for "a reference number" was collecting the decoy on every bank payment.
- **Admin badge fixed.** `matchesRef` claimed "Reference matches" / "Verify reference manually" based on whether the couple's wallet reference *contains our order code* — which is now almost never true and never will be for a QR payer. It failed safe (amber, not a false green) but was pure noise. Renamed to `noteCarriesOrderCode` and now reports three honest states: order code present, reference given (check it in your app), or no reference at all.

**Deliberately not done:** OCR of the uploaded screenshot. It was scoped, but both GCash and BDO put a **one-tap copy button** beside the reference, so an engine would trade that tap for a **~6.5 MB download** on Philippine mobile data — and the couple would still have to verify the result. `scanPaymentProof` takes text from any source, so an engine can be added later without touching it.

**Deliberately not touched:** `isDecisivePaymentMatch` still requires our order code, which makes the one-click/batch-approve fast path unreachable for QR payments. That is **inert, not dangerous** — everything simply needs a human. Loosening it to accept a self-reported wallet reference would weaken a guard that gates automatic approval of money, and that is an owner decision, not a refactor.

SPEC IMPACT: `DECISION_LOG.md` — row added for the per-rail reference semantics (same-rail identity, cross-rail InstaPay-invoice embedding, the decoy Ref No., sender-side fee) and the resulting three-tier matcher.
