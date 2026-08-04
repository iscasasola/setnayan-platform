## 2026-07-30 · fix(security): site-chrome could point a wedding's PUBLIC site at another vendor's ID — lane #2 closed

The last two write paths of SEC-1 lane #2. One turned out to be live and public; the other is latent and guarded anyway.

### 🔴 site-chrome — live, and public

`site_bg_music_r2_key` and `landing_page_hero_video_r2_key` were validated by a single helper whose whole body was `startsWith('r2://')`. Both columns are served to the **public guest site**:

- `[slug]/_lib/loaders.ts:294` signs the music through `displayUrlForStoredAsset`
- `lib/showcase-db.ts:399` resolves the hero video for the public showcase

`displayUrlForStoredAsset` signs **any** bucket with no tenancy check — its own header says so. So a crafted post to the site-chrome editor could point a wedding's background music or hero video at `r2://setnayan-vendor-verification/vendors/X/verification/dti.pdf`, and **the couple's own public wedding site would serve a signed URL to another vendor's government ID.**

Same severity class as the portfolio bug (#3909): public exposure of a private bucket. `eventMediaPolicy(eventId)` already existed for exactly this shape and was simply never applied here — **the same half-wired pattern as the RSVP selfie (#3911)**, now three for three.

### 🟡 invite proofs — latent, guarded anyway

`vendor_locked_qr_tokens.proof_r2_key` / `remembrance_r2_key` had the same weak check, but — verified by grep — **neither is resolved through any signing helper today**, so there is no path to abuse yet. Guarded so the ref is already trustworthy the day someone builds a surface that displays it.

That is the cheap half of the #3909/#3911 lesson: **the write is where a ref becomes trustworthy**, and bolting the pin on *after* a reader appears is exactly how these became oracles.

⚠ **Containment, not tenancy** — `locked-qr-proof/` is a flat prefix with no vendor segment, so the new `lockedQrProofPolicy()` proves bucket + prefix, not ownership. Same documented limitation as `editorialVendorMediaPolicy`; tightening needs the *uploader* to move to `locked-qr-proof/{vendorProfileId}/`. There's a test asserting the limitation so nobody mistakes it for an ownership check.

### The pattern, now five for five

Every oracle this sweep has found was **a policy that existed but wasn't applied at every writer** — not a missing policy:

| # | path | severity |
|---|---|---|
| #3902 | paperwork | private bucket, host-visible |
| #3902 | budget proof | public bucket, containment |
| #3909 | vendor portfolio | **public internet** |
| #3911 | RSVP selfie | private bucket, couple-visible |
| this | site-chrome | **public internet** |

So the durable question is not *"is there a policy for this flow?"* but ***"is it applied at every writer of the column?"***

### Tests — 7 cases

Real uploads accepted for both flows · private buckets refused from site-chrome (the public-exposure path) · another event's media refused · the invite containment limitation pinned · and wiring scans for both files asserting the pins are reached and that **the old scheme-only check is gone rather than merely bypassed**.

**Probed:** restoring `startsWith('r2://')` in site-chrome fails the wiring test by name.

**Verification:** `tsc --noEmit` clean · `next lint` clean · **`test:unit` 5,542/5,542 pass**.

### Exposure

Prod is pre-launch (3 events, 1 vendor profile) — no second tenant's material to reach. Preventative.

**SEC-1 lane #2 is now closed.** Remaining in the SEC-1 family: per-flow tenancy binding for the ~40 media call sites, lane #3 (`editorial-vendor/` needs a tenant segment in the key layout, not a guard), #4 (`/papic/media/` rate limit), #5 (7-day admin TTLs).

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. Security register updated.
