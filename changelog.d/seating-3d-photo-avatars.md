## 2026-07-03 · feat(seating-3d): shared photo-avatar component + photo faces in the 3D Plan demo

New shared `GuestPhotoAvatar` primitive (`apps/web/app/_components/plan3d/guest-avatar.tsx`)
gives every 3D seating surface instant guest recognition — a billboarded photo
disc (ringed in a status colour) where the anonymous coloured token used to be,
with an initials-token fallback when no photo is available or a load fails.

- **Module-level refcounted texture cache**: one decode per URL shared across a
  whole guest list; loads set `crossOrigin='anonymous'` + `SRGBColorSpace`;
  failed loads are cached (no retry storm) → fast initials fallback; textures are
  disposed when the last avatar releases them. Exports `preloadGuestPhotos(urls)`
  to warm visible-table photos so the first frame paints faces.
- **3D Plan demo adoption** (`plan3d-scene.tsx` + `plan3d-demo-actions.ts`):
  `Plan3DGuest` gains optional `photoUrl`; `loadPlan3DDemoScene` resolves
  `guests.photo_url` via `displayUrlForStoredAsset` (parallel-signed, mirrors the
  couple lab's resolver). `GuestToken` wears the photo disc when a photo is
  present, colored token otherwise — hover emissive + click-to-mint preserved.
  Covers both the desktop overlay and the phone route (`3d_plan/demo/[token]`),
  which share the same scene loader.
- **Lab adoption** (surgical): the couple 3D lab's `SeatedAvatar` now renders the
  photo disc via the shared component (deleting its ad-hoc per-guest
  `THREE.TextureLoader`), gaining the shared cache with no restructuring.
- **Privacy**: photo source is `guests.photo_url` ONLY — never
  `guest_face_enrollments`. Public guest venue explorer untouched (owner privacy
  decision pending). Sample event (Maria & Jose) guests are fictional; verified
  0/28 currently have `photo_url`, so the demo degrades cleanly to tokens —
  seeding sample portraits is a follow-up (owner may want AI-generated ones).

SPEC IMPACT: None — pure presentational/UX slice on the existing seat-plan data
model; no schema, pricing, or SKU change. Seat plan stays FREE, no paywall.
