## 2026-07-30 · fix(security): SEC-1 lane #2 — the paperwork upload was a cross-tenant read oracle on a private bucket

Deferred lane **#2** of the five left open by #3729: *"Five more stored-ref **write** paths reaching private buckets, same pattern, ~one guard line each."* Two are closed here — and they turned out to be very different severities, which is the part worth recording.

### 🔴 Paperwork — private bucket, real oracle

`uploadPaperworkScan` stored the client-supplied `document_r2_key` **verbatim**. That upload targets **`setnayan-vendor-contracts`** — a *private* bucket it shares with signed contracts and platform receipts (`paperwork/page.tsx` → `<FileUpload bucket="vendor-contracts">`).

So a host could put **any key from that bucket** onto **their own** paperwork row, and `paperwork/page.tsx:159` resolves stored refs into signed display URLs. **Another couple's PSA/CENOMAR, or a vendor's signed contract, handed back as a signed URL** — reached entirely through a row the attacker legitimately owns.

Worth being precise about why RLS didn't cover this: the `UPDATE` *is* RLS-scoped, so an attacker cannot write to someone **else's** row. It cannot stop them naming someone else's **key** on their **own** row. Row-level security secures rows, not the strings inside them.

### 🟡 Budget payment proof — public bucket, containment only

`proof_r2_key` on `event_vendor_payments` had the same raw-store shape, but lands in the **public media bucket** — no confidentiality delta (that bucket is served unsigned to anyone holding the key, by design). Its guard buys containment and attribution: a payment row must not point at an object belonging to another event.

It **drops to NULL** rather than throwing, deliberately: the receipt is *optional* evidence, and losing an attachment must never cost the host the payment record itself. Paperwork throws, because there the ref is the whole point of the action.

### Reused the sanctioned gate — no second guard

`lib/r2-client-ref.ts` (merged in #3729) says it plainly: *"Do not write a second guard."* Two policy factories were added next to the existing ones, so the expected prefix lives beside the tenancy id it derives from:

- `paperworkScanPolicy(eventId)` — names the private bucket **explicitly** and scopes to `paperwork/{eventId}/`. Scoped to the event and *not* the document type on purpose: a host may legitimately re-file a scan under a corrected type, and the tenancy that matters is the event.
- `budgetPaymentProofPolicy(eventId)` — public-media default, `budget/{eventId}/` + `payments/{eventId}/`.

**The contract was verified, not assumed.** A wrong bucket alias here would have refused *every* legitimate paperwork upload, so I traced it end to end: `/api/upload:93` maps the `vendor-contracts` alias → `vendorContracts` → `R2_BUCKETS.vendorContracts` = `setnayan-vendor-contracts`, and line 621 composes the stored ref via `encodeR2Ref(bucketName, objectKey)`. The test pins that exact shape, so it fails loudly if the alias or key layout ever moves.

### Tests — real unit tests, 8 cases

The guard is pure and client-safe *precisely* so this needn't be a source scan. Both the happy path and the attacks:

- the legitimate mint is accepted (pinning the real key layout)
- **another event's scan is refused** — the actual oracle
- a vendor **contract** / platform **receipt** in the same bucket is refused — sharing a bucket must not mean sharing reachability
- a private-bucket key cannot be reached through the public-media default, and vice versa
- traversal (`../`), a legacy `https://` URL (the SSRF shape #3729 closed), and a bare prefix with no object are all refused
- **the refusal message leaks nothing** — asserted to contain no "exists"/bucket/prefix hint, so it is not an existence oracle

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · `lint:entitlement-gates` OK · **`test:unit` 5,472/5,472 pass**.

### Still open in this lane

Three of the five write paths remain — `invite` proofs (`vendor-dashboard/invite/actions.ts:162` stores `proof_r2_ref` raw), `site-chrome`, and `portfolio_r2_keys[]` — plus lanes #1 (`/api/upload` generic branch, ~40 call sites, its own PR), #3 (`editorial-vendor/` needs a tenant segment in the key layout, not a guard), #4 (`/papic/media/` wants a rate limit) and #5 (7-day admin TTLs, `assertAdmin`-gated). The two closed here were the ones touching a **private** bucket from client input.

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. Security register updated.
