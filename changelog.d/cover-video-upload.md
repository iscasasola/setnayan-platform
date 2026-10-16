## 2026-10-16 · fix(maker): the Cover Scene takes a video, and "Uploaded" means it is on the cover

**What the owner saw (cale-ice, Cover Scene › Background › Upload ◆):** he uploaded a clip three times. Each time
the uploader said "Uploaded" and nothing changed. There was no next step. Measured: the Upload accepted the video,
compressed it and uploaded it, and then `cover-words-background.tsx` ran `if (kind === 'clip') return setClipKept(true);`.
So nothing was saved, the sheet stayed open and ✓ Apply did not move. The only feedback was a grey line that was
always there. The draft held only the earlier photo ground.

**Ruling (owner 2026-10-16):** "Yes — let a cover video (15 s or less, muted) play for guests on the event's own
page. Keep it as a still on public pages strangers see (Real Stories)." Also: "remove the Framed / Full width
choice. The Cover Scene is always full screen, edge to edge", and "just for the cover scene".

- **Its own switch.** `GUEST_COVER_CLIP_PLAYBACK = true` in `lib/guest-hero-video.ts`, separate from the hero
  boomerang switch (`GUEST_HERO_VIDEO_PLAYBACK`, still `false`) and the scene-clip switch. `sanitizeHubCanvas`
  keeps a `{ kind: 'snippet', media, poster }` cover ground while the switch is open. The guest cover layer
  (`app/[slug]/_lib/cover-scene-layer.ts`) plays it through the shipped `SceneClip`: still first, muted, inline,
  looping, and never under reduced motion or Save-Data.
- **The Upload saves the clip.** Its still is grabbed and uploaded beside it (`extractPosterFrame` + `uploadStill`,
  the same pair the stage Upload uses). The clip becomes the cover's ground at once and the sheet closes on the
  Upload row with the new card ringed. A stage's Upload sheet now closes the same way (`StageBackground`
  `uploadDone`). If the switch is closed, a video is refused in place before upload, with a line saying where a
  video can go. The 15 s rule still refuses a longer clip before upload.
- **Clips are cards.** "▶ Your video" sits beside "Your photo", showing the clip's still. When there are several
  clips, each card shows its file name. The hero video is a card too. `sceneUploadRefs` now lists the cover's own
  upload, so its card survives the save's refresh and the media meter keeps counting it.
- **Apply** now holds a cover ground's media and still to the event's own media (`hub-draft-actions.ts`). Before
  this, a scene's background was checked but the cover's was not.
- **Strangers see a still.** /realstories, the editorial site and the OG routes never read `canvas.ground`. The
  cover's save never writes the hero video column. A guard pins the list of files that draw the cover layer.
- **Always full screen.** `coverGroundShape` always answers `'full'`, so a stored Framed is ignored, never migrated.
  `COVER_SCENE_FRAMED` is removed. The Cover Scene's Background tool no longer offers Width. Its photo keeps
  Still · Parallax. A scene's own Framed | Full width is unchanged.

Guards: `lib/the-cover-takes-a-video.test.ts` (new), `lib/the-cover-scene-is-one-group.test.ts` (4)(8)(10) and
`lib/background-is-four-rows.test.ts` (the cover's row 4) were updated to the new rulings.

SPEC IMPACT: DECISION_LOG rows "COVER VIDEO PLAYS ON THE EVENT'S OWN PAGE" and "THE COVER SCENE IS ALWAYS FULL
SCREEN" (2026-10-16) are recorded by the controller session. They supersede the 2026-10-15 "COVER SCENE APPROVED"
Framed | Full width and "Upload ◆ (the couple's photos)".
