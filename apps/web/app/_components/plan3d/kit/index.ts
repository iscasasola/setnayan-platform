/**
 * kit — the public surface of the shared 3D figure kit (owner-locked
 * "Sims-like" direction). Import FROM HERE, not from the internal modules:
 * call sites (plan3d-scene's tokens, the lab's SeatedAvatar/MoverToken, the
 * guest venue walk) adopt `<Figure>`/`<SeatedFigure>`/`<WalkingFigure>` in a
 * later integration stage, and this barrel is the contract that stage codes
 * against.
 *
 *   · lib/figure-rig.ts   — PURE pose math + deterministic looks (unit-tested)
 *   · kit/outfits.ts      — shared outfit shells (gown/suit/barong/filipiniana/neutral)
 *   · kit/hair.ts         — 6 procedural hairstyles from shared primitives
 *   · kit/face.ts         — drawn face decals (selfies go through GuestPhotoAvatar)
 *   · kit/figure.tsx      — the articulated rig itself
 */

export {
  Figure,
  SeatedFigure,
  WalkingFigure,
  type FigureProps,
  type FigurePoseName,
  type FigureQuality,
} from './figure';

export {
  resolveFigureLook,
  standPose,
  walkCyclePose,
  sitPose,
  idleSway,
  overlayPose,
  damp,
  JOINTS,
  SKIN_TONES,
  HAIR_COLORS,
  HAIR_STYLE_COUNT,
  FACE_VARIANT_COUNT,
  type FigureSpec,
  type FigureLook,
  type Joint,
  type Pose,
} from '@/lib/figure-rig';

export { outfitGeometry, outfitIsSkirted, outfitMaterial, type OutfitKind } from './outfits';
export { hairPartsFor, type HairPart } from './hair';
