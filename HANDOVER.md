# HANDOVER — rd/cover-video-listed-and-shaded (2026-10-17)

Two live faults on cale-ice's Cover Scene › Background. Both causes MEASURED and fixed on this branch:

1. Video missing from the Upload row — both Cover Scene mounts (`editor-shell.tsx` coverSceneBackground,
   editor `page.tsx` Details › Hero coverScene) never passed `sceneUploads` / `videoChoice`; the rows defaulted to [].
   Now required props; one list via `coverUploadCards` (lib/cover-scene.ts); clip card "▶ Your video · N s".
2. Lighter did nothing — `coverSceneLegibility`'s scrim shrank exactly as the white veil grew (identical colours
   0 → +60). Scrim now never below the ground's own need. Canvas follows the thumb: `coverShadeLook` →
   `app/[slug]/_components/cover-shade-preview.ts` via the editor bridge (`coverShade` message), undone in
   `undoLaidPreviews`.

Guards: lib/every-cover-upload-is-listed.test.ts · lib/the-cover-shade-reaches-every-ground.test.ts (8 sabotages red).
Walk: ~/Documents/Claude/Projects/cover-video-walk/ (serve.sh on :3781, walk.mjs Maker, guest.mjs guest page).
Open: CI; owner sign-off on the scrim rule (product-visible: covers with a shade are now more veiled than before).
