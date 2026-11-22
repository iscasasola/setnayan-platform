## 2026-11-18 · fix(gifts): the gift store's two motions follow the Motion Standard, and "Added to your order" shows with reduced motion

- The row just added is highlighted by an accent ring that fades over Rise 700 (an opacity fade on a pseudo-element),
  replacing a 1.4 s box-shadow animation that repainted every frame.
- The "Added to your order" toast comes in over Move 320 on Spring and fades out over Quick 200. It replaces a 2.4 s
  ad-hoc keyframe.
- With "reduce motion" on, the toast used to be set to `opacity: 0`, so those suppliers never saw it. It now shows
  without moving, and the section takes it off the screen after 2.4 s.
- Pinned by `app/vendor-dashboard/shop/promote/_components/gift-store-motion.test.ts`.

SPEC IMPACT: None
