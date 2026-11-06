## 2026-11-07 · feat(open-shop): the logo is framed by hand: drag to move, pinch to zoom, saved on its own (A3); the thumb row's Continue is a content-width pill

Owner, 7 Nov (prototype v21, the logo step): *"drag and pinch to zoom"*, *"change and save automatically"*.
Plan `PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07`, track A3.

### The logo control

- **The keypad is gone.** The first cut of the logo control (#7345) had two parts: the Maker's 9-point "Keep area N of 9 in frame" grid, and a "How close" menu (100 · 120 · 150). Both are replaced by one shared control, `app/_components/picture-frame-control.tsx` (`PictureFrameControl picture="logo"`). The circle itself is the editor:
  - one finger drags the picture;
  - two fingers pinch, zooming about the midpoint and following it;
  - a mouse wheel or trackpad pinch zooms at the pointer;
  - "−", a slider and "+" zoom from the centre, from 1× to 3×;
  - tapping twice starts again;
  - arrow keys, + / − and 0 do the same from the keyboard.

  `touch-action: none` is set on the circle only, so the page still scrolls.
- **One model**, in `lib/picture-frame.ts`:
  - x / y run 0–100 (`object-position`), and zoom runs 100–300, scaled about the same point;
  - with `object-fit: cover`, every value in those ranges keeps the circle full, so no empty edge can be drawn. A unit test sweeps this across five aspect ratios.
- **The names follow #7353 (A4).** #7353, the in-flight profile-picture PR, already calls the shared part `PictureFrameControl` / `pictureFrameStyle` / `PICTURE_FRAME_FIELDS`. Using the same names lets A4 add one `profile_photo` line and mount this control, instead of a second one.

### "Add your logo" saves on its own

- Every finished change saves through My Shop's own `updateVendorProfileField` (field=logo): the upload, each drag or pinch when the finger lifts, each − / + press, each slider step, and the wheel once it rests. The save goes about 600 ms after the last change.
- One status sits in place: "Saving…", then "✓ Logo saved". The screen is not reset.
- The "Save logo" button is gone. Skip for now becomes Continue once the logo is saved.
- A newly picked picture starts centred.
- My Shop's logo row mounts the same control and still posts the frame with the row's own save.

### The migration and the thumb row

- **Migration `20271316444107` was reshaped before it ever shipped.** It is not on `main`, so it was never applied to production.
  - The columns are now `vendor_profiles.logo_focal_x` / `logo_focal_y` (0–100) and `logo_zoom` (100–300), replacing `logo_focal` (1–9) and `logo_zoom` (100 · 120 · 150).
  - It keeps the same column grants (authenticated yes, anon no) and the same `vendor_profiles_self` rebuild.
  - The readers and selects were updated: the logo page, `/v/[slug]`, `lib/vendor-profile.ts` and the export column list.
- **The thumb row.** On every `/open-shop` step, the primary button (Continue · Pick a service to continue · Open my shop — free) is now a 44 px pill sized to its content, on the right. Back is a 44 px circle on the left, per BUTTON_RULE. The primary used to stretch the full width on a phone.

### Guards

- New `app/open-shop/the-logo-is-framed-by-hand.test.ts` checks four things:
  - the keypad and "How close" are gone, and so is the first-cut control file;
  - each logo surface mounts the one shared control exactly once;
  - the gesture: pointer drag + pinch, a non-passive wheel, and "−" / slider / "+" over the same bounds as the CHECKs;
  - "Add your logo" autosaves and says "Logo saved" once.
- `lib/open-shop-logo.test.ts` was rewritten. Its new cases cover: the drop-never-repair read, the NULL-for-default columns, the style, the no-empty-edge sweep, and a pinch keeping the point under the fingers still.
- `tests/db/a-shop-logo-keeps-its-frame.db.test.ts` checks four things: the three columns exist, their CHECKs match the ranges, the grants are right, and the view projects them. It also checks that `logo_focal` is absent.
- `the-gate-walk-fixes.test.ts` was updated from the keypad to the shared control.

**SPEC IMPACT:** None new. This builds the owner's 7 Nov prototype v21 logo step, which is already the recorded contract. The 2026-11-06 DECISION_LOG row "THE PROFILE PICTURE WEARS THE LOGO'S FRAME" still describes the 9-point keypad. That row is A4's (#7353) to update when it adopts this control; it is flagged in the PR, not edited here.
