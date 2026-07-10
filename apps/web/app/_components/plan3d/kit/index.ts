/**
 * kit — the public surface of the shared 3D figure kit (owner-locked one-piece
 * "blob" direction). Import FROM HERE, not from the internal modules.
 * All THREE seat-plan surfaces now render through `<Figure>`/`<SeatedFigure>`/
 * `<WalkingFigure>` — the homepage demo (plan3d-scene's tokens + Walker), the
 * couple lab (SeatedAvatar/Mover/SitController), and the public guest venue
 * walk (guest-venue-3d, Fable slice 7) — so this barrel is the codebase's ONE
 * human-figure implementation.
 *
 *   · lib/figure-rig.ts       — PURE pose math (unit-tested); look-resolution is dormant
 *   · kit/outfits.ts          — mannequin body material + booth-STAFF outfit shells
 *                               (gown/suit/barong/… — staff only; guests are faceless blobs)
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
 *
 * ⚠ kit/cinematic.tsx (Tier B postprocessing) is DELIBERATELY NOT exported
 * here: it carries the program's only new dependency (postprocessing +
 * @react-three/postprocessing) and must only ever be reached via a dynamic
 * import from a Play-mode branch, so the dep stays in its own async chunk —
 * never the main bundle, the phone-walk chunk, or SSR. Do not add it.
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
  runCyclePose,
  jellySquash,
  WALK_CLOCK_RAD_S,
  RUN_CLOCK_RAD_S,
  type JellyScale,
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

export { InstancedSeatedCrowd, type SeatedInstance } from './instanced-seated-crowd';
export {
  buildSitBakedLocals,
  seatRootMatrix,
  seatedFigureMatrix,
  instanceColorFor,
  SIT_PART_KEYS,
  type SitPartKey,
} from '@/lib/figure-sit-bake';
