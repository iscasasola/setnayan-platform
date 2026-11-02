## 2026-07-30 · fix(security): a vendor's portfolio could publish ANOTHER vendor's government ID to the open internet

Found while working the last three write paths of SEC-1 lane #2. **This is the most severe item found in this session** and it ships on its own.

### The bug

`portfolio_r2_keys` accepted any client-posted string that began with `r2://` — that was the entire validation (`parsePortfolioRefs`, `vendor-dashboard/actions.ts`).

`/v/[slug]` — the **public** vendor page — resolves that column through `resolvePortfolioUrls` → **`displayUrlForStoredAsset`**, which `lib/r2-client-ref.ts` documents in its own header as signing *"any `r2://` ref for **any** of the five buckets with **no tenancy check whatsoever**"*.

So a vendor could store

```
r2://setnayan-vendor-verification/vendors/{someone-else}/verification/dti.pdf
```

in **their own** portfolio array, and **their own public profile would publish it** — another vendor's DTI / BIR 2303 / Mayor's Permit. Government ID documents, served to anyone on the internet.

**Strictly worse than the paperwork lane (#3902)**, which at least required being signed in as the host and rendered only to that host. This one publishes.

### The fix

Every ref now passes `vendorOwnedMediaPolicy(vendorProfileId)` — **public media bucket only, `vendors/{thisVendor}/` prefix only** — applied inside the **shared parser**, so both call sites (the full-profile save and the gallery-only patch) and any future caller inherit it. A ref that fails is **dropped**, not thrown: a portfolio is a list, and one bad entry must not fail an otherwise valid profile save — but it can never be persisted, so the publish path has nothing to sign.

`parsePortfolioRefs` now **requires** the vendor id — no default — so a caller cannot forget it.

**Why the `?? ''` fail-closed default cannot cost a vendor their gallery**, which I checked rather than assumed: `vendor_profile_id` is the PK of a row selected by the caller's **own** `user_id`, so it is non-null whenever the row exists; and when it doesn't exist, the write is an `UPDATE … .eq('user_id', …)` that touches **0 rows**. Nothing is persisted either way. (Had it been an upsert, this default would have silently wiped a first-time save — worth stating, because that was the risk I was checking for.)

### Tests — 6 cases

The policy is pure, so these exercise it directly, plus a source-scan for the wiring since the parser is module-private:

- a vendor keeps their own portfolio / services / logo media
- **🔴 another vendor's verification doc is refused** — the exposure
- **their own verification doc is refused too** — that bucket is private and has its own flow; a portfolio is public by definition
- another vendor's *public* media is refused
- every other private bucket (`thread-files`, `vendor-contracts`, `samples`) is unreachable from a portfolio ref
- an empty vendor id allows **nothing**, not everything

**Probed:** deleting the policy filter fails the wiring test by name.

**Verification:** `tsc --noEmit` clean · `next lint` clean · **`test:unit` 5,503/5,503 pass**.

### Exposure assessment

Prod has **1 vendor profile** and is pre-launch, so there was no second vendor whose documents could have been reached — nothing to notify. This was preventative, like the rest of the SEC-1 family.

### Still open in lane #2

`invite` proofs (`vendor-dashboard/invite/actions.ts:162` → `locked-qr-proof/` in **public** media) and `site-chrome` — both public-bucket, containment-grade, materially lower severity than this one.

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. Security register updated.
