## 2026-09-17 · chore(pabuya,vendor): the legacy public-bucket read paths are deleted — the count read zero

**Step 13, the last item on the Pabuya plan.** The transition arms that let a
pre-move object keep serving are removed, because nothing needs them.

**Measured first, in production, immediately before deleting:**

```
event_egift_methods on setnayan-media ............ 0
event_egift_methods outside pabuya-qr/<eventId>/ . 0
vendor_payment_methods rows (any) ................ 0
vendor_payment_methods with a qr ................. 0
```

Gone: `pabuyaQrLegacyPolicy`, `vendorPaymentQrLegacyPolicy`, their entries in
`pabuyaQrAcceptedPolicies`, the fallback arm in `vendorPaymentQrDisplayUrl`, and
the second `parseClientRef` in the anti-swap decoder.

🔑 **A read path kept past its own zero is not caution.** It is a second
accepted home that nobody is checking any more, on a column a host or supplier
can write. Re-adding one needs a fresh count, not a memory — and a test now
asserts neither name comes back.

### ⚠ ONE THING DELIBERATELY NOT NARROWED: the cleanup scope

`pabuyaQrScope` still names BOTH buckets, and the reason is recorded in it.
Every ROW points at the private bucket — but nothing deleted a displaced gift QR
until earlier today, so an object a couple REPLACED before that is still in the
public bucket with no row pointing at it. Those are invisible to a row-driven
count and unreachable from a listing we hold no credential to run.

Naming a bucket that holds nothing costs one wasted lookup. Naming one fewer
than exist permanently abandons an orphaned payment identifier.

### The tests moved with the rule, and twice tried to lose coverage

The refused-bucket list INVERTED: `setnayan-media` is on it now and
`setnayan-thread-files` is not, because the legitimate home flipped. A test
asserting "another bucket is refused" had to flip too, or it would have been
asserting the opposite of the rule.

⚠ **Two case-count floors caught me silently dropping coverage** while editing —
16-of-17 in `pabuya-qr-ref.test.ts`, 3-of-5 in `a-supplier-qr-is-not-public.test.ts`.
Both times the cheap fix was to lower the number. Both times the coverage was
restored instead: a same-bucket-different-prefix case, and an executed
round-trip proving the private home resolves while the pre-move shape does not.

🔑 Worth stating, because it explains why these floors earned their keep when so
many source-text guards did not: a count cannot be satisfied by rewording. It
asserts that a certain amount of work actually happened, and the only way to
satisfy it is to do the work.

SPEC IMPACT: None — removes transition code after its condition was measured.
