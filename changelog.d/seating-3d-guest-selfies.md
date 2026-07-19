## 2026-06-25 · feat(seating-3d): seated guests wear their selfie in the 3D lab

Owner direction ("the people will have the image of the selfies of the guests").
Seated guests in the 3D lab were plain coloured tokens; now each one wears the
guest's actual selfie/avatar as a camera-facing photo disc, ringed in their RSVP
colour (so confirmed / pending / side reads at a glance). Falls back to the
coloured head when a guest has no photo, hasn't consented, or the image can't
paint.

- **`seating/lab/page.tsx`** — resolves each guest's stored `photo_url` (an
  `r2://` ref or raw avatar URL) to a display URL via `displayUrlForStoredAsset`,
  in parallel, exactly like the 2D seating page. Threaded onto `Lab3DGuest.photoUrl`.
- **`lib/seating-3d.ts`** — `Lab3DGuest` gains `photoUrl`; `SeatToken` carries it
  through to the renderer.
- **`seating-lab-3d.tsx`** — new `useImageTexture` (manual, non-suspending loader
  with `crossOrigin='anonymous'` + graceful `onError` → null) and a `SeatedAvatar`
  component: coloured body + a drei `<Billboard>` selfie disc on top. One component
  per seated chair so the texture hook stays a stable top-level call.

Photos are consent-gated upstream (the RSVP selfie flow already requires biometric
consent; `photo_url` is null otherwise), so this surfaces only what guests opted to
share. ⚠ WebGL textures need the R2 host to send CORS headers — if the bucket isn't
CORS-configured the load fails and the avatar shows its coloured head instead (no
breakage, just no photo until CORS is set).

SPEC IMPACT: 0008 Seating — 3D avatars are selfie-bearing.
