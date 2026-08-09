## 2026-08-10 · feat(preservation): ₱500/year keeps 3,000 photos or 150 videos — counted, never measured

Owner-locked today, after three corrections in one sitting. **What is sold is
resolution, not space.**

| | |
|---|---|
| **Free** | the compressed copy of every photo and video, kept **5 years**. Past five it becomes a paid option — **nothing is deleted**. |
| **₱500 / year** | the **full-resolution originals** — **3,000 photos or 150 videos**, any combination (a video = 20 photos), from the day they buy. |

Owner, verbatim: *"do not price by drive. price by number of photos and videos"* ·
*"we will preserve it compressed so they still keep it. we just allow them to
preserve it"* · *"if the pay nothing, we still keep their photos for 5 years. but
compressed."*

### What changed

`lib/papic-storage-telemetry.ts`'s **billing half** is replaced. The byte
telemetry above it is untouched and still correct — it answers a different
question (what are we actually holding, for our own cost reporting), and must
never be wired into anything a customer reads.

- `STORAGE_BLOCK_GB = 10` → `PRESERVATION_BLOCK_UNITS = 3_000`
- `CLIP_UNITS = 20` — a video costs twenty photos
- `STORAGE_BUFFER_GB` — **deleted, not converted**
- `blocksNeeded(bytes)` → `blocksNeeded(units)`; `allowanceGb` → `allowanceUnits`
- `storageMeter` → `preservationMeter`: a percentage of a **count**

### 🔑 Three things this gets right that the byte model could not

**1 · There is no free allowance to set.** "How many photos are free?" only made
sense while this was thought of as a drive. The free tier is the compressed
gallery everybody already has, so the paid tier is exactly the originals.

**2 · An already-compressed capture costs nothing.** `preservationUnits` returns
**0** once `full_res_dropped_at` is set. Charging for it would bill a couple for
the tier they did not buy.

**3 · Counting fixes the clip hazard at the root.** The byte model needed an
`unmeasured` flag because a clip's raw video has no recorded size — the
derivative writer omits `orig_bytes` for clips by design. Those are the largest
objects on the platform, so clip-heavy events would have been **billed least
while costing most**, with the customer's meter reading reassuringly low. Wrong
in both directions, nothing erroring. A clip is one row worth 20 units whether or
not anyone sized it, so nothing is invisible and no flag is needed.

### ⚠ Why 3,000 and not the 1,000 first named

Against the pools actually sold (3,000 / 6,000 / 10,000 shots at ₱1,000 /
₱2,000 / ₱3,000), 1,000 photos per block would have asked a couple who spent
₱3,000 on shots for **₱5,000 a year** to keep them — pricing the best customers
straight onto Google Drive. At 3,000 the block matches the smallest pool exactly:
*"the pool you bought is the pool you keep."* ₱1,000 buyer pays ₱500; ₱3,000
buyer pays ₱1,500.

Cost evidence, internal only and never a unit: one block lands near 12 GB either
way (3,000 × ~4 MB; 150 × 60–90 MB) ⇒ ~₱125/yr ⇒ ~75% margin.

### Guard — mutation-tested

`lib/preservation-is-counted-not-measured.test.ts` (11 tests) replaces
`storage-billing-is-what-we-hold.test.ts`, whose model no longer exists; every
lesson it carried is restated here against the new one.

| sabotage | result |
|---|---|
| a video worth one photo | ❌ 3 fail |
| bill originals already replaced | ❌ 2 fail |
| block back to 1,000 | ❌ 6 fail |
| the 5 GB buffer returns | ❌ 1 fail |
| a gigabyte field escapes into the result | ❌ 1 fail |
| baseline | ✅ 11/11 |

One test asserts the two limbs still describe **one** block
(`3_000 / 20 === 150`), so "any combination" stays a rule rather than a slogan.
Another walks the returned objects and fails on any byte-shaped key — that is how
"price by drive" comes back, and it already came back once in a row written to
record a different decision.

⏭ Not in this PR: the meter UI, the purchase-date renewal record, and the sweep's
"this original is paid-preserved, skip it" check. This is the arithmetic those
three will read.

SPEC IMPACT: `DECISION_LOG.md` rows 2026-08-10 (four, including two corrections)
— applied and pushed.
