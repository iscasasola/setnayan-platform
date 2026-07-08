/**
 * kit — the public surface of the shared 3D figure kit (owner-locked
 * "Sims-like" direction). Import FROM HERE, not from the internal modules:
 * call sites (plan3d-scene's tokens, the lab's SeatedAvatar/MoverToken, the
 * guest venue walk) adopt `<Figure>`/`<SeatedFigure>`/`<WalkingFigure>` in a
 * later integration stage, and this barrel is the contract that stage codes
 * against.
 *
 *   · lib/figure-rig.ts       — PURE pose math + deterministic looks (unit-tested)
 *   · kit/outfits.ts          — shared outfit shells (gown/suit/barong/filipiniana/neutral)
 *   · kit/hair.ts             — 6 procedural hairstyles from shared primitives
 *   · kit/face.ts             — drawn face decals (selfies go through GuestPhotoAvatar)
 *   · kit/figure.tsx          — the articulated rig itself
 *   · kit/active-chair.tsx    — the single real chair that replaces a detached
 *                               InstancedChairs instance during a sit clip
 *   · kit/sit-controller.tsx  — the owner-locked sit/stand choreography
 *                               (pull-back → step+turn+sit → tuck → handoff)
 *   · kit/booth-chassis.tsx   — the 9 mascot-smooth booth chassis (+ footprint
 *                               discs, sign + staff anchors)
 *   · kit/booth-props.tsx     — shared booth prop primitives (+ CanvasTextures)
 *   · kit/booth-templates.ts  — the full 57-category config table + resolution
 *                               + template-aware obstacle registration
 *   · kit/booth-template.tsx  — <BoothTemplate>: chassis + props + staff
 *                               mascots + signage, mounted via BoothMesh
 *   · kit/entrance-tunnel.tsx — evolved entrance-tunnel treatments (tunnel
 *                               catalog 2026-07-08): <ColdSparkTunnel> +
 *                               pure frame/obstacle/path-node helpers
 *   · kit/emotes.tsx          — pooled emote-bubble sprites (drawn glyph
 *                               atlas); rotation policy is the PURE
 *                               lib/emote-schedule (unit-tested)
 *   · kit/string-lights.tsx   — cinematic Play-mode string lights (Fable §3.5
 *                               Tier A): catenary strands of warm emissive
 *                               bulbs, one static InstancedMesh
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
  staffIdle,
  STAFF_IDLE_KINDS,
  type StaffIdleKind,
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

export {
  BoothChassis,
  CHASSIS_SPECS,
  type BoothChassisKind,
  type ChassisSpec,
  type StaffAnchor,
} from './booth-chassis';
export { BoothProp, BoothTextSign, type BoothPropKind } from './booth-props';
export {
  BOOTH_TEMPLATES,
  BOOTH_TEMPLATE_KEYS,
  boothTemplateFor,
  boothChassisSpec,
  boothHitVolume,
  GENERIC_BOOTH_HIT,
  templateBoothObstacles,
  type BoothHitVolume,
  type BoothTemplateSpec,
  type BoothCardKind,
  type PropPlacement,
} from './booth-templates';
export { BoothTemplate } from './booth-template';

export {
  ColdSparkTunnel,
  coldSparkFrame,
  coldSparkObstacles,
  coldSparkPathNodes,
  coldSparkProgress,
  coldSparkIntensity,
  COLD_SPARK_LENGTH_M,
  COLD_SPARK_CLIMAX_T,
  type ColdSparkFrame,
} from './entrance-tunnel';

export {
  EmoteBubbles,
  EMOTE_SEATED_Y,
  EMOTE_STANDING_Y,
  EMOTE_TABLE_Y,
  EMOTE_DANCE_Y,
  type EmoteEmitter,
  type EmoteGlyph,
} from './emotes';

export { ActiveChair, type ActiveChairProps } from './active-chair';
export {
  SitController,
  useSitController,
  SIT_TIMING,
  type SitPhase,
  type SitControllerOptions,
  type SitControllerHandles,
  type SitControllerProps,
} from './sit-controller';

export {
  StringLights,
  stringLightStrandCount,
  stringLightBulbColor,
} from './string-lights';
