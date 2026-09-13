## 2026-09-02 · fix(panood): CH 1 program monitor matches the program output's fit

The controller's CH 1 monitor was rendering the same live picture as
`object-cover`, while the actual program output (`program-surface.tsx`) renders
it `object-contain` on purpose — never crop the couple's frame. A shot that
looked composed on the monitor could go out pillarboxed with black bars, and
the operator had no way to see it happening, because the one screen that
exists to show "what actually goes out" didn't.

- `app/panood/control/[eventId]/page.tsx`: the CH 1 `<ChannelVideo>` call now
  passes an explicit `object-contain` className, matching the program surface.
  The camera *tiles* (`TileSurface`'s `<ChannelVideo>` call) are untouched and
  keep the shared default `object-cover` — they're thumbnails for picking a
  shot, not for composing one.
- `app/panood/cam/[token]/_components/panood-camera-publish.tsx`: added one
  sentence to the join-screen status line telling the camera operator (a
  guest, who won't know this) to hold the phone landscape so the frame fills
  instead of letterboxing.

SPEC IMPACT: None.
