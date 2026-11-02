## 2026-08-08 · design(#4): one line under Publish, worded to what is actually true

The service editor's publish row now carries the reassurance a vendor needs
before pressing Publish for the first time — that it is reversible:

> You can hide a card any time — it comes back exactly as you left it.

### 🪤 The design's own wording would have been a false promise

The frame said *"You can pause a service any time; **paused services keep their
reviews**."* That claims a per-service mechanism that **does not exist**:
`vendor_reviews` has **no service column at all** — zero references, verified
against migration `20260514100000`. Reviews attach to the **shop**.

A vendor who hid a service expecting its own review history to travel with it
would have found nothing, and would have learned it from the product rather than
from us.

🔑 **COPY IS A CLAIM ABOUT THE SYSTEM, SO CHECK THE SYSTEM.** What IS true was
verified the same way: `toggleVendorServiceActive` flips `is_active` and touches
nothing else, so the card really does come back byte-identical. The sentence
shipped is the one the code can keep.

### Verification

7,103 unit tests pass · 21 lint guards green · `tsc` clean · the port guard
reports nothing lost (this adds).

SPEC IMPACT: None — implements the Admin Desk spec § 2.10, whose own entry
already carried the corrected wording and the reason for it.
