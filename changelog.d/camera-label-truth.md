## 2026-09-02 · fix(panood): the controller's Add-camera tile stops promising "no login" when the flag is off

`app/panood/control/[eventId]/page.tsx`'s Add-camera tile read **"scan QR · no login"**
unconditionally. Whether that's true depends on `NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED`, which is OFF
in production — `/panood/cam/[token]/page.tsx` has correctly shown a sign-in wall in that case since
Wave 4, but the controller's own label never checked the same flag. Measured 2026-09-01: the owner
scanned the QR and was sent to a sign-in wall the tile said wouldn't exist.

**Fix, label only, both states:**
- Flag ON → "scan QR · no login" (unchanged).
- Flag OFF → "scan QR · needs Setnayan sign-in".

New pure helper `cameraJoinCaption(anonEnabled: boolean)` in `lib/panood-camera-seats-pure.ts`, so the
caption is a function OF the resolved flag rather than a second, independent read of the env var that
could drift from the join page's own check. The controller page (already server-only — `headers()`,
`createClient()`, no `'use client'`) resolves the flag with the existing `panoodCameraAnonEnabled()`
import and passes the boolean in; nothing was added to any client bundle.

Did **not** flip `NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED` — turning on anonymous camera claiming is an
owner call about who can reach that surface, not this fix's job.

**Proof:** `lib/panood-camera-seats.test.ts` — `cameraJoinCaption cannot disagree with
panoodCameraAnonEnabled() across every flag spelling` drives every accepted flag spelling through
both functions and asserts the caption's "no login" claim matches the resolved flag. Mutation-tested:
sabotaging `cameraJoinCaption` to always return the no-login string turned 0 failures into 2 (this
test plus the OFF-state assertion); reverting returned 31/31 green.

**Investigated, not changed:** the task also flagged "or straight from the YouTube app" (and its two
siblings) in `go-live-card.tsx` as a possible false instruction, since YouTube's live-streaming
policy requires a channel to have at least 50 subscribers to go live from its mobile app (a desktop/
OBS stream needs no subscriber count), and the Setnayan pool channel currently has 0 subscribers per
`CLAUDE.md`. That make the "or straight from the YouTube app" instruction unusable for this channel
today. Left the copy in place per the task's instruction not to delete it on say-so alone — flagging
for the owner instead: subscriber count is DB/API state (YouTube channel stats) I can't query from
this session, so re-verify at `youtube/v3/channels?part=statistics` before deciding whether to gate
or remove that instruction.

SPEC IMPACT: None.
