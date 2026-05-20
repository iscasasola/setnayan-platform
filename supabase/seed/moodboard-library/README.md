# Moodboard library — V1 seed photos

Two AI-generated reference photos that prove out the Color Range Manipulator
mechanic from iteration 0010. Generated via Higgsfield (Setnayan-owned IP)
on 2026-05-20 — see the 2026-05-21 "Moodboard expanded · 3 pillars" row in
[`CLAUDE.md`](../../../CLAUDE.md) for the context.

| File | Type | What's tag-friendly about it |
|---|---|---|
| `figure_filipino_guest_v1.png` | `figure_attire · guest_female` | Filipino woman in a uniform emerald green cocktail dress. The dress is a single solid hue — clean target for slot 1 (cocktail dress). Skin tones are warm but far from emerald, so the color-range mask stays on the dress with reasonable tolerance. |
| `venue_filipino_reception_v1.png` | `venue_scene · reception` | Manila ballroom reception setup with burgundy drapery + matching table runners as the dominant accent. White tablecloths + gold chairs are distinctly different hues so the color-range mask stays on the burgundy regions. |

## How to use these in V1 soft-beta

Once the migrations in [`20260525000000_iteration_0010_moodboard_library.sql`](../../migrations/20260525000000_iteration_0010_moodboard_library.sql)
+ [`20260526000000_iteration_0010_event_moodboard_saves.sql`](../../migrations/20260526000000_iteration_0010_event_moodboard_saves.sql)
+ [`20260527000000_iteration_0010_moodboard_vendor_uploads.sql`](../../migrations/20260527000000_iteration_0010_moodboard_vendor_uploads.sql)
are applied:

1. Log in as an admin user (`is_internal` / `is_team_member` / `account_type='admin'`)
2. Visit `/admin/moodboard-library`
3. Upload each PNG (they auto-receive the SETNAYAN watermark client-side
   before the upload — original PNGs in this folder stay un-watermarked)
4. Tag the regions:
   - **figure**: eyedropper on the dress, tolerance ~15, save to Slot 1, label "cocktail dress"
   - **venue**: eyedropper on the burgundy drapery, tolerance ~15, save to
     Slot 1, label "drapery"; (optional) eyedropper on the gold chairs to
     Slot 2, label "chairs"
5. Click "Publish" on each
6. Switch to a host account, visit `/dashboard/[eventId]/add-ons/mood-board`,
   verify the two cards appear in Visual preview with the palette applied

## When this folder retires

These are **V1 placeholders only**. Per the owner's 2026-05-21 directive,
the full library generation lands in V1.x — at that point Higgsfield will
produce a richer Filipino-first library (~100 figures + ~100 venue scenes
spanning Tagaytay garden, Manila ballroom, beach reception, hacienda,
cathedral, etc.). When that lands, retire these two and delete this folder.

Internet placeholders are also **disallowed at public hard-launch** (per
the IP-cutover discipline locked in 0010 § "Asset sourcing strategy").
These Higgsfield-generated PNGs are Setnayan-owned, so they're fine to
keep through soft-beta.

## Provenance

- Generated 2026-05-20 via Higgsfield workspace (`user_3DvCMge8WKFuyTkcpidqZrFxpiO`)
- Figure: model `text2image_soul_v2` (Higgsfield Soul 2.0), seed 17634, quality 2k, aspect 3:4
- Venue: model `nano_banana_2` (Google Nano Banana Pro), resolution 2k, aspect 16:9
- Source URLs (raw) on file in the prior session — both downloaded into this repo at 2026-05-21
