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
