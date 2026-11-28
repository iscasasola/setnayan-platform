'use client';

/**
 * 👗 The bride on the stage: the faceless mannequin solved to her numbers (lib/gown/body, prototype v186), lit by one of
 * the six scenes (lib/gown/scenes). Loaded only through `gown-view.tsx` (`next/dynamic`, ssr off), so three.js and the
 * body never reach a page that does not open the gown maker.
 *
 * Phones stay cool (owner rule): the canvas never draws on its own; one loop asks the frame governor
 * (lib/gown/frame-governor) and draws at 30 fps, 4 fps after 15 s without a touch. Only the scene table's three
 * lights, no shadow maps, a capped pixel ratio on phones, and a lost WebGL context falls back to an honest notice.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GOWN_STRAPLESS, emptyGownHand, gownCapeKind, gownCapeNow, gownSleeveIsExtra, type GownBodyKey, type GownBodyVals, type GownConfig, type GownHand, type GownShapewear, type GownStockFabric } from '@/lib/gown-config';
import { createGownFrameGovernor, type GownFrameGovernor } from '@/lib/gown/frame-governor';
import { GOWN_MANNEQUIN, GOWN_SCENES, gownSkyTexture, type GownSceneId } from '@/lib/gown/scenes';
import { installGownToneMapping } from '@/lib/gown/tone';
import { GOWN_BODY_URL, parseGownBody } from '@/lib/gown/body/load';
import type { GownRig } from '@/lib/gown/body/rig';
import { solveGownBody } from '@/lib/gown/body/solve';
import { tapeLoops, type GownTapeKey } from '@/lib/gown/body/tape';
import { buildDress, emptyDress, type GownDress } from '@/lib/gown/dress/build';
import { GOWN_CAPE_JEWEL, GOWN_CAPE_SHEER_OPACITY, buildCape, emptyCape, gownCapeShown, writeCape } from '@/lib/gown/dress/cape';
import { GOWN_EYELET, GOWN_LACE_UP_DRAW, buildGownClosure } from '@/lib/gown/parts/closure';
import { GOWN_CUT_MAP, buildGownCuts, gownCutForbidden } from '@/lib/gown/parts/cuts';
import { buildGownTechShell } from '@/lib/gown/parts/technique';
import { GOWN_ILLU_DRAW, GOWN_ILLU_MAP, GOWN_ILLU_TULLE, buildGownIllu, gownIlluDressShader, gownIlluTulleShader, gownIlluUniforms } from '@/lib/gown/parts/illusion';
import { GOWN_TRIM_SHADE, buildGownTrims, placeGownTrims } from '@/lib/gown/parts/trims';
import { GOWN_CAPE_EDGE_PX, GOWN_LACE_COLOUR, GOWN_LACE_MAP, GOWN_LACE_TILE_DRAW, GOWN_LACE_TILE_PX, buildGownLace, drawGownCapeEdge, drawGownLaceTile, type GownLaceBeadPt } from '@/lib/gown/parts/lace';
import { gownRaisedLaceShader, gownSurfaceShader, gownSurfaceUniforms, type GownSurfaceUniforms } from '@/lib/gown/fabric/surface';
import { GOWN_WEAVE_PX, drawGownWeave, gownWeaveAmount, gownWeaveGain, gownWeaveScale } from '@/lib/gown/fabric/weave';
import { GOWN_INSIDE_LOOK, buildGownInside, gownInsideShown, type GownInsideStage } from '@/lib/gown/parts/inside';
import { GOWN_OVERLAY_DRAW, buildGownOverlay, gownOverlayOut, type GownOverlayMesh } from '@/lib/gown/parts/overlay';
import { buildGownSleeve, emptySleeve } from '@/lib/gown/parts/sleeves';
import { buildGownRobeSleeve, buildGownRuffleBack, emptyRuffleBack } from '@/lib/gown/parts/sleeves-extra';
import { buildGownStraps, emptyStraps } from '@/lib/gown/parts/straps';
import { GOWN_BEAD_CAP, GOWN_BEAD_LOOK, buildGownBeads, gownBeadGeo, gownBeadHex, gownPearlHex, placeGownBeadSet, type GownBeadSet } from '@/lib/gown/parts/beads';
import { buildGownHandBeads, gownHandCutClose, type GownHandHit, type GownHandTool } from '@/lib/gown/parts/hand';
import { GOWN_FLOWER_CAP, GOWN_FLOWER_COLOURS, GOWN_FLOWER_LOOK, buildGownFlowers, buildGownPearls, emptyGownFlowers, emptyGownPearls, gownFlowerGeo, placeGownVeilPearls } from '@/lib/gown/parts/flowers';
import { VEIL_COLS } from '@/lib/gown/parts/veil-grid';
import { gownGlitterScale, gownGlitterShader, gownGlitterUniform } from '@/lib/gown/fabric/glitter';
import { GOWN_JULIET_BAND, GOWN_VEIL_DRAW, buildGownVeil, emptyVeil } from '@/lib/gown/parts/veil';
import { restingCloth, stepCloth, writeDress } from '@/lib/gown/dress/cloth';
import { GOWN_POSE_BLEND_S, GOWN_STANDING_POSES, emptyGownPose, gownClearArms, gownPoseBody, gownSetPose, type GownPoseName } from '@/lib/gown/motion/poses';
import { gownStepMotion, stillGownMotion, type GownMotionKind } from '@/lib/gown/motion/walks';
import { gownClothDrive, gownStartTwirl, gownStepTurn, gownTurning, stillGownClothDrive, stillGownTurn, type GownTurnStyle, type GownTwirlStyle } from '@/lib/gown/motion/turn';
import { buildEnvelope, czOf, emptyEnvelope, type GownEnvelope } from '@/lib/gown/dress/table';
import { applyGownSheer, applyGownShine, gownClothColour, gownClothShader, gownSheerOpacity, tintGownSheen } from '@/lib/gown/fabric/shine';
import { GOWN_FABRIC_PROPS, GOWN_GLITTER_TULLE, gownClothFeel, gownFabricType } from '@/lib/gown/fabric/types';
import { canvasDpr } from '@/lib/phone-gpu-budget';
import { ContextLostNotice, usePhoneGpu, useWebglContextLost } from '@/app/_components/plan3d/phone-gpu-budget';

/** What the stage reports after each solve: what the tape read (cm) and what the body weighs (kg). */
export type GownSolved = { got: Record<GownTapeKey, number>; kg: number; vals: GownBodyVals };

export type GownFigureProps = {
  vals: GownBodyVals;
  fine: { athletic: boolean; bustT: number; given: GownBodyKey[] };
  shape?: GownShapewear;
  scene?: GownSceneId;
  /** Show the measuring-tape guides (bust, underbust, waist, hips). */
  guides?: boolean;
  /** Turn her to this angle (radians, 0 = facing you). */
  turn?: number;
  /** The gown she wears; none = the mannequin alone (the Measurements steps). */
  design?: GownConfig | null;
  /** The Inside view (v191–v195): the step she is on, and the pieces she unticked in "See inside". Null = the gown as worn. */
  inside?: { stage: GownInsideStage | null; off: readonly string[] } | null;
  onShow2d: () => void;
  onSolved?: (s: GownSolved) => void;
  /** A7b: a hand tool is drawing on the gown. While one is picked, a finger on the cloth draws instead of turning her. */
  hand?: GownHandInput | null;
  /** A7b: her hand work, kept beside the design (never inside it). */
  handWork?: GownHand | null;
  /** A8: her pose; a change blends over 0.45 s. */
  pose?: GownPoseName;
  /** A8: a walk or the jump (stop = still, in her pose). */
  motion?: GownMotionKind | 'stop';
  /** A8: each new `n` plays one twirl in its style. */
  twirl?: { n: number; style: GownTwirlStyle } | null;
  /** A8: the auto-turn, degrees a second (0 = off), and its style. */
  autoTurn?: { speed: number; style: GownTurnStyle } | null;
};
/** Where a finger touches the gown, as the hand tools need it; `moved` = more than a tap's few pixels from where it went down. */
export type GownHandInput = { tool: GownHandTool | null; onHit: (phase: 'down' | 'move' | 'up' | 'cancel', hit: GownHandHit | null, moved: boolean, ctx: GownHandCtx) => void };
/** What the tools need from her body and this gown: cm per model unit, the no-cut rule, the scissors' closing check. */
export type GownHandCtx = { cmU: number; forbidden: (ph: number, y: number, rcm: number) => string; close: (P: [number, number][]) => { pts: [number, number][] | null; note: string } };

let bytes: Promise<ArrayBuffer> | null = null;
/** A7b: each new hand-work object is a new edit (the stage's rebuild key). */
let handEdits = 0;
/**
 * The body file is fetched once per page; each stage parses its OWN body from it (a three.js object can sit in one
 * scene only, so two stages sharing one body would leave the first one empty).
 */
function loadBody(): Promise<GownRig> {
  if (!bytes) {
    bytes = fetch(GOWN_BODY_URL).then((r) => {
      if (!r.ok) throw new Error(`gown body ${r.status}`);
      return r.arrayBuffer();
    });
    bytes.catch(() => (bytes = null));
  }
  return bytes.then((b) => parseGownBody(b.slice(0)));
}

export default function GownFigure3D(props: GownFigureProps) {
  const phone = usePhoneGpu();
  const { lost, retry, attempt, onCreated } = useWebglContextLost();
  const gov = useMemo(() => createGownFrameGovernor(phone, typeof performance === 'undefined' ? 0 : performance.now()), [phone]);
  const [rig, setRig] = useState<GownRig | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadBody().then(
      (r) => live && setRig(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);
  if (lost) return <ContextLostNotice onShow2d={props.onShow2d} onRetry={retry} />;
  if (failed) return <ContextLostNotice onShow2d={props.onShow2d} onRetry={() => { setFailed(false); loadBody().then(setRig, () => setFailed(true)); }} />;
  const wake = () => gov.touch(performance.now());
  return (
    <div style={{ width: '100%', height: '100%' }} onPointerDown={wake} onPointerMove={wake} onWheel={wake} onKeyDown={wake} data-gown-stage={rig ? 'ready' : 'loading'}>
      <Canvas
        key={attempt}
        frameloop="never"
        dpr={canvasDpr(phone, 2)}
        camera={{ position: [0, 0.9, 5], fov: 28, near: 0.05, far: 50 }}
        onCreated={(s) => {
          onCreated(s);
          s.gl.outputColorSpace = THREE.SRGBColorSpace;
          s.gl.toneMapping = installGownToneMapping() ? THREE.CustomToneMapping : THREE.NoToneMapping;
        }}
        gl={{ antialias: !phone, alpha: true, powerPreference: phone ? 'low-power' : 'default' }}
      >
        <Governor gov={gov} />
        <SceneLights scene={props.scene ?? 'studio'} />
        {rig ? <Body rig={rig} phone={phone} onBusy={wake} {...props} /> : null}
      </Canvas>
    </div>
  );
}

/** The one loop: each animation frame, the governor decides whether to draw (30 fps phone, 4 fps idle). */
function Governor({ gov }: { gov: GownFrameGovernor }) {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (gov.shouldDraw(now)) advance(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gov, advance]);
  return null;
}

/** The scene table's three lights, its exposure and its reflection (Studio: the neutral room). */
function SceneLights({ scene }: { scene: GownSceneId }) {
  const S = GOWN_SCENES[scene];
  const { gl, scene: world } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = S.exp;
    const pm = new THREE.PMREMGenerator(gl);
    const sky = gownSkyTexture(scene);
    const env = sky ? pm.fromEquirectangular(sky).texture : pm.fromScene(new RoomEnvironment(), 0.04).texture;
    sky?.dispose();
    world.environment = env;
    world.environmentIntensity = 0.12 * S.env;
    return () => {
      env.dispose();
      pm.dispose();
    };
  }, [gl, world, scene, S]);
  return (
    <>
      <hemisphereLight args={[S.sky, S.gnd, S.hemi]} />
      <directionalLight color={S.keyC} intensity={S.key} position={[...S.keyP]} />
      <directionalLight color={S.rimC} intensity={S.rim} position={[...S.rimP]} />
    </>
  );
}

type SurfaceHost = { su: GownSurfaceUniforms; maps: { weave: HTMLCanvasElement | null; lace: HTMLCanvasElement | null; cut: HTMLCanvasElement | null; tex: { weave: THREE.CanvasTexture | null; lace: THREE.CanvasTexture | null; cut: THREE.CanvasTexture | null } }; T: GownEnvelope; D: GownDress };
const canvasOf = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
/** The cloth's surface for this design: the fabric's weave, the lace and the cut-outs, painted into their maps (v195). */
/** Returns the beads sewn on the lace (A7b), sampled from the lace as painted. */
function paintSurface(cloth: SurfaceHost, rig: GownRig, design: GownConfig & Partial<GownHand>, kind: GownStockFabric): GownLaceBeadPt[] {
  const { su, maps } = cloth;
  // The weave, at thread scale; it only shades.
  maps.weave ??= canvasOf(GOWN_WEAVE_PX, GOWN_WEAVE_PX);
  const wg = maps.weave.getContext('2d');
  if (wg) {
    drawGownWeave(wg, kind);
    maps.tex.weave ??= Object.assign(new THREE.CanvasTexture(maps.weave), { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
    maps.tex.weave.needsUpdate = true;
    su.weaveMap.value = maps.tex.weave;
    const k = gownWeaveScale(kind, rig.P.S);
    su.weaveScale.value.set(k, k);
    su.weaveAmt.value = gownWeaveAmount(kind);
    su.weaveGain.value = gownWeaveGain(wg.getImageData(0, 0, GOWN_WEAVE_PX, GOWN_WEAVE_PX).data);
    su.weaveOn.value = 1;
  } else su.weaveOn.value = 0;
  // Lace on the gown's flat map.
  maps.lace ??= canvasOf(GOWN_LACE_MAP.w, GOWN_LACE_MAP.h);
  const lg = maps.lace.getContext('2d', { willReadFrequently: design.laceBeads !== 'none' });
  // Beaded lace reads the painted lace once, after it is drawn, so beads land only on the motif.
  let px: Uint8ClampedArray | null = null;
  const alphaAt = lg && design.laceBeads !== 'none' ? (x: number, y: number) => { px ??= lg.getImageData(0, 0, GOWN_LACE_MAP.w, GOWN_LACE_MAP.h).data; return px[(y * GOWN_LACE_MAP.w + x) * 4 + 3]!; } : null;
  const lace = lg ? buildGownLace(rig, cloth.T, cloth.D, design, lg, null, alphaAt) : null;
  if (lace) {
    maps.tex.lace ??= Object.assign(new THREE.CanvasTexture(maps.lace), { colorSpace: THREE.SRGBColorSpace });
    maps.tex.lace.needsUpdate = true;
    su.laceMap.value = maps.tex.lace;
    su.laceCol.value.setHex(GOWN_LACE_COLOUR[design.laceCol]);
  }
  su.laceOn.value = lace ? 1 : 0;
  // Cut-outs on the cut map round the body.
  maps.cut ??= canvasOf(GOWN_CUT_MAP, GOWN_CUT_MAP);
  const cg = maps.cut.getContext('2d'), cuts = cg ? buildGownCuts(rig, cloth.T, cloth.D, design, GOWN_STRAPLESS.includes(design.neck), cg) : null;
  if (cuts) {
    maps.tex.cut ??= Object.assign(new THREE.CanvasTexture(maps.cut), { wrapS: THREE.RepeatWrapping, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    maps.tex.cut.needsUpdate = true;
    su.cutMap.value = maps.tex.cut;
    su.cutY.value.set(cuts.y0, cuts.y1);
    su.cutBand.value.set(cuts.band[0], cuts.band[1]);
    su.cutEdge.value = cuts.edge;
    su.cutFill.value = cuts.fill;
  }
  su.cutOn.value = cuts ? 1 : 0;
  return lace?.beadPts ?? [];
}

/** Empty the Inside group: its geometries, and the per-piece materials (the shared ones stay). */
function clearInner(inner: THREE.Group, shared: Record<string, THREE.Material>) {
  const keep = new Set(Object.values(shared));
  for (const c of inner.children) {
    const o = c as THREE.Mesh;
    o.geometry.dispose();
    const m = o.material as THREE.Material;
    if (!keep.has(m)) m.dispose();
  }
  inner.clear();
}

const TAPE_ORDER: GownTapeKey[] = ['bust', 'underbust', 'waist', 'hips'];

/** A bead set's material, from its kind's look and its colour (v202 `beadMat`): no lights of its own, the scene's room reflects in it. */
function beadMaterial(set: GownBeadSet, phone: boolean): THREE.Material {
  const L = GOWN_BEAD_LOOK, c = set.kind === 'pearl' && set.col === 'clear' ? L.pearl.clear : gownBeadHex(set.col ?? 'clear');
  if (set.kind === 'crystal' && phone) return new THREE.MeshStandardMaterial({ color: c, ...L.crystalPhone, flatShading: true });
  if (set.kind === 'crystal') return new THREE.MeshPhysicalMaterial({ color: c, ...L.crystal, flatShading: true });
  if (set.kind === 'pearl') return new THREE.MeshPhysicalMaterial({ color: c, roughness: L.pearl.roughness, envMapIntensity: L.pearl.envMapIntensity, sheen: L.pearl.sheen, sheenColor: L.pearl.sheenColour, iridescence: L.pearl.iridescence, iridescenceIOR: L.pearl.iridescenceIOR });
  return new THREE.MeshStandardMaterial({ color: c, ...L[set.kind] });
}

function Body({ rig, phone = false, onBusy, vals, fine, shape = 'none', guides = false, turn = 0, design = null, inside = null, scene = 'studio', onSolved, hand = null, handWork = null, pose = 'a', motion = 'stop', twirl = null, autoTurn = null }: { rig: GownRig; phone?: boolean; onBusy?: () => void } & GownFigureProps) {
  const pivot = useRef<THREE.Group>(null);
  // A8: her pose, the walk's clock, her turn and the skirt's swing live across builds (the frame loop moves them).
  const S = useMemo(() => emptyGownPose(rig), [rig]);
  const swing = useMemo(() => restingCloth(), [rig]);
  const mo = useRef(stillGownMotion()), tn = useRef(stillGownTurn()), drive = useRef(stillGownClothDrive()), spinRot = useRef(0), bob = useRef({ x: 0, y: 0 }), floorEase = useRef<number | null>(null);
  const reduce = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  // The governor's wake-up, read fresh (the parent hands a new function each render).
  const busyRef = useRef(onBusy);
  busyRef.current = onBusy;
  const busy = () => busyRef.current?.();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: GOWN_MANNEQUIN.color, roughness: GOWN_MANNEQUIN.roughness, metalness: 0 }), []);
  // The gown: one mesh, its cloth material and the light coming through a sheer from behind.
  const cloth = useMemo(() => {
    const sheerBack = { value: 0 };
    const m = new THREE.MeshPhysicalMaterial({ color: GOWN_MANNEQUIN.color, sheen: 1, side: THREE.DoubleSide });
    // The cloth's surface first (weave, lace, cut-outs), then the sheen patch, as v195 chains them.
    const su = gownSurfaceUniforms(), surface = gownSurfaceShader(su), sheen = gownClothShader(sheerBack);
    // v198: the illusion zone and the bone channels patch the cloth after its surface (they read the cut-out block's start).
    const ilU = gownIlluUniforms<THREE.Texture>(), ilDress = gownIlluDressShader(ilU);
    ilU.ilY.value = new THREE.Vector2(0, 1) as unknown as typeof ilU.ilY.value;
    ilU.ilBoneCol.value = new THREE.Color();
    ilU.ilEdgeCol.value = new THREE.Color();
    // v200: raised lace reads the lace map as a height, after the rest.
    const raised = gownRaisedLaceShader(su);
    m.onBeforeCompile = ((sh: Parameters<typeof surface>[0]) => { surface(sh); ilDress(sh); sheen(sh); raised(sh); }) as unknown as THREE.Material['onBeforeCompile'];
    // The sheer tulle: a second mesh on the gown's own geometry, shown only inside the zone, after the gown and before the
    // sheer capes and the veil.
    const ilMat = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: GOWN_ILLU_DRAW.polygonOffsetFactor, polygonOffsetUnits: GOWN_ILLU_DRAW.polygonOffsetUnits });
    const ilTulle = gownIlluTulleShader(ilU), ilSheen = gownClothShader(sheerBack);
    ilMat.onBeforeCompile = ((sh: Parameters<typeof ilTulle>[0]) => { ilSheen(sh); ilTulle(sh); }) as unknown as THREE.Material['onBeforeCompile'];
    const ilMesh = new THREE.Mesh(new THREE.BufferGeometry(), ilMat);
    ilMesh.frustumCulled = false;
    ilMesh.renderOrder = GOWN_ILLU_DRAW.renderOrder;
    const ilMap = { canvas: null as HTMLCanvasElement | null, tex: null as THREE.CanvasTexture | null };
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
    mesh.frustumCulled = false;
    // v196 capes: one mesh, four groups: its cloth (the gown's own, or a sheer, or lace), its border, the bands and straps
    // (in the gown or accent colour), the clasps and beads.
    const K = emptyCape(), cape = new THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>(K.geo, [m, m, m, m]);
    cape.frustumCulled = false;
    const capeSheer = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
    // v200: glitter tulle is a sparkle on the sheer cloth: one uniform per material, on or off without a recompile.
    const glit = { cape: gownGlitterUniform(), overlay: gownGlitterUniform(), veil: gownGlitterUniform() };
    const withGlitter = (u: ReturnType<typeof gownGlitterUniform>, first?: (sh: Parameters<ReturnType<typeof gownGlitterShader>>[0]) => void) => {
      const g = gownGlitterShader(u);
      return ((sh: Parameters<typeof g>[0]) => { first?.(sh); g(sh); }) as unknown as THREE.Material['onBeforeCompile'];
    };
    capeSheer.onBeforeCompile = withGlitter(glit.cape, gownClothShader(sheerBack) as unknown as (sh: Parameters<ReturnType<typeof gownGlitterShader>>[0]) => void);
    const capeBand = new THREE.MeshPhysicalMaterial({ sheen: 1, side: THREE.DoubleSide });
    const capeJewel = new THREE.MeshStandardMaterial({ color: GOWN_CAPE_JEWEL.colour, metalness: GOWN_CAPE_JEWEL.metalness, roughness: GOWN_CAPE_JEWEL.roughness, envMapIntensity: GOWN_CAPE_JEWEL.envMapIntensity, flatShading: true, side: THREE.DoubleSide });
    const capeEdge = { canvas: null as HTMLCanvasElement | null, tex: null as THREE.CanvasTexture | null, key: '', mat: new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide, roughness: 0.75, depthWrite: false, alphaTest: 0.02 }) };
    // v199 straps: one mesh, two groups: the straps (the gown's own cloth, or the accent colour) and their crystals.
    const SP = emptyStraps(), strapMat = new THREE.MeshPhysicalMaterial({ sheen: 1, side: THREE.DoubleSide });
    const straps = new THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>(SP.geo, [m, capeJewel]);
    straps.frustumCulled = false;
    // v200 3D flowers: one instanced mesh (no lights of its own); scattered pearls on the neckline and the veil's edge.
    const F = emptyGownFlowers(), PR = emptyGownPearls();
    const flwMat = new THREE.MeshStandardMaterial({ roughness: GOWN_FLOWER_LOOK.roughness, metalness: GOWN_FLOWER_LOOK.metalness, envMapIntensity: GOWN_FLOWER_LOOK.envMapIntensity, vertexColors: true, side: THREE.DoubleSide });
    const flower = { type: 'rosette' as GownConfig['flowerType'], mesh: new THREE.InstancedMesh(gownFlowerGeo('rosette'), flwMat, GOWN_FLOWER_CAP.desktop) };
    flower.mesh.frustumCulled = false;
    const P = GOWN_BEAD_LOOK.pearl, pearlMat = new THREE.MeshPhysicalMaterial({ roughness: P.roughness, envMapIntensity: P.envMapIntensity, sheen: P.sheen, sheenColor: P.sheenColour, iridescence: P.iridescence, iridescenceIOR: P.iridescenceIOR });
    const pearls = { neck: new THREE.InstancedMesh(gownBeadGeo('pearl'), pearlMat, GOWN_BEAD_CAP), veil: new THREE.InstancedMesh(gownBeadGeo('pearl'), pearlMat, 2 * VEIL_COLS) };
    pearls.neck.frustumCulled = false;
    pearls.veil.frustumCulled = false;
    // A7 (v202): the bead layers, one instanced mesh a colour; the four shapes are made once.
    const beadGeos = { crystal: gownBeadGeo('crystal'), sequin: gownBeadGeo('sequin'), pearl: gownBeadGeo('pearl'), seed: gownBeadGeo('seed') };
    const beadGroup = new THREE.Group();
    // Sleeves (and the off-shoulder band) in the gown's fabric; the accent and sheer lace come with A6b.
    const sleeves = { L: new THREE.Mesh(emptySleeve(), m), R: new THREE.Mesh(emptySleeve(), m) };
    // v203: the ruffle band across the back (in the sleeves' cloth), and the over-robe's own sleeves (in the cape's).
    const ruffleBack = new THREE.Mesh(emptyRuffleBack(), m), robeSleeves = { L: new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(emptySleeve(), m), R: new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(emptySleeve(), m) };
    for (const o of [ruffleBack, robeSleeves.L, robeSleeves.R]) o.frustumCulled = false;
    // The veil always lies over what is under it.
    const vm = new THREE.MeshPhysicalMaterial({ color: GOWN_VEIL_DRAW.colour, roughness: GOWN_VEIL_DRAW.roughness, transparent: true, opacity: GOWN_VEIL_DRAW.opacity, side: THREE.DoubleSide, depthWrite: false, sheen: 1, sheenColor: GOWN_VEIL_DRAW.colour, sheenRoughness: GOWN_VEIL_DRAW.sheenRoughness, polygonOffset: true, polygonOffsetFactor: GOWN_VEIL_DRAW.polygonOffset, polygonOffsetUnits: GOWN_VEIL_DRAW.polygonOffset });
    vm.onBeforeCompile = withGlitter(glit.veil);
    const V = emptyVeil(), veil = new THREE.Mesh(V.geo, vm);
    veil.renderOrder = GOWN_VEIL_DRAW.renderOrder;
    // v197: sheer lace on tulle for the mantilla's edge and the Juliet cap, which is edged with pearls.
    const laceTile = { canvas: null as HTMLCanvasElement | null, tex: null as THREE.CanvasTexture | null, key: '' };
    const lm = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide, roughness: GOWN_LACE_TILE_DRAW.roughness, depthWrite: false });
    const veilEdge = new THREE.Mesh(V.edge, lm), veilCap = new THREE.Mesh(V.cap, lm);
    veilEdge.renderOrder = GOWN_VEIL_DRAW.edgeRenderOrder;
    veilCap.renderOrder = GOWN_JULIET_BAND.renderOrder;
    const bm = new THREE.MeshPhysicalMaterial({ color: GOWN_JULIET_BAND.colour, roughness: GOWN_JULIET_BAND.roughness, sheen: GOWN_JULIET_BAND.sheen });
    const veilBand = new THREE.Mesh(new THREE.BufferGeometry(), bm);
    for (const o of [veilEdge, veilCap, veilBand]) o.frustumCulled = false;
    // The back closure: in the gown's cloth, with metal eyelets for a lace-up.
    const em = new THREE.MeshStandardMaterial({ color: GOWN_EYELET.colour, roughness: GOWN_EYELET.roughness, metalness: GOWN_EYELET.metalness });
    // v197: the lace-up's modesty panel (a shade deeper than the gown) and its ribbon (in the accent colour).
    const mdm = new THREE.MeshStandardMaterial({ roughness: GOWN_LACE_UP_DRAW.modestyRoughness, side: THREE.DoubleSide });
    const cdm = new THREE.MeshPhysicalMaterial({ roughness: GOWN_LACE_UP_DRAW.cordRoughness, sheen: 1, sheenRoughness: GOWN_LACE_UP_DRAW.cordSheenRoughness });
    const closure = { cloth: new THREE.Mesh(new THREE.BufferGeometry(), m), eyelets: new THREE.Mesh(new THREE.BufferGeometry(), em), modesty: new THREE.Mesh(new THREE.BufferGeometry(), mdm), cord: new THREE.Mesh(new THREE.BufferGeometry(), cdm) };
    for (const o of [sleeves.L, sleeves.R, veil, closure.cloth, closure.eyelets, closure.modesty, closure.cord]) o.frustumCulled = false;
    // v195: sleeves in sheer chiffon (flutter): see-through, in the gown colour.
    const sm = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
    sm.onBeforeCompile = gownClothShader(sheerBack) as unknown as THREE.Material['onBeforeCompile'];
    // v195: the overlay, in a sheer (a little denser: it hangs free, folded) or the gown's own opaque cloth.
    const om = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, vertexColors: true });
    om.onBeforeCompile = withGlitter(glit.overlay, gownClothShader(sheerBack) as unknown as (sh: Parameters<ReturnType<typeof gownGlitterShader>>[0]) => void);
    const overlay = new THREE.Mesh(new THREE.BufferGeometry(), om);
    overlay.frustumCulled = false;
    overlay.renderOrder = GOWN_OVERLAY_DRAW.renderOrder;
    // The Inside view: one group of pieces, each kind its own material.
    const L = GOWN_INSIDE_LOOK, im = {
      layer: new THREE.MeshStandardMaterial({ roughness: L.layer.roughness, side: THREE.DoubleSide, transparent: true, opacity: L.layer.opacity, depthWrite: false }),
      crisp: new THREE.MeshStandardMaterial({ roughness: L.layer.sheerRoughness, side: THREE.DoubleSide, transparent: true, opacity: L.layer.opacity, depthWrite: false }),
      lining: new THREE.MeshStandardMaterial({ roughness: L.lining.roughness, side: THREE.DoubleSide, transparent: true, opacity: L.lining.opacity, depthWrite: false }),
      shape: new THREE.MeshStandardMaterial({ roughness: L.shape.roughness, side: THREE.DoubleSide }),
      bone: new THREE.MeshStandardMaterial({ color: L.bone.colour, roughness: L.bone.roughness }),
      hoop: new THREE.MeshStandardMaterial({ color: L.hoop.colour, roughness: L.hoop.roughness, metalness: L.hoop.metalness }),
    };
    const inner = new THREE.Group();
    // Trims and the technique layer: rebuilt with the gown, each in its own group.
    const extras = new THREE.Group();
    const tm = { trim: new THREE.MeshPhysicalMaterial({ roughness: 0.45, sheen: 1, sheenRoughness: 0.3, side: THREE.DoubleSide }), ruffle: new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide }), fringe: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 }), band: new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), seam: new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }) };
    // The surface's canvases: made once, in the browser, when first needed.
    const maps = { weave: null as HTMLCanvasElement | null, lace: null as HTMLCanvasElement | null, cut: null as HTMLCanvasElement | null, tex: { weave: null as THREE.CanvasTexture | null, lace: null as THREE.CanvasTexture | null, cut: null as THREE.CanvasTexture | null } };
    return { su, maps, mesh, m, sheerBack, ilU, ilMat, ilMesh, ilMap, T: emptyEnvelope(), D: emptyDress(), K, cape, capeSheer, capeBand, capeJewel, capeEdge, SP, straps, strapMat, glit, F, PR, flwMat, flower, pearlMat, pearls, beadGeos, beadGroup, beadSets: [] as { set: GownBeadSet; im: THREE.InstancedMesh }[], sleeves, ruffleBack, robeSleeves, V, veil, vm, laceTile, lm, veilEdge, veilCap, bm, veilBand, closure, em, mdm, cdm, sm, om, overlay, ov: null as GownOverlayMesh | null, im, inner, extras, tm };
  }, []);
  const [frame, setFrame] = useState({ S: 1, floor: 0, top: 1.7, ver: 0, width: 0.6 });
  const [loops, setLoops] = useState<Record<GownTapeKey, number[]> | null>(null);
  // Her hand work can hold thousands of pieces: it counts by edit, not by its contents.
  const handEdit = useMemo(() => ++handEdits, [handWork]);
  const key = JSON.stringify([vals, fine, shape, design, inside, handEdit]);
  /**
   * v206 `present`: pose → skin → floor → gown → arms clear → sleeves, cape, veil and the rest. `solve` re-fits her body
   * to the numbers first; `lite` (while she walks) leaves the painted lace, cut-outs and beads riding on the cloth instead
   * of rebuilding them, and moves her on the floor without re-framing the view.
   */
  const presentRef = useRef<(lite: boolean, solve: boolean) => void>(() => {});
  presentRef.current = (lite, solve) => {
    if (solve) {
      Object.assign(rig.vals, vals);
      rig.fine = { athletic: fine.athletic, bustT: fine.bustT, given: [...fine.given] };
      rig.shape = shape;
      solveGownBody(rig);
    }
    rig.mesh.material = mat;
    // Elevation only with a gown on (she is measured flat).
    const heel = design ? design.heel : 0;
    gownPoseBody(rig, S, heel);
    const floor = S.floorY, standing = GOWN_STANDING_POSES.includes(S.pose);
    let width = 0.6;
    const root = rig.mesh.parent ?? rig.mesh;
    if (design) {
      // Clothes follow the body: the gown is built on the body just posed.
      const ft = gownFabricType(design.fabric), feel = gownClothFeel(ft.props, design.skirtLayers);
      cloth.D.hold = feel.hold;
      cloth.D.foldK = feel.foldK;
      const pleatAmp = design.pleatCm / 100 / rig.P.S, dress = () => {
        buildEnvelope(rig, cloth.T);
        buildDress(rig, cloth.T, cloth.D, design, floor, S.floorStand ?? floor, { standing });
        writeDress(cloth.D, cloth.T, swing, { pleat: design.pleat, n: design.pleatN, amp: pleatAmp });
      };
      dress();
      // Her arms ease out until hand and forearm clear the cloth; a moved arm shifts the underarm, so the bodice wraps again.
      if (gownClearArms(rig, S, cloth.T, heel)) dress();
      // The overlay rides the skirt as written; the cape and the veil keep outside it.
      cloth.ov = buildGownOverlay(rig, cloth.T, cloth.D, design, cloth.ov);
      const ovOut = gownOverlayOut(rig, cloth.ov ? design.overlay : 'none');
      if (cloth.ov) {
        const own = design.ovFab === 'gown' && gownFabricType(design.fabric).props.sheer <= 0.3;
        cloth.overlay.geometry = cloth.ov.geo;
        cloth.overlay.material = own ? cloth.m : cloth.om;
        cloth.glit.overlay.value = design.ovFab === 'glitter' ? gownGlitterScale(rig.P.S) : 0;
        if (!own) {
          // v200: glitter tulle shines as tulle does, with its own sparkle.
          const glitter = design.ovFab === 'glitter', k = design.ovFab === 'gown' ? gownFabricType(design.fabric).drawAs : design.ovFab === 'glitter' ? 'tulle' : design.ovFab;
          cloth.om.color.setHex(gownClothColour(design.colour, design.colourHex));
          applyGownShine(cloth.om, k, GOWN_SCENES[scene].env);
          cloth.om.transparent = true;
          cloth.om.depthWrite = false;
          cloth.om.opacity = gownSheerOpacity(glitter ? GOWN_GLITTER_TULLE : GOWN_FABRIC_PROPS[k], true);
        }
      }
      if (cloth.overlay.parent !== root) root.add(cloth.overlay);
      cloth.overlay.visible = !!cloth.ov;
      // Sleeves first: the cape lies over them.
      const worn: Partial<Record<'L' | 'R', ArrayLike<number>>> = {};
      const chiffon = design.sleeveFab === 'chiffon';
      // v203: a full sleeve is not lined: in a sheer gown fabric her arm shows through.
      const sheerSleeve = !chiffon && design.sleeveFab === 'fabric' && gownSleeveIsExtra(design.sleeve) && design.sleeve !== 'capesl' && !design.accentFabric && !design.accentHex && ft.props.sheer > 0.3;
      if (chiffon || sheerSleeve) {
        cloth.sm.color.setHex(gownClothColour(design.colour, design.colourHex));
        applyGownShine(cloth.sm, chiffon ? 'chiffon' : ft.drawAs, GOWN_SCENES[scene].env);
        cloth.sm.transparent = true;
        cloth.sm.depthWrite = false;
        cloth.sm.opacity = gownSheerOpacity(chiffon ? GOWN_FABRIC_PROPS.chiffon : ft.props);
      }
      for (const sd of ['L', 'R'] as const) {
        const m = cloth.sleeves[sd], on = buildGownSleeve(rig, cloth.T, sd, design, m.geometry);
        m.material = chiffon || sheerSleeve ? cloth.sm : cloth.m;
        m.renderOrder = chiffon || sheerSleeve ? 3 : 0;
        if (on) worn[sd] = (m.geometry.attributes.position as THREE.BufferAttribute).array;
        if (m.parent !== root) root.add(m);
        m.visible = on;
      }
      // v203: the ruffle band joined across the back, in the sleeves' own cloth.
      const ruffle = design.sleeve === 'ruffle' && !!worn.L && !!worn.R;
      if (ruffle) {
        const g = cloth.ruffleBack.geometry;
        buildGownRuffleBack(rig, cloth.T, { L: worn.L!, R: worn.R! }, (g.attributes.position as THREE.BufferAttribute).array as Float32Array, (g.attributes.uv as THREE.BufferAttribute).array as Float32Array);
        g.attributes.position!.needsUpdate = true;
        g.attributes.uv!.needsUpdate = true;
        g.computeVertexNormals();
        g.computeBoundingSphere();
        cloth.ruffleBack.material = cloth.sleeves.L.material;
        cloth.ruffleBack.renderOrder = cloth.sleeves.L.renderOrder;
        if (cloth.ruffleBack.parent !== root) root.add(cloth.ruffleBack);
      }
      cloth.ruffleBack.visible = ruffle;
      // v203: the over-robe's own sleeves, laid over the arm and any gown sleeve; the robe then lies on them.
      const robe = gownCapeKind(design) === 'robe' && cloth.T.on && gownCapeShown(design, S.pose), robeWorn: Partial<Record<'L' | 'R', ArrayLike<number>>> = {};
      for (const sd of ['L', 'R'] as const) {
        const rm = cloth.robeSleeves[sd];
        if (robe) {
          const g = rm.geometry;
          buildGownRobeSleeve(rig, cloth.T, sd, design, worn[sd] ?? null, (g.attributes.position as THREE.BufferAttribute).array as Float32Array, (g.attributes.uv as THREE.BufferAttribute).array as Float32Array);
          g.attributes.position!.needsUpdate = true;
          g.attributes.uv!.needsUpdate = true;
          g.computeVertexNormals();
          g.computeBoundingSphere();
          robeWorn[sd] = (g.attributes.position as THREE.BufferAttribute).array;
          if (rm.parent !== root) root.add(rm);
        }
        rm.visible = robe;
      }
      // A floor-length cape hides while she kneels or sits.
      const hung = buildCape(rig, cloth.T, cloth.D, swing, cloth.K, design, { floorY: floor, pose: S.pose, pleatAmp: design.pleat !== 'none' ? pleatAmp : 0, sleeves: worn, robeSleeves: robeWorn, overlayOut: ovOut });
      if (cloth.cape.parent !== root) root.add(cloth.cape);
      cloth.cape.visible = hung;
      if (!hung) for (const sd of ['L', 'R'] as const) cloth.robeSleeves[sd].visible = false;
      if (hung) {
        // The cape's own cloth: the gown fabric (or its accent colour), or a sheer, or lace (v196 `capeMatNow`).
        const now = gownCapeNow(design), gownHex = gownClothColour(design.colour, design.colourHex), accent = design.capeCol === 'accent' && !!design.accentHex;
        const hex = accent ? parseInt(design.accentHex!.slice(1), 16) : gownHex, sheerGown = ft.props.sheer > 0.3;
        let clothMat: THREE.Material = cloth.m;
        if (now.fab === 'lace') clothMat = cloth.lm;
        else if (now.fab !== 'gown' || sheerGown || accent) {
          const cs = cloth.capeSheer;
          cs.color.setHex(hex);
          const glitter = now.fab === 'glitter';
          applyGownShine(cs, now.fab === 'gown' ? ft.drawAs : glitter ? 'tulle' : (now.fab as Exclude<typeof now.fab, 'gown' | 'lace' | 'glitter'>), GOWN_SCENES[scene].env);
          const opaque = now.fab === 'gown' && !sheerGown;
          cs.transparent = !opaque;
          cs.depthWrite = opaque;
          cs.opacity = opaque ? 1 : glitter ? gownSheerOpacity(GOWN_GLITTER_TULLE) : GOWN_CAPE_SHEER_OPACITY[now.fab] ?? gownSheerOpacity(ft.props);
          cloth.glit.cape.value = glitter ? gownGlitterScale(rig.P.S) : 0;
          clothMat = cs;
        }
        // The border: lace or appliqué from the gown's lace (Chantilly or Floral when none), in the lace colour.
        let edgeMat: THREE.Material = clothMat;
        if (now.edge === 'lace' || now.edge === 'applique') {
          const ce = cloth.capeEdge, key = `${now.edge}|${design.lace}|${design.laceCol}`;
          if (ce.key !== key) {
            const sz = GOWN_CAPE_EDGE_PX[now.edge];
            ce.canvas ??= document.createElement('canvas');
            ce.canvas.width = sz.w;
            ce.canvas.height = sz.h;
            const g = ce.canvas.getContext('2d');
            if (g) drawGownCapeEdge(g, now.edge, design.lace);
            ce.tex?.dispose();
            ce.tex = Object.assign(new THREE.CanvasTexture(ce.canvas), { colorSpace: THREE.SRGBColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });
            ce.mat.map = ce.tex;
            ce.mat.color.setHex(GOWN_LACE_COLOUR[design.laceCol]);
            ce.mat.needsUpdate = true;
            ce.key = key;
          }
          edgeMat = ce.mat;
        }
        cloth.capeBand.color.setHex(hex);
        cloth.cape.material = [clothMat, edgeMat, cloth.capeBand, cloth.capeJewel];
        // Sheer capes are drawn after the gown (and before the veil).
        cloth.cape.renderOrder = (clothMat as THREE.Material).transparent ? 4 : 0;
        // v203: the over-robe's sleeves are cut from the robe's own cloth.
        for (const sd of ['L', 'R'] as const) { cloth.robeSleeves[sd].material = clothMat; cloth.robeSleeves[sd].renderOrder = cloth.cape.renderOrder; }
      }
      // v199: the straps, laid on her after the gown and any cape. Hidden while the Inside view draws the gown see-through.
      const strapsOn = buildGownStraps(rig, cloth.T, cloth.D, design, cloth.SP);
      if (cloth.straps.parent !== root) root.add(cloth.straps);
      cloth.straps.visible = strapsOn && !inside;
      if (strapsOn) {
        const accent = design.strapCol === 'accent' && !!design.accentHex;
        if (accent) {
          cloth.strapMat.color.setHex(parseInt(design.accentHex!.slice(1), 16));
          applyGownShine(cloth.strapMat, gownFabricType(design.accentFabric ?? design.fabric).drawAs, GOWN_SCENES[scene].env);
        }
        cloth.straps.material = [accent ? cloth.strapMat : cloth.m, cloth.capeJewel];
      }
      // The veil clears her head, the gown and the cape (v197: its length from the crown, the blusher, the lace edge, the cap).
      // v200: 3D flowers and scattered pearls, after the gown, its sleeves and any cape (the veil keeps clear of them).
      {
        if (cloth.flower.type !== design.flowerType) { cloth.flower.mesh.geometry.dispose(); cloth.flower.mesh.geometry = gownFlowerGeo(design.flowerType); cloth.flower.type = design.flowerType; }
        const sl: Partial<Record<'L' | 'R', THREE.BufferGeometry>> = {};
        for (const sd of ['L', 'R'] as const) if (worn[sd]) sl[sd] = cloth.sleeves[sd].geometry;
        // Not over a cut-out: the cut map as painted (v200 reads its red channel).
        let cutAt: ((ph: number, y: number) => boolean) | null = null;
        if (cloth.su.cutOn.value > 0.5 && cloth.maps.cut && design.flowers !== 'none') {
          const px = cloth.maps.cut.getContext('2d')?.getImageData(0, 0, GOWN_CUT_MAP, GOWN_CUT_MAP).data, y0 = cloth.D.gmapY0, y1 = cloth.D.gmapY1, M = GOWN_CUT_MAP - 1;
          if (px) cutAt = (ph, y) => { const X = Math.round((ph / (2 * Math.PI) + 0.5) * M), Y = Math.round((1 - (y - y0) / (y1 - y0)) * M); return X >= 0 && Y >= 0 && X <= M && Y <= M && px[(Y * GOWN_CUT_MAP + X) * 4]! > 100; };
        }
        const on = buildGownFlowers(rig, { T: cloth.T, D: cloth.D, cape: hung ? cloth.K : null, sleeves: sl }, design, cloth.F, cloth.flower.mesh.geometry, { phone, overlay: !!cloth.ov, cutAt });
        const fm = cloth.flower.mesh;
        (fm.instanceMatrix.array as Float32Array).set(cloth.F.mats.subarray(0, cloth.F.drawn * 16));
        fm.count = cloth.F.drawn;
        fm.instanceMatrix.needsUpdate = true;
        const accent = design.flowerCol === 'accent' && !!design.accentHex;
        cloth.flwMat.color.setHex(accent ? parseInt(design.accentHex!.slice(1), 16) : design.flowerCol === 'ivory' || design.flowerCol === 'blush' ? GOWN_FLOWER_COLOURS[design.flowerCol] : gownClothColour(design.colour, design.colourHex));
        if (fm.parent !== root) root.add(fm);
        fm.visible = on && !inside;
        buildGownPearls(rig, cloth.T, cloth.D, design, cloth.PR, { phone, veil: design.veil !== 'none' });
        cloth.pearlMat.color.setHex(gownPearlHex(design));
        const pn = cloth.pearls.neck, set = cloth.PR.neck;
        pn.count = set && placeGownBeadSet(set, cloth.D, pn.instanceMatrix.array as Float32Array) ? set.n : 0;
        pn.instanceMatrix.needsUpdate = true;
        if (pn.parent !== root) root.add(pn);
        pn.visible = pn.count > 0 && !inside;
      }
      const v = buildGownVeil(rig, cloth.T, cloth.D, hung ? cloth.K : null, design, cloth.V, floor, ovOut, { overlay: cloth.overlay.visible ? cloth.ov : null, flowers: cloth.F });
      cloth.glit.veil.value = design.veilFab === 'glitter' && v.veil ? gownGlitterScale(rig.P.S) : 0;
      {
        // The veil's pearls ride the veil as it now hangs.
        const pv = cloth.pearls.veil;
        if (v.veil) placeGownVeilPearls(cloth.PR, cloth.V.geo, cloth.T);
        (pv.instanceMatrix.array as Float32Array).set(cloth.PR.veilMats.subarray(0, (v.veil ? cloth.PR.veilDrawn : 0) * 16));
        pv.count = v.veil ? cloth.PR.veilDrawn : 0;
        pv.instanceMatrix.needsUpdate = true;
        if (pv.parent !== root) root.add(pv);
        pv.visible = pv.count > 0 && !inside;
      }
      if (cloth.veil.parent !== root) root.add(cloth.veil);
      cloth.veil.visible = v.veil;
      if (v.edge || v.cap) {
        const key = `${design.lace}|${design.laceCol}`, lt = cloth.laceTile;
        if (lt.key !== key) {
          lt.canvas ??= canvasOf(GOWN_LACE_TILE_PX, GOWN_LACE_TILE_PX);
          const g = lt.canvas.getContext('2d');
          if (g) drawGownLaceTile(g, design.lace);
          lt.tex ??= Object.assign(new THREE.CanvasTexture(lt.canvas), { colorSpace: THREE.SRGBColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
          lt.tex.needsUpdate = true;
          cloth.lm.map = lt.tex;
          cloth.lm.color.setHex(GOWN_LACE_COLOUR[design.laceCol]);
          cloth.lm.needsUpdate = true;
          lt.key = key;
        }
      }
      for (const [m, on] of [[cloth.veilEdge, v.edge], [cloth.veilCap, v.cap]] as const) { if (m.parent !== root) root.add(m); m.visible = on; }
      cloth.veilBand.geometry.dispose();
      cloth.veilBand.geometry = v.cap && cloth.V.band.length > 3 ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cloth.V.band), cloth.V.band.length * 3, GOWN_JULIET_BAND.radiusCm / 100 / rig.P.S, 6, false) : new THREE.BufferGeometry();
      if (cloth.veilBand.parent !== root) root.add(cloth.veilBand);
      cloth.veilBand.visible = v.cap;
      const c = buildGownClosure(rig, cloth.T, cloth.D.L, design);
      const gownHex = gownClothColour(design.colour, design.colourHex);
      cloth.mdm.color.setHex(gownHex).multiplyScalar(GOWN_LACE_UP_DRAW.modestyShade);
      cloth.cdm.color.setHex(design.accentHex ? parseInt(design.accentHex.slice(1), 16) : gownHex);
      for (const k of ['cloth', 'eyelets', 'modesty', 'cord'] as const) {
        const m = cloth.closure[k], g = c?.[k] ?? null;
        m.geometry.dispose();
        m.geometry = g ?? new THREE.BufferGeometry();
        if (m.parent !== root) root.add(m);
        m.visible = !!g;
      }
      if (cloth.D.geo && cloth.mesh.geometry !== cloth.D.geo) cloth.mesh.geometry = cloth.D.geo;
      cloth.m.color.setHex(gownClothColour(design.colour, design.colourHex));
      applyGownShine(cloth.m, ft.drawAs, GOWN_SCENES[scene].env);
      // A7b: the design and her hand work, side by side, for the lace, the cut-outs and the beads.
      const work = { ...design, ...(handWork ?? emptyGownHand()) };
      if (lite) {
        // While she walks the painted surface rides the cloth; the beads follow it, laid where they were.
        for (const b of cloth.beadSets) placeGownBeadSet(b.set, cloth.D, b.im.instanceMatrix.array as Float32Array), (b.im.instanceMatrix.needsUpdate = true);
      } else {
      const laceBeads = paintSurface(cloth, rig, work, ft.drawAs);
      cloth.beadSets.length = 0;
      {
        // A7 (v202): every bead layer, laid again on each build (a fixed seed, so nothing reshuffles).
        for (const o of [...cloth.beadGroup.children] as THREE.InstancedMesh[]) { o.removeFromParent(); (o.material as THREE.Material).dispose(); o.dispose(); }
        // A7b: the eraser's wipes thin the layers; beads placed by hand and those sewn on the lace join them.
        const sets = [...buildGownBeads(rig, cloth.D, cloth.T, design, { phone, holes: work.handHoles }).sets, ...buildGownHandBeads(rig, cloth.D, work, laceBeads, { phone }).sets];
        for (const set of sets) {
          const im = new THREE.InstancedMesh(cloth.beadGeos[set.kind], beadMaterial(set, phone), set.n);
          im.frustumCulled = false;
          if (placeGownBeadSet(set, cloth.D, im.instanceMatrix.array as Float32Array)) { cloth.beadGroup.add(im); cloth.beadSets.push({ set, im }); }
          else { (im.material as THREE.Material).dispose(); im.dispose(); }
        }
        if (cloth.beadGroup.parent !== root) root.add(cloth.beadGroup);
        cloth.beadGroup.visible = !inside;
      }
      }
      tintGownSheen(cloth.m);
      applyGownSheer(cloth.m, ft.props, design.lining !== 'none');
      cloth.sheerBack.value = ft.props.sheer > 0.3 ? ft.props.sheer * GOWN_SCENES[scene].back : 0;
      if (cloth.mesh.parent !== root) root.add(cloth.mesh);
      cloth.mesh.visible = true;
      {
        // v198: the sheer zone, its map, the bones you can see, and the tulle on the gown's own mesh.
        const mp = cloth.ilMap;
        mp.canvas ??= Object.assign(document.createElement('canvas'), { width: GOWN_ILLU_MAP.w, height: GOWN_ILLU_MAP.h });
        mp.tex ??= Object.assign(new THREE.CanvasTexture(mp.canvas), { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
        cloth.ilU.ilMap.value = mp.tex;
        const ig = mp.canvas.getContext('2d'), il = buildGownIllu(rig, cloth.T, cloth.D, design, cloth.ilU, ig);
        if (il.zoneOn) mp.tex.needsUpdate = true;
        const gownHex = gownClothColour(design.colour, design.colourHex), tulle = design.illuCol === 'match' ? gownHex : GOWN_ILLU_TULLE[design.illuCol];
        (cloth.ilU.ilBoneCol.value as unknown as THREE.Color).setHex(gownHex).lerp(new THREE.Color(1, 1, 1), GOWN_ILLU_DRAW.boneTint);
        (cloth.ilU.ilEdgeCol.value as unknown as THREE.Color).setHex(tulle);
        cloth.ilMat.color.setHex(tulle);
        applyGownShine(cloth.ilMat, 'tulle', GOWN_SCENES[scene].env);
        cloth.ilMat.transparent = true;
        cloth.ilMat.depthWrite = false;
        cloth.ilMat.opacity = design.illuCol === 'match' ? GOWN_ILLU_DRAW.opacityMatch : GOWN_ILLU_DRAW.opacity;
        if (cloth.D.geo && cloth.ilMesh.geometry !== cloth.D.geo) cloth.ilMesh.geometry = cloth.D.geo;
        if (cloth.ilMesh.parent !== root) root.add(cloth.ilMesh);
        // Shown only with the gown (not while the Inside view draws it see-through).
        cloth.ilMesh.visible = il.zoneOn && !inside;
      }
      width = Math.max(0.6, 2 * cloth.D.hemR); // the hem's width (a train runs back, not sideways)
      // Trims along the gown's own edges, a two-piece's band, a shaped waistline's seam, a small bow in the gown's cloth,
      // and the techniques as real folds.
      for (const c of cloth.extras.children) { const o = c as THREE.Mesh; o.geometry.dispose(); }
      cloth.extras.clear();
      const colour = gownClothColour(design.colour, design.colourHex), trimCol = design.trimCol === 'custom' && design.trimHex ? parseInt(design.trimHex.slice(1), 16) : colour;
      cloth.tm.trim.color.setHex(trimCol); cloth.tm.ruffle.color.setHex(trimCol); cloth.tm.fringe.color.setHex(trimCol);
      cloth.tm.band.color.setHex(colour).multiplyScalar(GOWN_TRIM_SHADE.band); cloth.tm.seam.color.setHex(colour).multiplyScalar(GOWN_TRIM_SHADE.seam);
      const trims = buildGownTrims(rig, cloth.T, design);
      placeGownTrims(trims, rig, cloth.T, cloth.D, floor);
      for (const t of trims) {
        const o = t.kind === 'fringe' ? new THREE.LineSegments(t.geo, cloth.tm.fringe) : new THREE.Mesh(t.geo, t.kind === 'pipe' ? cloth.tm.trim : t.kind === 'bow' ? cloth.m : cloth.tm[t.kind]);
        o.frustumCulled = false;
        cloth.extras.add(o);
      }
      const tech = buildGownTechShell(rig, cloth.T, cloth.D, design);
      if (tech) { const o = new THREE.Mesh(tech.geo, cloth.m); o.frustumCulled = false; cloth.extras.add(o); }
      if (cloth.extras.parent !== root) root.add(cloth.extras);
      // Inside: the gown turns see-through and each piece inside shows by the step she is on.
      clearInner(cloth.inner, cloth.im);
      cloth.m.transparent = !!inside || cloth.m.transparent;
      cloth.m.opacity = inside ? GOWN_INSIDE_LOOK.gownOpacity : cloth.m.opacity;
      cloth.m.depthWrite = !inside;
      if (inside) {
        const off = new Set(inside.off), pieces = buildGownInside(rig, cloth.T, cloth.D, design, gownClothColour(design.colour, design.colourHex), ft.props.name);
        cloth.mesh.visible = gownInsideShown('gown', inside.stage, off);
        for (const p of pieces) {
          if (p.key === 'gown' || !gownInsideShown(p.key, inside.stage, off)) continue;
          // Layers, the lining and the shaping each wear their own colour (a copy of the kind's material); bones and hoop share theirs.
          const base = p.kind === 'layer' ? (p.crisp ? cloth.im.crisp : cloth.im.layer) : cloth.im[p.kind];
          const mat = p.kind === 'bone' || p.kind === 'hoop' ? base : base.clone();
          // v200: a glitter layer sparkles through the gown.
          if (p.layer?.type === 'glitter') { const u = { value: gownGlitterScale(rig.P.S) }; mat.onBeforeCompile = gownGlitterShader(u) as unknown as THREE.Material['onBeforeCompile']; mat.customProgramCacheKey = () => 'glit1'; }
          if (mat !== base) mat.color.setHex(p.colour);
          for (const g of p.geos) { const o = new THREE.Mesh(g, mat); o.frustumCulled = false; cloth.inner.add(o); }
        }
        if (cloth.inner.parent !== root) root.add(cloth.inner);
      }
    } else {
      // Undressed: her arms still ease clear of her body.
      buildEnvelope(rig, cloth.T);
      gownClearArms(rig, S, cloth.T, heel);
      for (const o of [cloth.overlay, cloth.mesh, cloth.cape, cloth.straps, cloth.flower.mesh, cloth.beadGroup, cloth.pearls.neck, cloth.pearls.veil, cloth.sleeves.L, cloth.sleeves.R, cloth.ruffleBack, cloth.robeSleeves.L, cloth.robeSleeves.R, cloth.veil, cloth.closure.cloth, cloth.closure.eyelets, cloth.ilMesh]) o.visible = false;
    }
    // She stands on the floor: while she moves the floor eases instead of jumping as heel and toe roll, and the view stays put.
    const g = pivot.current;
    floorEase.current = lite && floorEase.current !== null ? floorEase.current + (floor - floorEase.current) * 0.25 : floor;
    if (g) g.position.set(bob.current.x, -floorEase.current * rig.P.S + bob.current.y, 0);
    if (lite || S.t < 1) return;
    setFrame({ S: rig.P.S, floor, top: rig.top, ver: rig.ver, width: width * rig.P.S });
    setLoops(guides ? tapeLoops(rig) : null);
    onSolved?.({ got: { bust: rig.got.bust, underbust: rig.got.underbust, waist: rig.got.waist, hips: rig.got.hips }, kg: rig.kg, vals: { ...rig.vals } });
  };
  useEffect(() => {
    presentRef.current(false, true);
  }, [rig, key, guides, mat, cloth, scene]);
  // A8: a change of pose blends from where she is; a walk or the jump starts its clock; stopping blends back to her pose.
  useEffect(() => {
    const was = mo.current.kind;
    mo.current.kind = motion;
    mo.current.t = mo.current.acc = 0;
    if (motion === 'stop' && (S.pose !== pose || was !== 'stop')) { bob.current = { x: 0, y: 0 }; gownSetPose(S, pose, reduce); }
    busy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `busy` reads a ref
  }, [pose, motion, S, reduce]);
  const twN = twirl?.n ?? 0, twStyle = twirl?.style ?? 'classic';
  useEffect(() => {
    if (!twN) return;
    spinRot.current = gownStartTwirl(tn.current, twStyle, spinRot.current, performance.now(), reduce);
    busy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `busy` reads a ref
  }, [twN, twStyle, reduce]);
  const autoSpeed = autoTurn?.speed ?? 0, autoStyle = autoTurn?.style ?? 'spin';
  useEffect(() => {
    const T = tn.current;
    T.auto = autoSpeed;
    T.style = autoStyle;
    T.base = spinRot.current;
    T.ph = 0;
    T.hold = 0;
    busy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `busy` reads a ref
  }, [autoSpeed, autoStyle]);
  // A8: the frame loop. A blend rebuilds her once a frame; a walk about 24 times a second (lite); her turn drives the skirt.
  useFrame((state, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), now = performance.now();
    let moving = false;
    if (mo.current.kind !== 'stop') {
      moving = true;
      const st = gownStepMotion(mo.current, dt);
      bob.current = { x: st.x * rig.P.S, y: st.y * rig.P.S };
      if (st.rebuild) { S.pose = 'dyn'; S.dyn = st.rebuild.p; S.t = st.rebuild.ease; presentRef.current(true, false); S.t = Math.min(1, S.t); }
    } else if (S.t < 1) {
      moving = true;
      const t = Math.min(1, S.t + dt / GOWN_POSE_BLEND_S);
      S.t = t * t * (3 - 2 * t);
      presentRef.current(false, false);
      S.t = t;
    }
    const rot = gownStepTurn(tn.current, spinRot.current, dt, now);
    spinRot.current = rot;
    if (gownTurning(tn.current)) moving = true;
    const g = pivot.current;
    if (g) {
      g.rotation.y = turn + rot;
      if (mo.current.kind !== 'stop') { g.position.x = bob.current.x; g.position.y = -(floorEase.current ?? frame.floor) * rig.P.S + bob.current.y; }
    }
    // The cloth follows her turn relative to the viewer (a twirl, or dragging the view round her).
    if (design && cloth.D.geo && cloth.mesh.visible) {
      const cam = state.camera.position, d = gownClothDrive(drive.current, turn + rot - Math.atan2(cam.x, cam.z), dt, reduce), wasStill = swing.still;
      stepCloth(swing, d.w, d.alpha, dt, mo.current.vy);
      if (!(wasStill && swing.still)) {
        moving = true;
        writeDress(cloth.D, cloth.T, swing, { pleat: design.pleat, n: design.pleatN, amp: design.pleatCm / 100 / rig.P.S });
        if (cloth.cape.visible) writeCape(cloth.K, cloth.T, swing);
      }
    }
    if (moving) busy();
  });
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(
    () => () => {
      for (const o of [...cloth.beadGroup.children] as THREE.InstancedMesh[]) { (o.material as THREE.Material).dispose(); o.dispose(); }
      for (const g of Object.values(cloth.beadGeos)) g.dispose();
      for (const o of [cloth.overlay, cloth.mesh, cloth.cape, cloth.straps, cloth.flower.mesh, cloth.beadGroup, cloth.pearls.neck, cloth.pearls.veil, cloth.sleeves.L, cloth.sleeves.R, cloth.ruffleBack, cloth.robeSleeves.L, cloth.robeSleeves.R, cloth.veil, cloth.veilEdge, cloth.veilCap, cloth.veilBand, cloth.closure.cloth, cloth.closure.eyelets, cloth.closure.modesty, cloth.closure.cord]) o.removeFromParent();
      for (const g of [cloth.sleeves.L.geometry, cloth.sleeves.R.geometry, cloth.ruffleBack.geometry, cloth.robeSleeves.L.geometry, cloth.robeSleeves.R.geometry, cloth.V.geo, cloth.V.edge, cloth.V.cap, cloth.veilBand.geometry, cloth.closure.cloth.geometry, cloth.closure.eyelets.geometry, cloth.closure.modesty.geometry, cloth.closure.cord.geometry]) g.dispose();
      cloth.m.dispose();
      cloth.vm.dispose();
      cloth.lm.dispose();
      cloth.ilMat.dispose();
      cloth.ilMap.tex?.dispose();
      cloth.ilMesh.removeFromParent();
      cloth.capeSheer.dispose();
      cloth.capeBand.dispose();
      cloth.capeJewel.dispose();
      cloth.SP.geo.dispose();
      cloth.strapMat.dispose();
      cloth.flower.mesh.geometry.dispose();
      cloth.flwMat.dispose();
      cloth.pearls.neck.geometry.dispose();
      cloth.pearls.veil.geometry.dispose();
      cloth.pearlMat.dispose();
      cloth.capeEdge.mat.dispose();
      cloth.capeEdge.tex?.dispose();
      cloth.mdm.dispose();
      cloth.cdm.dispose();
      cloth.bm.dispose();
      cloth.laceTile.tex?.dispose();
      cloth.sm.dispose();
      cloth.om.dispose();
      for (const c of cloth.extras.children) (c as THREE.Mesh).geometry.dispose();
      cloth.extras.removeFromParent();
      for (const mm of Object.values(cloth.tm)) mm.dispose();
      for (const t of Object.values(cloth.maps.tex)) t?.dispose();
      clearInner(cloth.inner, cloth.im);
      cloth.inner.removeFromParent();
      for (const mm of Object.values(cloth.im)) mm.dispose();
      cloth.ov?.geo.dispose();
      cloth.em.dispose();
      cloth.D.geo?.dispose();
      cloth.K.geo.dispose();
    },
    [cloth],
  );
  const root = rig.mesh.parent ?? rig.mesh;
  const h = (frame.top - frame.floor) * frame.S;
  useEffect(() => {
    pivot.current?.updateMatrixWorld(true);
  }, [frame, turn]);
  return (
    <>
      <group ref={pivot} rotation={[0, turn + spinRot.current, 0]} position={[0, -frame.floor * frame.S, 0]} scale={frame.S}>
        <primitive object={root} />
        {loops ? <TapeGuides loops={loops} /> : null}
      </group>
      {hand?.tool ? <HandPointer mesh={cloth.mesh} T={cloth.T} hand={hand} ctx={{ cmU: rig.P.S * 100, forbidden: (ph, y, rcm) => (cloth.D.L ? gownCutForbidden(rig, cloth.T, cloth.D.L, ph, y, rcm) : ''), close: (P) => gownHandCutClose(rig, cloth.T, P, design?.cutFill ?? 'open') }} /> : null}
      {/* A hand tool picked: one finger (left button) draws; two fingers (right button) still turn her (v202). */}
      <OrbitControls
        {...(hand?.tool ? { mouseButtons: { LEFT: -1 as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }, touches: { ONE: -1 as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_ROTATE } } : {})}
        enablePan={false}
        enableDamping minDistance={1.2} maxDistance={9} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.55} target={[0, h * 0.5, 0]} />
      <FitCamera height={h} width={frame.width} />
    </>
  );
}

/**
 * A7b (v202 `hitAt`): a finger on the gown reports the spot on the cloth (direction round her, height, distance from her
 * centre line). One finger only; a second finger cancels the stroke. Nothing here edits the design.
 */
function HandPointer({ mesh, T, hand, ctx }: { mesh: THREE.Mesh; T: GownEnvelope; hand: GownHandInput; ctx: GownHandCtx }) {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const { gl, camera } = useThree();
  useEffect(() => {
    const el = gl.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), cz = czOf(T), fingers = new Set<number>();
    let down: { id: number; x: number; y: number } | null = null, moved = false;
    const hitAt = (e: PointerEvent): GownHandHit | null => {
      if (!mesh.visible || !mesh.geometry.attributes.position) return null;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      mesh.geometry.computeBoundingSphere();
      ray.setFromCamera(ndc, camera);
      const h = ray.intersectObject(mesh, false)[0];
      if (!h) return null;
      const p = mesh.worldToLocal(h.point.clone()), c = cz(Math.max(p.y, T.yF));
      return { ph: Math.atan2(p.x, p.z - c), y: p.y, r: Math.hypot(p.x, p.z - c) };
    };
    const onDown = (e: PointerEvent) => {
      fingers.add(e.pointerId);
      if (fingers.size > 1) { if (down) hand.onHit('cancel', null, moved, ctxRef.current); down = null; return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const h = hitAt(e);
      if (!h) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY };
      moved = false;
      hand.onHit('down', h, false, ctxRef.current);
    };
    const onMove = (e: PointerEvent) => {
      if (!down || down.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) moved = true;
      const h = hitAt(e);
      if (h) hand.onHit('move', h, moved, ctxRef.current);
    };
    const onUp = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (!down || down.id !== e.pointerId) return;
      down = null;
      hand.onHit(e.type === 'pointercancel' ? 'cancel' : 'up', hitAt(e), moved, ctxRef.current);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    const touch = el.style.touchAction;
    el.style.touchAction = 'none';
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.style.touchAction = touch;
    };
  }, [gl, camera, mesh, T, hand]);
  return null;
}

/** Fit her whole, head to toe, at any screen shape (v186 `frame`). */
function FitCamera({ height, width }: { height: number; width: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = THREE.MathUtils.degToRad(cam.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / Math.max(1, size.height)));
    const dist = Math.max((height * 1.12) / 2 / Math.tan(vfov / 2), (width * 1.2) / 2 / Math.tan(hfov / 2));
    cam.position.set(0, height * 0.52, dist);
    cam.lookAt(0, height * 0.5, 0);
  }, [camera, size, height, width]);
  return null;
}

function TapeGuides({ loops }: { loops: Record<GownTapeKey, number[]> }) {
  const lines = useMemo(
    () =>
      TAPE_ORDER.map((k) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(loops[k], 3));
        return { k, g };
      }),
    [loops],
  );
  useEffect(() => () => lines.forEach((l) => l.g.dispose()), [lines]);
  return (
    <>
      {lines.map(({ k, g }) => (
        <lineLoop key={k} geometry={g}>
          <lineBasicMaterial color={GOWN_MANNEQUIN.tape} depthTest={false} transparent opacity={0.9} />
        </lineLoop>
      ))}
    </>
  );
}
