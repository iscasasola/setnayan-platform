## 2026-09-16 · fix(pabuya): a gift QR must be scannable, and the couple is told at upload

A couple could upload **any image** as their e-gift payment QR. Nothing checked
that it decoded, let alone that it was a QR Ph code. Measured on the owner's own
event: a `bank` method whose QR was `IMG_4424.jpg` — a phone photo. He found out
by scanning a code in GCash and being told it was invalid.

🔑 **The failure surfaces at the wedding, and the upload is the last moment
anybody can still fix it.** A guest standing in front of the couple with "invalid
QR" on their phone cannot act, and neither can the couple.

`saveEgiftMethod` now fetches the uploaded image's authoritative R2 bytes, runs
the **shared** two-scale decoder (`lib/qr-decode.ts` — not a third copy), and
asks `isQrPhPayload` (CRC, TLV structure, currency 608) via a new pure verdict.

**Three decisions, each deliberate:**

- ⚖ **Only `gcash`, `maya` and `bank` are held to QR Ph.** `paypal` and `other`
  are excluded on purpose — a PayPal.me QR is a URL QR and is *correct* for its
  rail, and `other` exists for the destination we did not think of. Widening
  that list is a product decision, not a tidy-up.
- ⚠ **Only a NEWLY ATTACHED or CHANGED image is checked**, and this is
  load-bearing rather than an optimisation. Checking on every save would trap
  every row that already holds a bad image: the couple could no longer fix the
  label or the **account number** on that method without first producing a valid
  QR — and the account number is the part a guest can actually use. A rule that
  blocks the repair of the thing it complains about is worse than the thing.
- ⚠ **Fail-open on infrastructure, fail-closed on a verdict.** "The decoder read
  nothing" is a real finding; "we could not fetch the bytes" is us failing, not
  the couple, and must never block their save — the posture
  `vendorQrGuardRejects` already documents. Collapsing the two would turn an R2
  outage into *"your QR is broken"*, told to somebody who cannot act on it.

The two refusals read differently on purpose — *no QR found here* and *that is a
QR but not a payment QR* need different fixes.

**Shape:** the verdict is a **pure** module (`lib/pabuya-qr-verdict.ts`) and the
I/O is a thin `server-only` sibling (`lib/pabuya-qr-check.server.ts`). A guard
over a `server-only` module can only grep, which passes while the thing it names
does nothing; the half that can be got wrong is therefore pure and its tests
**execute** it. This follows `lib/qr-decode.ts`'s own docblock — share the
decoder, keep the verdict with the surface that owns the question. There are now
three verdicts over one decoder (website funnel guard, mood-board gallery, this).

Guarded by `apps/web/lib/a-gift-qr-must-be-scannable.test.ts` (12), including two
END-TO-END cases that render real QR images and decode them through the shared
decoder — one QR Ph (accepted) and one link QR (refused), the latter being
exactly the image handed to the owner on 2026-09-16 that GCash rejected.

SPEC IMPACT: None.
