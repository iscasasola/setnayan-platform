## 2026-07-30 · fix(security): SEC-1 lane #1 — a private bucket can no longer be written under another flow's prefix

Deferred lane **#1** of #3729: *"`/api/upload` generic branch — any user can presign a `PUT` under any prefix/bucket. **Write pollution, not disclosure** (server-side `randomUUID()` prevents overwrite). ~40 call sites → own PR."*

### What I did NOT do, and why

The obvious fix is a fail-closed allowlist over every `(bucket, prefix)` pair. I enumerated the real surface first, and that fix would have been the wrong trade.

`setnayan-media` is **public by design** (`R2_PUBLIC_URL` serves it unsigned) and carries the overwhelming majority of call sites with a genuinely long tail of roots: `events/`, `vendors/`, `editorial/`, `hero-videos/`, `hero-frames/`, `living-heroes/`, `editorial-vendor/`, `locked-qr-proof/`, `papic/`, `profile-photo/`, `onboarding/`, `zone-walkthroughs/`, `taxonomy/`… I kept finding more as I searched, which is the tell. **A fail-closed allowlist there risks silently breaking a real upload for zero confidentiality gain** — media pollution is a cost/abuse concern, not a security boundary.

### What I did

**Bound each of the four PRIVATE buckets to the root segments that legitimately write to them**, fail-closed, leaving public media untouched. Their call sites are few enough to enumerate **exhaustively** — and I did, by grepping every `bucket="…"` / `bucket: '…'` occurrence:

| private bucket | allowed roots | why it matters |
|---|---|---|
| `setnayan-thread-files` | `events/` `payments/` `payment-screenshots/` | payment screenshots, dispute evidence |
| `setnayan-vendor-contracts` | `paperwork/` | shares the bucket with signed contracts + receipts |
| `setnayan-vendor-verification` | `vendors/` | DTI / BIR 2303 / Mayor's Permit / IDs |
| `setnayan-samples` | `refinements/` `taxonomy/` | admin-authored catalogue art |

The exposure this closes is concrete: **arbitrary bytes landing in `vendors/…/verification/` — which an admin reads to approve a business — or in `thread-files`, where dispute evidence lives**, posted from an entirely unrelated surface. Not a disclosure; an integrity and review-queue problem.

### Honest about the limit

**This is containment, not tenancy.** It proves the prefix *family* belongs to the bucket; it does **not** prove the caller owns the id inside it — `paperwork/{someone-else}/…` still satisfies the map, and there's a test asserting exactly that so nobody mistakes it for an ownership check. Per-flow tenancy binding is the remaining half of lane #1: it needs each call site to authorise its own id (the `paperworkScanPolicy` treatment from #3902, applied across ~40 sites). **What this closes is the cross-bucket jump, which is the part no individual call site can defend against.**

### Tests — 20 cases, and the half that matters most

The first eight assert **every real private-bucket call site still works**, each pair read off an actual site. That direction is the more important one: *a fail-closed allowlist that refuses a legitimate upload is a worse outcome than the pollution it prevents.* Then: the cross-bucket jumps are refused (8 pairs), public media stays permissive including a hypothetical new prefix, and the containment limitation is pinned.

**A note on my own coverage.** The mutation probe caught a gap in *my* tests: 19 of them exercise the pure predicate, so **deleting the route's call would have left them all green while the hole reopened.** Added a guard on the wiring itself — that the route calls it, on the *resolved* `bucketName`, after the shared refusals. Probed: stubbing the call to `if (false)` fails that test by name. Guard the consumer, not just the rule.

**Verification:** `tsc --noEmit` clean · `next lint` clean · **`test:unit` 5,484/5,484 pass**.

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. Security register updated.
