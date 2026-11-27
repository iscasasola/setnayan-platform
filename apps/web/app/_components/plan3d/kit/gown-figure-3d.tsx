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
import { restingCloth, writeDress } from '@/lib/gown/dress/cloth';
import { buildEnvelope, emptyEnvelope } from '@/lib/gown/dress/table';
import { applyGownSheer, applyGownShine, gownClothColour, gownClothShader, tintGownSheen } from '@/lib/gown/fabric/shine';
import { gownClothFeel, gownFabricType } from '@/lib/gown/fabric/types';
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
    return { mesh, m, sheerBack, T: emptyEnvelope(), D: emptyDress() };
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
      writeDress(cloth.D, cloth.T, restingCloth(), { pleat: design.pleat, n: design.pleatN, amp: design.pleatCm / 100 / rig.P.S });
      if (cloth.D.geo && cloth.mesh.geometry !== cloth.D.geo) cloth.mesh.geometry = cloth.D.geo;
      cloth.m.color.setHex(gownClothColour(design.colour, design.colourHex));
      applyGownShine(cloth.m, ft.drawAs, GOWN_SCENES[scene].env);
      tintGownSheen(cloth.m);
      applyGownSheer(cloth.m, ft.props, design.lining !== 'none');
      cloth.sheerBack.value = ft.props.sheer > 0.3 ? ft.props.sheer * GOWN_SCENES[scene].back : 0;
      if (cloth.mesh.parent !== root) root.add(cloth.mesh);
      cloth.mesh.visible = true;
      width = Math.max(0.6, 2 * cloth.D.hemR); // the hem's width (a train runs back, not sideways)
    } else cloth.mesh.visible = false;
    setFrame({ S: rig.P.S, floor, top: rig.top, ver: rig.ver, width: width * rig.P.S });
    setLoops(guides ? tapeLoops(rig) : null);
    onSolved?.({ got: { bust: rig.got.bust, underbust: rig.got.underbust, waist: rig.got.waist, hips: rig.got.hips }, kg: rig.kg, vals: { ...rig.vals } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the numbers and the design; the callback is read fresh each solve
  }, [rig, key, guides, mat, cloth, scene]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(
    () => () => {
      cloth.mesh.removeFromParent();
      cloth.m.dispose();
      cloth.D.geo?.dispose();
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
