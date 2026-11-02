## 2026-07-30 · fix(security): `editorial-vendor/` is now tenanted — SEC-1 lane #3 closed, and with it the whole deferred list

The last item on the #3729 deferred list, and **the only one a guard could not fix.** I'd flagged it as needing its own session because it looked like a key-layout change *plus* a migration of existing objects. One query changed that: `editorial_vendor_media` has **0 rows** in prod, so there was nothing to migrate.

### Why a guard couldn't fix it

`editorialVendorMediaPolicy()` took no arguments, because the uploader wrote to a **flat** `editorial-vendor/` prefix. The policy could only prove *"this is in the media bucket under the right prefix"* — never *"this belongs to this vendor."* Its own doc comment said so and named the fix: move the uploader to `editorial-vendor/{vendorProfileId}/{eventId}/`.

**The weakness was in the key layout, so only the uploader could fix it.** A guard cannot invent tenancy the key doesn't carry.

Why it matters: these refs are presigned onto the couple's **public** editorial site (`app/[slug]/…/editorial/data.ts`) and read server-side by `lib/nsfw-screen.ts`.

### What changed — end to end, because half of it is useless

- **Uploader** (`editorial-media-studio.tsx`) writes to `editorial-vendor/{vendorProfileId}/{eventId}/`; the flat prefix is gone rather than unused. `vendorProfileId` is a new prop, passed from the page which already had `profile.vendor_profile_id`.
- **Policy** takes `(vendorProfileId, eventId)` and requires that prefix.
- **Write action** pins against the *same* pair. The pinning had to **move**: it previously ran in the early shape-validation loop, before `fetchOwnVendorProfile`, and a tenanted policy can't be built before the vendor is known. There's a test asserting that ordering, because the tempting shortcut — passing a placeholder to keep the early call — is exactly how a tenanted policy silently degrades to a flat one.

**Two things are now impossible, not one.** Attaching another vendor's media to this event, *and* attaching your own media from a **different couple's event** — the second is what a flat prefix could never catch, and it's the one that would put the Cruz wedding's photos on the Santos wedding's public page.

### The migration precondition, made explicit

There's a test asserting the **old flat layout is now refused**. That documents why the 0-row check mattered: had prod held flat-prefix rows, this change would have orphaned them — the reader would refuse keys the product had legitimately written. Anyone re-running this pattern on a table that *does* have rows must backfill first.

### Tests — 6 cases

Own media accepted · another vendor's refused · **own media from another event refused** · the old flat layout refused · private buckets and traversal refused · and a wiring test pinning the uploader prefix and the server policy **together**, since a drift between them is a broken upload rather than a silent hole.

**Probed:** reverting the uploader to the flat prefix fails *"the WIRING: uploader prefix and server policy agree exactly"* by name.

**Verification:** `tsc --noEmit` clean · `next lint` clean · **`test:unit` 5,574/5,574 pass**, including the pre-existing `r2-client-ref.test.ts` case that pinned the flat layout — updated to the tenanted one rather than deleted, so the accept-path stays covered.

### 🏁 The SEC-1 deferred list is now fully closed

| lane | state |
|---|---|
| #1 `/api/upload` generic branch | private-bucket root binding (#3905) |
| #2 five stored-ref write paths | all five (#3902, #3909, #3911, #3912) |
| #3 `editorial-vendor/` untenanted | **this** |
| #4 `/papic/media/` rate limit | #3914 |
| #5 7-day admin TTLs | won't-fix, pinned as an invariant (#3914) |

Still open beyond the list: per-flow tenancy binding for the ~40 public-media call sites (hardening — every high-severity instance of that class is now closed), CSP `script-src`, and the RoPA entry for WebRTC/TURN.

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. Security register updated.
