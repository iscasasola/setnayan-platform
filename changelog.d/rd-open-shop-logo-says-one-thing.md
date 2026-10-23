## 2026-10-23 · fix(open-shop): the logo step says one thing; the formats line breaks cleanly

/open-shop's first step read "Shop logo optional" and, under the upload, "Needed before your shop is approved —
add it now or later." The rule (owner decision 4, 2026-07-21; `lib/open-shop-logo-gate.test.ts`) is: the logo is
not needed to open the shop, and is needed before verification (it is a business-profile checklist row, and
`verificationSubmitMissing` refuses the papers while the profile is incomplete). Approval/publishing never reads
it. The label now says "Shop logo · can wait" and the line "You'll need it to get verified — add it now or
later.", both from one `LOGO_LATER` pair in `lib/open-shop-validation.ts`.

The round upload's limits line ("PNG · JPEG · WEBP · HEIC · HEIF · UP TO 10 MB") wrapped mid-phrase at 375 px
("… UP TO" / "10 MB"). It is now two lines — the formats, then "UP TO 10 MB" kept whole — in
`app/_components/file-upload.tsx` (every round, single-file upload: /open-shop, /signup/you, Profile, the
Event Hub background panel).

Guard: `app/open-shop/the-logo-step-says-one-thing.test.ts`.

SPEC IMPACT: None — copy and layout only; the logo rule is unchanged.
