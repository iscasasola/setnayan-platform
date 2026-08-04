## 2026-07-30 · fix(privacy): off-platform payment receipts were writing to the PUBLIC bucket — F10 closed

When a couple logs a payment made to an off-platform vendor, they can attach a photo of the bank transfer. Those photos were being written to `setnayan-media` — **the one publicly-served R2 bucket**, fetched with no signature (`PUBLIC_MEDIA_BUCKET`, `lib/booth-studio.ts:267`). Bank-transfer screenshots: reference numbers, partial account numbers, names. The only protection was an unguessable key.

**Two words caused it.** `bucket="media"` and a prefix of `events/<id>/payment-proof` — which begins with `events/` and therefore takes `bucketForPrefix`'s public default. Setnayan's *own* checkout proofs have routed to the private `thread-files` bucket since the earlier F1 fix; this path simply never went through that door.

**The fix:**
- `bucket="thread-files"`, and the prefix reshaped to `payment-proof/events/<id>` so the **prefix alone** is sufficient
- a `payment-proof/` rule added to `bucketForPrefix()` as defence-in-depth, so a future server-side writer that routes by prefix cannot land these publicly by omission — omission is precisely how they got there

**Verified before touching anything: zero objects are currently exposed.** Production holds 3 payment rows, none with a receipt attached, none in the public bucket. So this closes a live code path before anyone walked it — there is **no migration and no relocation of existing objects**, which was the risky half. Had the count been non-zero, the precedent existed: `scripts/migrate-payment-screenshots-to-private.ts` did exactly that job for the checkout proofs.

**There is currently no reader.** `proof_r2_key` is written here and displayed nowhere — the same write-only shape as finding F8. The comment now records that when a reader *is* built it must resolve through `displayUrlForStoredAsset()` (`lib/uploads.ts`), which issues a short-lived signed GET, and must never interpolate the key into a public URL.

**Two tests, one of which is the interesting one.** The first pins the new prefix as private. The second pins that the **OLD** prefix (`events/<id>/payment-proof`) resolves to `media` — proving the fix is the prefix shape and not luck, and failing loudly if anyone "tidies" the path back to an event-first form and silently re-opens the hole.

Worth recording how this was found: it surfaced while re-auditing F1 ("payment screenshots → public bucket"), which turned out to be genuinely **fixed**. The old finding's stated location was stale, and following that staleness led to a *different*, live path with the same exposure. A closed finding whose trace has rotted is not harmless — chasing the rot is what found this.

The code comment framing these as "the host's own record, not a Setnayan-verified proof" was accurate about *whose* data it is, and silent about how exposed it was. Both are now stated.

SPEC IMPACT: `DECISION_LOG.md` row — F10 closed by routing off-platform receipts to the private bucket; no existing objects were affected (verified 0 in prod). No schema change, no RLS edit, no flag; no exposure-baseline regeneration.
