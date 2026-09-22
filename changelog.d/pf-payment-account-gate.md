## 2026-09-22 · feat(admin): changing the BDO/GCash receiving account takes two admins

Vendor Agreement § 9.1: *"Modify Setnayan's static BDO / GCash payment-receiving account
numbers | Payment redirection = fraud risk."* Until now one admin could change, alone and
silently, the account every customer pays into. Of § 9.1's nine rows this is the one that
**redirects every future payment** rather than moving a single amount, which is why it was
built before the three that remain.

### 🔑 There were THREE doors, not one

`savePaymentInstruments` writes the account fields. **`uploadMerchantQr` writes the QR image —
and a QR *is* a destination.** Scanning it is how customers actually send money, and that
action never touches `gcash_number`. A gate on the text fields alone would have protected the
account number while leaving the real payment path wide open.

So the guard does not assert "the obvious action is gated". It asserts **every write path to a
destination column is gated** — which is what catches a fourth door somebody adds next year.
Measured: 4,020 files scanned, exactly one writer, two request sites.

### 🔒 What is deliberately NOT gated, and why

The kill switches (`gcash_enabled`, `bdo_enabled`), the monthly caps and the available-balance
readings save immediately. `savePaymentInstruments`'s own docblock already explained why an
unchecked box must mean OFF — *"the direction that matters when an account is at its cap and
transfers are bouncing."* **Requiring a second admin to CLOSE a failing rail would hold it open
while payments bounce.** A control whose job is to stop money must never wait on a quorum.
§ 9.1 gates redirection, not availability. `removeMerchantQr` is ungated for the same reason:
withdrawing an option is not pointing one somewhere new, and re-pointing needs an upload, which
is gated. A test holds this exclusion so a later session cannot "helpfully" close it.

The gated branch also strips **only** the destination fields and saves the rest, so an admin
fixing a cap is never blocked by an unrelated pending account change — and never has that edit
silently discarded.

### The rest

- `lib/payment-destination.ts` — the pure rule both the action and the guard import. Normalises
  `null`/`''`/`'  '`, or every save with an empty BDO name would open an approval for a
  difference that is not one.
- migration `20271242482874` — `approve_payment_account_change`, re-listed **from production**
  plus the two money types earlier in this stack.
- the executor refuses any payload key outside `PAYMENT_DESTINATION_FIELDS`: a payload that
  names its own target column is a write primitive, and a second admin must not approve a
  column they were never shown.
- the approval expires in **24 hours**, not the 72 the comp and refund gates use — a redirect
  of every future payment should not be approvable three days later by someone who has
  forgotten why it was proposed.

### Verified

Typecheck clean. PGlite replay inserts every action type against the rebuilt CHECK. 37
assertions across 7 guards. **Three sabotages, three catches:** un-gating the QR door (request
sites 2→1), adding a fourth writer in an unrelated file (writers 1→2, named), and withholding
the whole payload so the kill switches became gated.

⚠ **A defect I introduced and caught:** a global `sed` inserted the new action type as a third
argument to an `assert.equal`, silently replacing that assertion's failure message. Blanket
substitution hit a site with matching indentation. Fixed, and proved by sabotage that the
restored message fires.

⚠ **Honest cost:** a rejected or expired QR request leaves the uploaded asset orphaned in R2.
That is storage, not money, and it is the safe direction — the alternative is deleting an asset
the live row might already point at.

Six of § 9.1's nine rows are now enforced. Three remain: mid-quarter SKU price changes,
non-fraud vendor force-delisting, re-publishing a rejected vendor application.

SPEC IMPACT: None — the contract is unchanged; this conforms to it.
