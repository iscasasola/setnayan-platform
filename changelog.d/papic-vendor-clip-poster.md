## 2026-07-22 · feat(papic): vendor documentation CLIPS compile into the event gallery

Completes the vendor-documentation gallery compile (owner "both"): Build B compiled
vendor photos; vendor clips couldn't tile because their poster key wasn't persisted.
The capture route already extracts + uploads + NSFW-screens a clip's poster — this
just stores its key and lets the gallery use it. Counsel-gated lane (unchanged).

- **Migration** `20270912613854` — `ADD COLUMN IF NOT EXISTS poster_r2_key` on
  `vendor_papic_captures` (the clip's still tile + the NSFW-screen proxy).
- **`/api/vendor/papic-capture/route.ts`** — captures the uploaded poster's r2 ref
  and stores it on the insert (`poster_r2_key`).
- **`lib/papic-gallery.ts`** — the vendor source now includes **clips** (dropped the
  `media_type='photo'` filter): a clip tiles on `poster_r2_key` and plays from the
  original (`r2_object_key`, geo-free); a photo shows the original. The grid's
  `ShowcaseToggle` already excludes `source=vendor`, and `saveUrl` stays null for
  clips/vendor rows.

SPEC IMPACT: None — completes the already-recorded "vendor documentation compiles
into the event gallery" (now photos + video). Still **DPO-BLOCKED** on the whole-lane
`vendor_papic_capture` control. `tsc --noEmit` clean.
