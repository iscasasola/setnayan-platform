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
import type { GownBodyKey, GownBodyVals, GownConfig, GownShapewear } from '@/lib/gown-config';
import { createGownFrameGovernor, type GownFrameGovernor } from '@/lib/gown/frame-governor';
import { GOWN_MANNEQUIN, GOWN_SCENES, gownSkyTexture, type GownSceneId } from '@/lib/gown/scenes';
import { installGownToneMapping } from '@/lib/gown/tone';
import { GOWN_BODY_URL, parseGownBody } from '@/lib/gown/body/load';
import type { GownRig } from '@/lib/gown/body/rig';
import { solveGownBody } from '@/lib/gown/body/solve';
import { tapeLoops, type GownTapeKey } from '@/lib/gown/body/tape';
import { buildDress, emptyDress, floorOf } from '@/lib/gown/dress/build';
import { buildCape, emptyCape } from '@/lib/gown/dress/cape';
import { GOWN_EYELET, buildGownClosure } from '@/lib/gown/parts/closure';
import { GOWN_OVERLAY_DRAW, buildGownOverlay, gownOverlayOut, type GownOverlayMesh } from '@/lib/gown/parts/overlay';
import { buildGownSleeve, emptySleeve } from '@/lib/gown/parts/sleeves';
import { GOWN_VEIL_DRAW, buildGownVeil, emptyVeil } from '@/lib/gown/parts/veil';
import { restingCloth, writeDress } from '@/lib/gown/dress/cloth';
import { buildEnvelope, emptyEnvelope } from '@/lib/gown/dress/table';
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

const TAPE_ORDER: GownTapeKey[] = ['bust', 'underbust', 'waist', 'hips'];

function Body({ rig, vals, fine, shape = 'none', guides = false, turn = 0, design = null, scene = 'studio', onSolved }: { rig: GownRig } & GownFigureProps) {
  const pivot = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: GOWN_MANNEQUIN.color, roughness: GOWN_MANNEQUIN.roughness, metalness: 0 }), []);
  // The gown: one mesh, its cloth material and the light coming through a sheer from behind.
  const cloth = useMemo(() => {
    const sheerBack = { value: 0 };
    const m = new THREE.MeshPhysicalMaterial({ color: GOWN_MANNEQUIN.color, sheen: 1, side: THREE.DoubleSide });
    m.onBeforeCompile = gownClothShader(sheerBack) as unknown as THREE.Material['onBeforeCompile'];
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
    // The back closure: in the gown's cloth, with metal eyelets for a lace-up.
    const em = new THREE.MeshStandardMaterial({ color: GOWN_EYELET.colour, roughness: GOWN_EYELET.roughness, metalness: GOWN_EYELET.metalness });
    const closure = { cloth: new THREE.Mesh(new THREE.BufferGeometry(), m), eyelets: new THREE.Mesh(new THREE.BufferGeometry(), em) };
    for (const o of [sleeves.L, sleeves.R, veil, closure.cloth, closure.eyelets]) o.frustumCulled = false;
    // v195: sleeves in sheer chiffon (flutter): see-through, in the gown colour.
    const sm = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
    sm.onBeforeCompile = gownClothShader(sheerBack) as unknown as THREE.Material['onBeforeCompile'];
    // v195: the overlay, in a sheer (a little denser: it hangs free, folded) or the gown's own opaque cloth.
    const om = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, vertexColors: true });
    om.onBeforeCompile = gownClothShader(sheerBack) as unknown as THREE.Material['onBeforeCompile'];
    const overlay = new THREE.Mesh(new THREE.BufferGeometry(), om);
    overlay.frustumCulled = false;
    overlay.renderOrder = GOWN_OVERLAY_DRAW.renderOrder;
    return { mesh, m, sheerBack, T: emptyEnvelope(), D: emptyDress(), K, cape, sleeves, V, veil, vm, closure, em, sm, om, overlay, ov: null as GownOverlayMesh | null };
  }, []);
  const [frame, setFrame] = useState({ S: 1, floor: 0, top: 1.7, ver: 0, width: 0.6 });
  const [loops, setLoops] = useState<Record<GownTapeKey, number[]> | null>(null);
  const key = JSON.stringify([vals, fine, shape, design]);
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
      // The veil clears her head, the gown and the cape; the mantilla's lace border comes with the lace (A6b).
      const v = buildGownVeil(rig, cloth.T, cloth.D, hung ? cloth.K : null, design, cloth.V, floor, ovOut);
      if (cloth.veil.parent !== root) root.add(cloth.veil);
      cloth.veil.visible = v.veil;
      const c = buildGownClosure(rig, cloth.T, design.closure);
      for (const k of ['cloth', 'eyelets'] as const) {
        const m = cloth.closure[k], g = c?.[k] ?? null;
        m.geometry.dispose();
        m.geometry = g ?? new THREE.BufferGeometry();
        if (m.parent !== root) root.add(m);
        m.visible = !!g;
      }
      if (cloth.D.geo && cloth.mesh.geometry !== cloth.D.geo) cloth.mesh.geometry = cloth.D.geo;
      cloth.m.color.setHex(gownClothColour(design.colour, design.colourHex));
      applyGownShine(cloth.m, ft.drawAs, GOWN_SCENES[scene].env);
      tintGownSheen(cloth.m);
      applyGownSheer(cloth.m, ft.props, design.lining !== 'none');
      cloth.sheerBack.value = ft.props.sheer > 0.3 ? ft.props.sheer * GOWN_SCENES[scene].back : 0;
      if (cloth.mesh.parent !== root) root.add(cloth.mesh);
      cloth.mesh.visible = true;
      width = Math.max(0.6, 2 * cloth.D.hemR); // the hem's width (a train runs back, not sideways)
    } else for (const o of [cloth.overlay, cloth.mesh, cloth.cape, cloth.sleeves.L, cloth.sleeves.R, cloth.veil, cloth.closure.cloth, cloth.closure.eyelets]) o.visible = false;
    setFrame({ S: rig.P.S, floor, top: rig.top, ver: rig.ver, width: width * rig.P.S });
    setLoops(guides ? tapeLoops(rig) : null);
    onSolved?.({ got: { bust: rig.got.bust, underbust: rig.got.underbust, waist: rig.got.waist, hips: rig.got.hips }, kg: rig.kg, vals: { ...rig.vals } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the numbers and the design; the callback is read fresh each solve
  }, [rig, key, guides, mat, cloth, scene]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(
    () => () => {
      for (const o of [cloth.overlay, cloth.mesh, cloth.cape, cloth.sleeves.L, cloth.sleeves.R, cloth.veil, cloth.closure.cloth, cloth.closure.eyelets]) o.removeFromParent();
      for (const g of [cloth.sleeves.L.geometry, cloth.sleeves.R.geometry, cloth.V.geo, cloth.V.edge, cloth.closure.cloth.geometry, cloth.closure.eyelets.geometry]) g.dispose();
      cloth.m.dispose();
      cloth.vm.dispose();
      cloth.sm.dispose();
      cloth.om.dispose();
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
