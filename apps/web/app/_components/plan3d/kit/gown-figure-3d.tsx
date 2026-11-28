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
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GOWN_STRAPLESS, type GownBodyKey, type GownBodyVals, type GownConfig, type GownShapewear, type GownStockFabric } from '@/lib/gown-config';
import { createGownFrameGovernor, type GownFrameGovernor } from '@/lib/gown/frame-governor';
import { GOWN_MANNEQUIN, GOWN_SCENES, gownSkyTexture, type GownSceneId } from '@/lib/gown/scenes';
import { installGownToneMapping } from '@/lib/gown/tone';
import { GOWN_BODY_URL, parseGownBody } from '@/lib/gown/body/load';
import type { GownRig } from '@/lib/gown/body/rig';
import { solveGownBody } from '@/lib/gown/body/solve';
import { tapeLoops, type GownTapeKey } from '@/lib/gown/body/tape';
import { buildDress, emptyDress, floorOf, type GownDress } from '@/lib/gown/dress/build';
import { buildCape, emptyCape } from '@/lib/gown/dress/cape';
import { GOWN_EYELET, GOWN_LACE_UP_DRAW, buildGownClosure } from '@/lib/gown/parts/closure';
import { GOWN_CUT_MAP, buildGownCuts } from '@/lib/gown/parts/cuts';
import { buildGownTechShell } from '@/lib/gown/parts/technique';
import { GOWN_TRIM_SHADE, buildGownTrims, placeGownTrims } from '@/lib/gown/parts/trims';
import { GOWN_LACE_COLOUR, GOWN_LACE_MAP, GOWN_LACE_TILE_DRAW, GOWN_LACE_TILE_PX, buildGownLace, drawGownLaceTile } from '@/lib/gown/parts/lace';
import { gownSurfaceShader, gownSurfaceUniforms, type GownSurfaceUniforms } from '@/lib/gown/fabric/surface';
import { GOWN_WEAVE_PX, drawGownWeave, gownWeaveAmount, gownWeaveGain, gownWeaveScale } from '@/lib/gown/fabric/weave';
import { GOWN_INSIDE_LOOK, buildGownInside, gownInsideShown, type GownInsideStage } from '@/lib/gown/parts/inside';
import { GOWN_OVERLAY_DRAW, buildGownOverlay, gownOverlayOut, type GownOverlayMesh } from '@/lib/gown/parts/overlay';
import { buildGownSleeve, emptySleeve } from '@/lib/gown/parts/sleeves';
import { GOWN_JULIET_BAND, GOWN_VEIL_DRAW, buildGownVeil, emptyVeil } from '@/lib/gown/parts/veil';
import { restingCloth, writeDress } from '@/lib/gown/dress/cloth';
import { buildEnvelope, emptyEnvelope, type GownEnvelope } from '@/lib/gown/dress/table';
import { applyGownSheer, applyGownShine, gownClothColour, gownClothShader, gownSheerOpacity, tintGownSheen } from '@/lib/gown/fabric/shine';
import { GOWN_FABRIC_PROPS, gownClothFeel, gownFabricType } from '@/lib/gown/fabric/types';
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
};

let bytes: Promise<ArrayBuffer> | null = null;
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
        {rig ? <Body rig={rig} {...props} /> : null}
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
function paintSurface(cloth: SurfaceHost, rig: GownRig, design: GownConfig, kind: GownStockFabric) {
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
  const lg = maps.lace.getContext('2d'), lace = lg ? buildGownLace(rig, cloth.T, cloth.D, design, lg) : null;
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

function Body({ rig, vals, fine, shape = 'none', guides = false, turn = 0, design = null, inside = null, scene = 'studio', onSolved }: { rig: GownRig } & GownFigureProps) {
  const pivot = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: GOWN_MANNEQUIN.color, roughness: GOWN_MANNEQUIN.roughness, metalness: 0 }), []);
  // The gown: one mesh, its cloth material and the light coming through a sheer from behind.
  const cloth = useMemo(() => {
    const sheerBack = { value: 0 };
    const m = new THREE.MeshPhysicalMaterial({ color: GOWN_MANNEQUIN.color, sheen: 1, side: THREE.DoubleSide });
    // The cloth's surface first (weave, lace, cut-outs), then the sheen patch, as v195 chains them.
    const su = gownSurfaceUniforms(), surface = gownSurfaceShader(su), sheen = gownClothShader(sheerBack);
    m.onBeforeCompile = ((sh: Parameters<typeof surface>[0]) => { surface(sh); sheen(sh); }) as unknown as THREE.Material['onBeforeCompile'];
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
    mesh.frustumCulled = false;
    // The cape is cut from the gown's own fabric: the same material.
    const K = emptyCape(), cape = new THREE.Mesh(K.geo, m);
    cape.frustumCulled = false;
    // Sleeves (and the off-shoulder band) in the gown's fabric; the accent and sheer lace come with A6b.
    const sleeves = { L: new THREE.Mesh(emptySleeve(), m), R: new THREE.Mesh(emptySleeve(), m) };
    // The veil always lies over what is under it.
    const vm = new THREE.MeshPhysicalMaterial({ color: GOWN_VEIL_DRAW.colour, roughness: GOWN_VEIL_DRAW.roughness, transparent: true, opacity: GOWN_VEIL_DRAW.opacity, side: THREE.DoubleSide, depthWrite: false, sheen: 1, sheenColor: GOWN_VEIL_DRAW.colour, sheenRoughness: GOWN_VEIL_DRAW.sheenRoughness, polygonOffset: true, polygonOffsetFactor: GOWN_VEIL_DRAW.polygonOffset, polygonOffsetUnits: GOWN_VEIL_DRAW.polygonOffset });
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
    om.onBeforeCompile = gownClothShader(sheerBack) as unknown as THREE.Material['onBeforeCompile'];
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
    return { su, maps, mesh, m, sheerBack, T: emptyEnvelope(), D: emptyDress(), K, cape, sleeves, V, veil, vm, laceTile, lm, veilEdge, veilCap, bm, veilBand, closure, em, mdm, cdm, sm, om, overlay, ov: null as GownOverlayMesh | null, im, inner, extras, tm };
  }, []);
  const [frame, setFrame] = useState({ S: 1, floor: 0, top: 1.7, ver: 0, width: 0.6 });
  const [loops, setLoops] = useState<Record<GownTapeKey, number[]> | null>(null);
  const key = JSON.stringify([vals, fine, shape, design, inside]);
  useEffect(() => {
    Object.assign(rig.vals, vals);
    rig.fine = { athletic: fine.athletic, bustT: fine.bustT, given: [...fine.given] };
    rig.shape = shape;
    solveGownBody(rig);
    rig.mesh.material = mat;
    const floor = floorOf(rig);
    let width = 0.6;
    const root = rig.mesh.parent ?? rig.mesh;
    if (design) {
      // Clothes follow the body: the gown is built on the body just solved.
      const ft = gownFabricType(design.fabric), feel = gownClothFeel(ft.props, design.skirtLayers);
      cloth.D.hold = feel.hold;
      cloth.D.foldK = feel.foldK;
      buildEnvelope(rig, cloth.T);
      buildDress(rig, cloth.T, cloth.D, design, floor);
      const swing = restingCloth(), pleatAmp = design.pleatCm / 100 / rig.P.S;
      writeDress(cloth.D, cloth.T, swing, { pleat: design.pleat, n: design.pleatN, amp: pleatAmp });
      // The overlay rides the skirt as written; the cape and the veil keep outside it.
      cloth.ov = buildGownOverlay(rig, cloth.T, cloth.D, design, cloth.ov);
      const ovOut = gownOverlayOut(rig, cloth.ov ? design.overlay : 'none');
      if (cloth.ov) {
        const own = design.ovFab === 'gown' && gownFabricType(design.fabric).props.sheer <= 0.3;
        cloth.overlay.geometry = cloth.ov.geo;
        cloth.overlay.material = own ? cloth.m : cloth.om;
        if (!own) {
          const k = design.ovFab === 'gown' ? gownFabricType(design.fabric).drawAs : design.ovFab;
          cloth.om.color.setHex(gownClothColour(design.colour, design.colourHex));
          applyGownShine(cloth.om, k, GOWN_SCENES[scene].env);
          cloth.om.transparent = true;
          cloth.om.depthWrite = false;
          cloth.om.opacity = gownSheerOpacity(GOWN_FABRIC_PROPS[k], true);
        }
      }
      if (cloth.overlay.parent !== root) root.add(cloth.overlay);
      cloth.overlay.visible = !!cloth.ov;
      // Sleeves first: the cape lies over them.
      const worn: Partial<Record<'L' | 'R', ArrayLike<number>>> = {};
      const chiffon = design.sleeveFab === 'chiffon';
      if (chiffon) {
        cloth.sm.color.setHex(gownClothColour(design.colour, design.colourHex));
        applyGownShine(cloth.sm, 'chiffon', GOWN_SCENES[scene].env);
        cloth.sm.transparent = true;
        cloth.sm.depthWrite = false;
        cloth.sm.opacity = gownSheerOpacity(GOWN_FABRIC_PROPS.chiffon);
      }
      for (const sd of ['L', 'R'] as const) {
        const m = cloth.sleeves[sd], on = buildGownSleeve(rig, cloth.T, sd, design, m.geometry);
        m.material = chiffon ? cloth.sm : cloth.m;
        m.renderOrder = chiffon ? 3 : 0;
        if (on) worn[sd] = (m.geometry.attributes.position as THREE.BufferAttribute).array;
        if (m.parent !== root) root.add(m);
        m.visible = on;
      }
      // Standing on the stage; the motion step (A8) passes her pose so a floor-length cape hides while she kneels or sits.
      const hung = buildCape(rig, cloth.T, cloth.D, swing, cloth.K, design, { floorY: floor, pose: 'a', pleatAmp: design.pleat !== 'none' ? pleatAmp : 0, sleeves: worn, overlayOut: ovOut });
      if (cloth.cape.parent !== root) root.add(cloth.cape);
      cloth.cape.visible = hung;
      // The veil clears her head, the gown and the cape (v197: its length from the crown, the blusher, the lace edge, the cap).
      const v = buildGownVeil(rig, cloth.T, cloth.D, hung ? cloth.K : null, design, cloth.V, floor, ovOut);
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
      paintSurface(cloth, rig, design, ft.drawAs);
      tintGownSheen(cloth.m);
      applyGownSheer(cloth.m, ft.props, design.lining !== 'none');
      cloth.sheerBack.value = ft.props.sheer > 0.3 ? ft.props.sheer * GOWN_SCENES[scene].back : 0;
      if (cloth.mesh.parent !== root) root.add(cloth.mesh);
      cloth.mesh.visible = true;
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
          if (mat !== base) mat.color.setHex(p.colour);
          for (const g of p.geos) { const o = new THREE.Mesh(g, mat); o.frustumCulled = false; cloth.inner.add(o); }
        }
        if (cloth.inner.parent !== root) root.add(cloth.inner);
      }
    } else for (const o of [cloth.overlay, cloth.mesh, cloth.cape, cloth.sleeves.L, cloth.sleeves.R, cloth.veil, cloth.closure.cloth, cloth.closure.eyelets]) o.visible = false;
    setFrame({ S: rig.P.S, floor, top: rig.top, ver: rig.ver, width: width * rig.P.S });
    setLoops(guides ? tapeLoops(rig) : null);
    onSolved?.({ got: { bust: rig.got.bust, underbust: rig.got.underbust, waist: rig.got.waist, hips: rig.got.hips }, kg: rig.kg, vals: { ...rig.vals } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the numbers and the design; the callback is read fresh each solve
  }, [rig, key, guides, mat, cloth, scene]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(
    () => () => {
      for (const o of [cloth.overlay, cloth.mesh, cloth.cape, cloth.sleeves.L, cloth.sleeves.R, cloth.veil, cloth.veilEdge, cloth.veilCap, cloth.veilBand, cloth.closure.cloth, cloth.closure.eyelets, cloth.closure.modesty, cloth.closure.cord]) o.removeFromParent();
      for (const g of [cloth.sleeves.L.geometry, cloth.sleeves.R.geometry, cloth.V.geo, cloth.V.edge, cloth.V.cap, cloth.veilBand.geometry, cloth.closure.cloth.geometry, cloth.closure.eyelets.geometry, cloth.closure.modesty.geometry, cloth.closure.cord.geometry]) g.dispose();
      cloth.m.dispose();
      cloth.vm.dispose();
      cloth.lm.dispose();
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
      <group ref={pivot} rotation={[0, turn, 0]} position={[0, -frame.floor * frame.S, 0]} scale={frame.S}>
        <primitive object={root} />
        {loops ? <TapeGuides loops={loops} /> : null}
      </group>
      <OrbitControls enablePan={false} enableDamping minDistance={1.2} maxDistance={9} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.55} target={[0, h * 0.5, 0]} />
      <FitCamera height={h} width={frame.width} />
    </>
  );
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
