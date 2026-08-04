# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-01 · fix(checkout): say "Verifying" while we check the payment, and explain it on the order

Owner 2026-08-01, describing the manual rail: *"until we approve their request, it will show verifying on the button… they can click it and see their order… show the payment has been submitted and we are waiting."*

**The gating already shipped and is correct** — no new locking logic here. An order at `submitted`/`awaiting_payment` resolves to `request_sent`, and every service page refuses server-side via `eventSkuActive` → `checkOrderActive`, which counts **only** `paid`/`fulfilled`. Verified against `papic`, `pakanta`, `patiktok`, `led` and `animated-monogram` individually rather than assuming the pattern held. What was missing was the couple being told what is happening.

**Changes — wording and one explanatory banner**

- **`app/_components/app-store/state-cta.tsx`** — the `request_sent` CTA reads **"Verifying"** instead of "Request sent", and its hero pill reads **"Verifying payment"** instead of "Pending review". The old copy described the couple's action, not ours; "Pending review" additionally implied a human was judging the request rather than checking that money arrived.
- **`studio/_components/addon-detail-view.tsx`** — the same two labels. ⚠ This surface **resolves its own state** rather than sharing `AddOnStateCta`, so the wording lives in two places; changing only one would make the same order read "Verifying" on the studio grid and "Pending review" on the add-on page.
- **`orders/[orderId]/page.tsx`** — new banner for the state the couple lands in after tapping the chip: we have their details, we're checking against our bank and GCash records, nothing more is needed, and the service unlocks the moment it clears. When a reference number was submitted it is echoed back, so a couple who sent the wrong one can spot it and re-log without opening a new order.

**Kept clickable, deliberately.** The owner's phrasing mentioned an unclickable button; the chip instead links to the order page, which serves the same stated intent — *show the payment has been submitted and we are waiting* — better than a dead control. A disabled chip answers "what's happening with my money?" with silence and earns a support message. The feature itself is locked server-side either way.

**Banner gating detail:** it keys on a **pending payment row**, not merely on order status. An order at `submitted` with nothing uploaded yet is a different situation — that couple still owes us proof, and telling them we're verifying would stop them finishing. `resubmit_requested` keeps precedence and renders its own banner.

SPEC IMPACT: None — copy and one explanatory banner; no schema, pricing, or gating change.
