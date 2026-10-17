## 2026-10-17 · fix(maker): the Cover Scene's Upload row lists the couple's video, and Darker ↔ Lighter shows on it

Two live faults on cale-ice's Cover Scene › Background (owner, 17 Oct): *"why is the video not showing on the list of
uploaded media files?"* and *"darker lighter not showing"*.

- **The video had no card.** Measured: the editor page signs the cover's own clip into `sceneUploads`
  (`sceneUploadRefs` reads the hero row's `canvas.ground`), but BOTH Cover Scene mounts — the toolbar's
  `coverSceneBackground` (`editor-shell.tsx`) and Details › Hero's `coverScene` (editor `page.tsx`) — left
  `sceneUploads` and `videoChoice` out, and the rows defaulted them to `[]` / null. Both now pass them; the props are
  REQUIRED on `CoverSceneGroundRows` and `SceneBackgroundRows` (no default), and the row is one list
  (`coverUploadCards`): the couple's clips and photos, the worn ground always a card and ringed, a clip reading
  "▶ Your video · N s" (its length read from the file's header). Switching between the clip and a photo keeps the bar.
- **Lighter did nothing.** Measured: the legibility scrim was the weakest that holds AA over the VEILED ground, so it
  shrank exactly as Lighter's white veil grew (0.50 → 0.01) — the cover's colours were identical from 0 to +60 (and
  Darker's from −30 to −60). `coverSceneLegibility` now never goes below what the ground itself needs for that tone,
  so every step of the bar shows, still AA. The canvas also follows the thumb now (`coverShadeLook` →
  `cover-shade-preview.ts`, laid by the bridge as one style over the ground's children, taken off by the redraw), as
  the approved prototype repaints on input. Guest page: same layer, same veil over the clip and its still (reduced
  motion · Save-Data · strangers keep the shade).
- Guards: `lib/every-cover-upload-is-listed.test.ts`, `lib/the-cover-shade-reaches-every-ground.test.ts` (8 sabotages,
  all red). The Maker lab is cale-ice-shaped (one photo + one cover clip, `lab-own-media.ts`).

SPEC IMPACT: None — no ruling changes; the approved prototype's Upload strip (+ Upload · Your photo · ▶ Your video ·
12 s) and its moving Darker ↔ Lighter are what this restores. The scrim rule change is flagged for owner sign-off in
the PR.
