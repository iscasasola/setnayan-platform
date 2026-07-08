## 2026-07-08 · feat(plan3d)!: avatar pivot — blank glossy mannequin figures (owner blueprint)

Owner-locked after reviewing the mascot cast in /dev/booth-lab ("yes, we will pivot everything"): the 3D Plan figure is now a **blank glossy mannequin** — minimal plump featureless bipedal silhouette, NO face, NO hair, NO modeled clothing, pure white #FFFFFF at low roughness, tintable via a flat colour (mood-board hooks kept).

- `kit/figure.tsx`: wardrobe shells / face decals / hair removed from the render path; one `mannequinMaterial` dresses torso (new plump capsule body), limbs, hip block, foot nubs, head.
- KEPT (functional): the articulated rig + walk/sit/idle clips (all shipped mechanics carry over), the selfie photo-disc head for identified guests, the status ring, staff idles at booths.
- The attire/face/hair modules and the guest attire DATA layer remain in the tree (cards, seeding, resolveGuestAttire) — un-rendered, available if a future theme re-dresses the mannequin.

SPEC IMPACT: DECISION_LOG 2026-07-08 avatar full-pivot row (supersedes the same-day mascot-smooth locks)
