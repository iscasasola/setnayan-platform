## 2026-08-24 · fix(privacy): the shared pool blurs and keeps too — the last surface still vetoing

Owner ruling 2 of 2026-08-17: *"Withdrawal BLURS and KEEPS the photo, not hides it. Deliberately SOFTER than today, so one guest opting out cannot delete a table of ten people's group shot."*

`guest_pool_gallery` — the whole-pool browse other guests use — carried the **same two-rules-for-one-promise split** the venue wall did:

| | rule |
|---|---|
| FaceBlock | blur-and-KEEP — `CASE WHEN v_fb THEN wall_safe_r2_key ELSE display_r2_key END`, gated on a real bake |
| Withdrawn consent | **VETO** — `AND NOT EXISTS (… photo_consent = FALSE)`, the capture dropped outright, blurred copy or not |

So a guest who opted out was **removed** from the shared pool rather than blurred in it, and everyone else in that frame lost the photo with them. The venue wall was corrected earlier today and the public event page on 2026-08-18; **this was the third and last.**

🔑 **ONE PREDICATE, NOT A THIRD COPY OF THE RULE.** `papic_capture_needs_blur` (same wave) is asked here too. Re-inlining the condition would have been the fourth copy — and the pool is exactly where the two reasons had already drifted into different shapes. `v_fb` disappears from the row logic entirely: on a FaceBlock event the predicate is TRUE for every row, reproducing the old event-wide behaviour, while a withdrawal now colours only its own photos.

### The web copy, not the projector file

`wall_safe_r2_key` is a full-size blurred JPEG built for a venue projector; serving it to a phone is the exact cost the AVIF pipeline exists to avoid (measured in this repo: display averages 96 KB against a 780 KB max). Both the pool and the public event page now prefer `safe_display_r2_key` — the blurred copy at the size a page actually renders — with the projector file as the fallback for rows baked before those columns existed.

⚖ **That half is a COST fix, not a privacy fix, and must not be described as one.** Both files are blurred; the fallback is heavier, never barer. **It also gives the columns added earlier in this wave their reader** — without it they would have been a gate with no handle.

### The floor that survived the softening

⚠ This makes ONE person's photo more visible — blurred, where it used to be absent — to stop them deleting nine other people's. So the assertions that matter most are the ones proving the floor held:

- An **unblurred** photo of someone who opted out still never reaches the pool.
- 🔒 **A CLIP of them is DROPPED, never served.** There is no video blur — `lib/face-blur.ts` bakes stills only — so a clip has no safe form. Serving one "because a still was baked" would be the leak. That was already true for FaceBlock events and is now true for withdrawals too.
- The pool still never hands out the geo-bearing original.
- The couple's own close-the-pool toggle is untouched.

### Verification

9 db assertions with an anchor that fails if an ordinary photo cannot reach the pool at all, so nothing below it can pass vacuously.

**Four mutations, each measured by occurrence count, each red, each restored green:** fail-closed removed (6→1, three tests red including both floors) · the clip guard removed (2→0, the leak test red) · the unblurred copy served when a blur is required (2→1, five red) · the projector file preferred over the web copy (1→0, the cost test red).

All four related db suites green together (33 assertions), full unit suite green (9693), typecheck clean, migration allocator-verified.

### 🛑 A scoping correction worth recording

I originally reported that the public event page had **no** consent or FaceBlock handling and that blurring it needed new plumbing. **That was wrong** — it shipped on 2026-08-18 (`809fb1769`), with its own one-place gate. What misled me: `lib/public-media-visibility.ts` correctly notes that two moderation states *"are NOT written by any code path today"*, and I read that as "there is no handling", when the handling simply lives under a different mechanism. **An unwritten column is not an absent feature — grep the SURFACE, not the column you happen to know about.** Only the shared pool was genuinely still vetoing, which made this about a third of the work I described.

SPEC IMPACT: Owner ruling 1 (blur on the venue wall, the public event page and the shared pool) is now **complete across all three**. The couple's own album stays unblurred, as the ruling requires.
