## 2026-07-30 · fix(security): delete the legacy public-bucket payment-proof upload path

**Payment proofs had a code path that wrote them to the PUBLIC bucket.**

`dashboard/[eventId]/orders/actions.ts` (`logPayment`) and
`dashboard/[eventId]/checkout/actions.ts` (`submitOrderAction`) each carried a legacy fallback:
when no `screenshot_ref` was present, they read `formData.get('screenshot')` as a File and piped
it through `uploadPublicAsset` — i.e. `setnayan-media`, the one bucket bound to the public R2
host and served **unsigned** to anyone holding the key. In `orders/actions.ts` this sat three
lines below a comment stating payment proofs are *"Privacy-critical … never the public `media`
bucket"*.

A payment proof is a bank / GCash transfer screenshot: account numbers, account names, sometimes
a balance. It belongs in the private `thread-files` bucket, read only through short-lived
presigned GETs.

**It was a loaded gun, not a live leak** — and that distinction is why this is its own PR rather
than part of #3925. The fallback had no producer: the app's only
`<input type="file" name="screenshot">` is `papic/order/[token]/page.tsx`, and that form posts to
`submitPapicGuestPayment`, which uploads server-side to `R2_BUCKETS.threadFiles` and mints its
own ref. But the next page to render that field name would have published proofs to the open
internet with no code change.

**Deleted** both `else` branches and both now-unused `uploadPublicAsset` imports. The sanctioned
`screenshot_ref` path — gated in #3925 by `orderPaymentProofPolicy` /
`inlineCheckoutProofPolicy` — is untouched.

**Fails loudly, not silently:** checkout already required a proof, so a submit with no valid ref
falls through to the existing `A payment screenshot is required.` reject. The buyer is told
rather than having a proof quietly published or a null stored.

**Tests** — `lib/payment-proof-public-bucket.test.ts`, 6 cases: no import, no call, no legacy
`get('screenshot')` read, the sanctioned ref path still runs through `parseClientRef` with a
tenanted policy, checkout's required-proof reject survives, and the guest Papic path still
uploads server-side to the private bucket. Assertions match the **import and call syntax**, not
the bare identifier — the deletion leaves an explanatory comment naming `uploadPublicAsset`, and
a substring guard would have fired on our own prose (the same correction made to the Papic
retired-strings guard earlier today). Comments are stripped before the code-shape assertions.

**Mutation-proved:** reinstate the import alone → 1 fail; reinstate the whole fallback branch →
2 fail; delete the required-proof reject → 1 fail; restored → 6/6. Wider run: 140/140 across
every order / checkout / payment / storage test.

SPEC IMPACT: None — no behavior change on any reachable path. Closes the item left open in
`SECURITY_HANDOFF_2026-07-26.md` § 5b.
