# Shots · #8155 one camera for seats

Taken from `/dev/papic-camera-lab?lane=seat` on `next dev` with dummy env and Chromium's fake camera feed (the green
test pattern), through Playwright. The page renders the ONE camera (`PapicGuestCapture`) in seat mode — the same
component `/papic/seat/[token]` mounts. Next.js's own dev badge is hidden (a developer overlay, not the app).

Approved drawing: specs `prototypes/papic_camera_complete_2026-10-24_fable.html` (state 1 "Photo").
Before: the owner's iPhone screenshot of 22 Nov (Seat 150: tag and ⓘ on rows of their own, the roll under
"YOUR CREDITS", a floating "Add credits").

| File | What it shows |
|---|---|
| `seat-camera-375-light.png` | 375 px: ✕ · "Ready ⓘ" chip on top; 9:16 frame; .5/1/2× ; Photo ⇄ Snippet with the shutter ⓘ on the same row; My shots · shutter · (Tag slot) in one row. No guest-only rows. Measured: scrollHeight 812 = innerHeight 812, scrollWidth 375 = innerWidth — no scroll. |
| `seat-camera-375-dark.png` | The same in dark (the camera is dark in both themes). |
| `seat-camera-375-after-a-shot.png` | One press of the shutter: the shot is in My shots at once and the chip says "Sending 1 of 1" — the shutter is free while it sends. "Tag who's in it" appears once the shot is recorded (it cannot record here: dummy env). |
| `seat-camera-desktop.png` | 1280 px: the same camera, the frame sideways (16:9), as the guest camera draws it. |

Not shot: a recorded shot's Tag button and the "credits ran out" state need a database; covered by
`app/papic/the-camera-is-the-whole-screen.test.ts` (renders seat mode) and `lib/papic-seat-lane.test.ts`.
