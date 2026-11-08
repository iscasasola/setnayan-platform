## 2026-11-06 · feat(profile): the profile picture gets the shop logo's align + zoom — one shared control

Owner, 6 Nov 2026, asked whether a person's profile picture gets the same align + zoom as the business logo:
*"yes, use the same control"*. Stacked on #7345 (the shop logo's align + zoom).

- **One control.** The logo's copy of the Event Hub Maker "In frame" row (`logo-frame-control.tsx`) is extracted into
  `app/_components/picture-frame-control.tsx` → `PictureFrameControl` (the "Keep area N of 9 in frame" keypad + the
  "How close" `PickMenu`, words unchanged). `LogoFrameControl` is now that control with `picture="logo"`. The model,
  the read rule and the `<img>` style live once in `lib/picture-frame.ts` (`PictureFrame`, `readPictureFrame`,
  `pictureFrameStyle`, `PICTURE_FRAME_FIELDS`); `lib/open-shop-logo.ts` keeps its names and delegates. The Maker file
  is untouched.
- **Migration `20271319958455_profile_photo_focal_and_zoom`.** `users.profile_photo_focal` (1–9) /
  `profile_photo_zoom` (100 · 120 · 150): nullable `SMALLINT`, the same closed-set CHECKs as the logo pair. No GRANT:
  `users` carries table-level grants, so the columns inherit them (a column `REVOKE` cannot subtract from a table
  grant — checked on PGlite). The exposure baseline gains two `col` lines (`anon=S authenticated=SU`), like every other
  `users` column; anon reaches no `users` row (no anon policy — pinned by `a-profile-photo-keeps-its-frame.db.test.ts`).
  Not applied anywhere; the pipeline applies it.
- **Where it is set.** `/dashboard/profile` (the identity tile, now `profile/_components/profile-identity-tile.tsx`) and
  the signup "You" card mount `ProfilePhotoField`: the photo upload, then the control below it — the logo screen's
  placement. The frame posts with the form's own Save/Done through `planPersonalInfoPatch` (a cleared photo clears its
  frame; a form without the photo never writes it).
- **Where it is drawn.** The account switcher (all three avatar sizes) and the public profile `/u/[userSlug]`.
- **Guard.** `lib/one-picture-frame-control.test.ts` fails if either picture stops drawing through
  `PictureFrameControl`, if a keypad appears outside it (Maker files excepted), or if the two styles part.
- **Labs.** `/dev/profile-photo-lab` (the real identity tile on fixtures), `/dev/you-lab?state=framed`,
  `/dev/avatar-sheet-lab?who=framed`.

SPEC IMPACT: DECISION_LOG.md row 2026-11-06 "THE PROFILE PICTURE WEARS THE LOGO'S FRAME" (owner ruling recorded; the
control, the two columns, the surfaces framed and the follow-ups).

## 2026-11-07 · feat(profile): A4 — the profile picture is framed by hand through the shop logo's drag + pinch control

The controller's A4 brief, building on A3 (#7351, prototype v21: *"drag and pinch to zoom"*). The keypad in the block above was replaced before it shipped.

- **The same control.** I merged `claude/open-shop-redesign-nov6` (#7351) into this branch, with no rebase, so **#7353 now ships after #7351**. The profile picture now mounts A3's `PictureFrameControl picture="profile_photo"`: drag, pinch, wheel, − · slider · +, and tap twice to reset. That control replaces this PR's keypad copy, and `logo-frame-control.tsx` is deleted.
- **Migration `20271319958455` was reshaped in place.** It is not on `main` and was never applied. The columns are now `users.profile_focal_x` / `profile_focal_y` (0–100) and `profile_zoom` (100–300), replacing `profile_photo_focal` (1–9) and `profile_photo_zoom` (100·120·150). It has the same CHECKs as the logo's three columns, and there is still no grant block (table-level grants, as before). The migrations manifest was regenerated.
- **One picture.** `ProfilePhotoField` draws the circle first, and the upload under it is `[Replace photo] [Remove]` (`FileUpload pills`).
  - The You card's 72 px row now shows only while the field is empty. Once a photo is in, the circle replaces it, so the card no longer shows the photo twice.
  - The profile tile's photo column is now 17rem, so the zoom row fits.
  - A new picture starts centred.
- **Readers renamed:**
  - `/signup/you`, `/dashboard/profile`, the account switcher's data, `lib/public-profile.ts`, and `planPersonalInfoPatch`, which reads and writes the three `PICTURE_FRAME_FIELDS.profile_photo` fields;
  - the you / avatar-sheet / profile-photo labs.
- **Guards:**
  - `lib/one-picture-frame-control.test.ts` was rewritten. It checks one control, no keypad outside the Maker, three named columns read and written with drop-never-repair, and one picture on screen.
  - The `tests/db/a-profile-photo-keeps-its-frame.db.test.ts` checks now cover three columns, the logo's ranges, and the keypad pair being gone.
  - The patch test was moved to x / y / zoom.

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-11-06 "THE PROFILE PICTURE WEARS THE LOGO'S FRAME" was rewritten for drag + pinch and x / y + zoom, and pushed to `Setnayan-specs` main (ff9ddae6).
