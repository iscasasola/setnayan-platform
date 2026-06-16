'use client';

/**
 * RigidWebGL — the real-time three.js scene for the rigid Save-the-Date reveals
 * (0024 addendum §1a · PR3a). Replaces the flat CSS-3D flaps with an actual 3D
 * scene: a back invitation PAPER plane, real flap MESHES (two-sided: paper front,
 * liner back), and ONE soft centre light casting renderer-computed VSM shadows —
 * so the three §1a shadow types (form shading · flap-cast-on-paper · seam
 * occlusion) fall out of geometry + light, not hand-faking.
 *
 * Driven by a single `progress` scalar (0 = sealed/flat, 1 = folded fully clear);
 * read live via a ref so palette/progress changes never tear down the GL context
 * (the veil convention). Parallax moves ONLY the light (paper + flaps locked), so
 * shadows slide for depth — honored, and off under prefers-reduced-motion.
 *
 * Colours come from the couple's Mood Board: the same `--color-cream` (paper) /
 * `--color-terracotta` (liner) CSS vars buildSitePaletteVars already overrides
 * per event, read at mount — so it recolours at ₱0, no new threading. Photoreal
 * PBR texture maps (§1a TRUE TEXTURE) slot into the same MeshStandardMaterials in
 * PR3b with zero structural change.
 *
 * Lazy-loaded via next/dynamic(ssr:false) so three.js stays code-split. On any
 * WebGL failure it calls onUnsupported() and the caller renders the CSS flaps —
 * the reveal is never gated.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadSurfaceMaps, type SurfaceMaps } from './reveal-textures';

export type RigidWebGLVariant =
  | 'four-flap'
  | 'two-flap-vertical'
  | 'two-flap-horizontal'
  | 'church-doors';

type Props = {
  variant: RigidWebGLVariant;
  /** Open amount 0..1 (from RigidStage's scroll-scrub). */
  progress: number;
  /** Called once if WebGL can't initialise → caller falls back to CSS flaps. */
  onUnsupported: () => void;
};

// LOCKED light values (§1a — owner-set DIAMETER 5 / DIFFUSION 100 / BRIGHTNESS 50).
const LIGHT_LOCK = {
  SHADOW_RADIUS: 5,
  SHADOW_BLUR_SAMPLES: 12,
  SPOT_PENUMBRA: 1.0,
  SPOT_INTENSITY: 1.4,
  HEMI_INTENSITY: 1.1,
} as const;

const Z_FLAP = 0.06; // flaps sit just in front of the paper so shadows read
const PARALLAX_RADIUS = 0.18;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Read a `--color-*` space-separated-RGB var into a THREE.Color (moodboard). */
function cssColor(probe: HTMLElement, varName: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(probe).getPropertyValue(varName).trim();
  const m = /^(\d+)\s+(\d+)\s+(\d+)$/.exec(raw);
  const c = new THREE.Color();
  if (m) c.setRGB(+m[1]! / 255, +m[2]! / 255, +m[3]! / 255, THREE.SRGBColorSpace);
  else c.set(fallback);
  return c;
}

/** One template's flaps: hinge groups + the per-progress angle for each. */
type Flap = { group: THREE.Group; axis: 'x' | 'y'; maxDeg: number; start: number; end: number };

export default function RigidWebGL({ variant, progress, onUnsupported }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let W = mount.clientWidth || window.innerWidth;
    let H = mount.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onUnsupported();
      return;
    }
    const mobile = Math.min(W, H) < 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    let cancelled = false; // guards async texture loads against unmount
    const reduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // moodboard colours (read once at mount)
    const paperCol = cssColor(mount, '--color-cream', '#f4efe6');
    const linerCol = cssColor(mount, '--color-terracotta', '#c5a059');
    const doorLiner = cssColor(mount, '--color-mulberry', '#5c2542');

    const scene = new THREE.Scene();

    // ── orthographic, head-on (flat envelope; symmetric flaps + shadows) ──
    let aspect = W / H;
    const halfH = 1;
    let halfW = halfH * aspect;
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 12);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    // Paper + flaps are built once at this half-width; on resize we rescale the
    // whole scene in x to keep the paper full-bleed + hinges on the frame edges.
    const baseHalfW = halfW;

    // ── the back invitation paper (full-bleed, always present, receives shadow) ──
    const paperMat = new THREE.MeshStandardMaterial({ color: paperCol, roughness: 0.93, metalness: 0 });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(2 * halfW, 2 * halfH), paperMat);
    paper.receiveShadow = true;
    scene.add(paper);

    // ── ONE centre light + a hemisphere fill (the locked §1a rig) ──
    const REST = new THREE.Vector3(0, 0, 2.4);
    const spot = new THREE.SpotLight(0xfff7ec, LIGHT_LOCK.SPOT_INTENSITY, 0, Math.PI / 4.5, LIGHT_LOCK.SPOT_PENUMBRA, 0);
    spot.position.copy(REST);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    spot.shadow.radius = LIGHT_LOCK.SHADOW_RADIUS;
    spot.shadow.blurSamples = LIGHT_LOCK.SHADOW_BLUR_SAMPLES;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 8;
    scene.add(spot, spot.target);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe9e2d6, LIGHT_LOCK.HEMI_INTENSITY));

    // ── flap materials. Two-sided look via two stacked DOUBLE-sided meshes (paper
    //    in front, liner offset just behind): the depth test shows paper while the
    //    flap faces the camera and the liner once it folds past upright — robust
    //    regardless of triangle winding. ──
    const frontMat = new THREE.MeshStandardMaterial({ color: paperCol, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    const linerMat = new THREE.MeshStandardMaterial({ color: linerCol, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
    const doorLinerMat = new THREE.MeshStandardMaterial({ color: doorLiner, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
    const disposables: Array<{ dispose: () => void }> = [paperMat, frontMat, linerMat, doorLinerMat, paper.geometry];

    // ── photoreal PBR maps (§1a TRUE TEXTURE · PR3b) — loaded async + recoloured
    //    from the moodboard, applied when ready so the scene upgrades from flat
    //    colour to textured. Door wood is PR3c; doors use the paper map meanwhile. ──
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const applyMaps = (mats: THREE.MeshStandardMaterial[], m: SurfaceMaps) => {
      for (const mat of mats) {
        mat.map = m.map;
        mat.normalMap = m.normalMap;
        mat.roughnessMap = m.roughnessMap;
        mat.roughness = 1; // let the roughness map drive it
        mat.needsUpdate = true;
      }
      disposables.push(m.map, m.normalMap, m.roughnessMap);
    };
    const disposeMaps = (m: SurfaceMaps | null) => {
      if (m) [m.map, m.normalMap, m.roughnessMap].forEach((t) => t.dispose());
    };
    loadSurfaceMaps('paper', paperCol, 1.6, aniso).then((m) => {
      if (cancelled) return disposeMaps(m);
      if (m) applyMaps([paperMat, frontMat], m);
    });
    loadSurfaceMaps('liner', linerCol, 2.4, aniso).then((m) => {
      if (cancelled) return disposeMaps(m);
      if (m) applyMaps([linerMat], m);
    });

    /** A two-sided flap inside a hinge group pivoted at (px,py). geom origin must
     *  put the hinge edge at (0,0). */
    function makeFlap(geom: THREE.BufferGeometry, px: number, py: number, pz: number, back: THREE.Material): THREE.Group {
      const g = new THREE.Group();
      g.position.set(px, py, pz);
      const front = new THREE.Mesh(geom, frontMat);
      front.castShadow = true;
      front.receiveShadow = true;
      const rear = new THREE.Mesh(geom, back);
      rear.position.z = -0.006; // local: liner sits just behind the paper face
      rear.castShadow = true;
      rear.receiveShadow = true;
      g.add(front, rear);
      disposables.push(geom);
      return g;
    }

    /** Rectangle whose hinge edge is at local x/y = 0. dir: which way it extends. */
    function rectGeom(w: number, h: number, originX: number, originY: number): THREE.PlaneGeometry {
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(originX, originY, 0);
      return geo;
    }

    const flaps: Flap[] = [];

    if (variant === 'two-flap-vertical') {
      const w = halfW;
      const h = 2 * halfH;
      flaps.push({ group: makeFlap(rectGeom(w, h, w / 2, 0), -halfW, 0, Z_FLAP, linerMat), axis: 'y', maxDeg: -158, start: 0, end: 0.62 });
      flaps.push({ group: makeFlap(rectGeom(w, h, -w / 2, 0), halfW, 0, Z_FLAP, linerMat), axis: 'y', maxDeg: 158, start: 0.06, end: 0.7 });
    } else if (variant === 'two-flap-horizontal') {
      const w = 2 * halfW;
      const h = halfH;
      flaps.push({ group: makeFlap(rectGeom(w, h, 0, -h / 2), 0, halfH, Z_FLAP, linerMat), axis: 'x', maxDeg: -158, start: 0, end: 0.62 });
      flaps.push({ group: makeFlap(rectGeom(w, h, 0, h / 2), 0, -halfH, Z_FLAP, linerMat), axis: 'x', maxDeg: 158, start: 0.06, end: 0.7 });
    } else if (variant === 'church-doors') {
      const door = (mirror: boolean) => {
        // arched door: rectangle + rounded top, hinge edge at local x=0.
        const w = halfW;
        const s = new THREE.Shape();
        const sgn = mirror ? -1 : 1;
        const arch = halfH * 0.5;
        s.moveTo(0, -halfH);
        s.lineTo(sgn * w, -halfH);
        s.lineTo(sgn * w, halfH - arch);
        s.quadraticCurveTo(sgn * w, halfH, 0, halfH);
        s.lineTo(0, -halfH);
        return new THREE.ShapeGeometry(s);
      };
      flaps.push({ group: makeFlap(door(false), -halfW, 0, Z_FLAP, doorLinerMat), axis: 'y', maxDeg: -138, start: 0, end: 0.72 });
      flaps.push({ group: makeFlap(door(true), halfW, 0, Z_FLAP, doorLinerMat), axis: 'y', maxDeg: 138, start: 0.04, end: 0.76 });
    } else {
      // four-flap: 4 triangles whose apex meets at centre, hinged on each edge,
      // folding back over their edge in sequence (top first), z-staggered.
      const tri = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, 0, b.x, b.y, 0, c.x, c.y, 0], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
        g.computeVertexNormals();
        return g;
      };
      const V = THREE.Vector2;
      // each triangle's verts are in HINGE-GROUP-LOCAL space (hinge edge at y=0 or x=0)
      // top (opens first), bottom, left, right — apexes meet at centre, each
      // folds back over its own edge; z-staggered so the top flap leads.
      flaps.push({ group: makeFlap(tri(new V(-halfW, 0), new V(halfW, 0), new V(0, -halfH)), 0, halfH, Z_FLAP + 0.003, linerMat), axis: 'x', maxDeg: -160, start: 0.0, end: 0.5 });
      flaps.push({ group: makeFlap(tri(new V(-halfW, 0), new V(halfW, 0), new V(0, halfH)), 0, -halfH, Z_FLAP + 0.001, linerMat), axis: 'x', maxDeg: 160, start: 0.2, end: 0.65 });
      flaps.push({ group: makeFlap(tri(new V(0, -halfH), new V(0, halfH), new V(halfW, 0)), -halfW, 0, Z_FLAP, linerMat), axis: 'y', maxDeg: -160, start: 0.3, end: 0.75 });
      flaps.push({ group: makeFlap(tri(new V(0, -halfH), new V(0, halfH), new V(-halfW, 0)), halfW, 0, Z_FLAP + 0.002, linerMat), axis: 'y', maxDeg: 160, start: 0.1, end: 0.55 });
    }

    for (const f of flaps) scene.add(f.group);

    // ── parallax: move ONLY the light (paper + flaps locked) ──
    const aim = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      if (reduced) return;
      aim.x = (e.clientX / window.innerWidth) * 2 - 1;
      aim.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (reduced) return;
      aim.x = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 35));
      aim.y = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 35));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });

    const onResize = () => {
      W = mount.clientWidth || window.innerWidth;
      H = mount.clientHeight || window.innerHeight;
      aspect = W / H;
      halfW = halfH * aspect;
      cam.left = -halfW;
      cam.right = halfW;
      cam.top = halfH;
      cam.bottom = -halfH;
      cam.updateProjectionMatrix();
      scene.scale.x = halfW / baseHalfW; // keep paper full-bleed + hinges on edges
      renderer.setSize(W, H);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const loop = () => {
      const p = progressRef.current;
      for (const f of flaps) {
        const t = THREE.MathUtils.clamp((p - f.start) / (f.end - f.start), 0, 1);
        const ang = THREE.MathUtils.degToRad(f.maxDeg) * smooth(t);
        if (f.axis === 'y') f.group.rotation.y = ang;
        else f.group.rotation.x = ang;
      }
      // best light at full open: gentle exposure bloom over the last beat
      renderer.toneMappingExposure = 1.0 + Math.max(0, p - 0.9) * 1.4;
      // ease the light toward its parallax aim; returns to dead-centre at rest
      spot.position.x += (REST.x + aim.x * PARALLAX_RADIUS - spot.position.x) * 0.08;
      spot.position.y += (REST.y + aim.y * PARALLAX_RADIUS - spot.position.y) * 0.08;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const el = renderer.domElement;
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('resize', onResize);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    // Scene rebuilds only on variant change; progress/colours are read live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  return <div ref={mountRef} className="absolute inset-0" style={{ touchAction: 'none' }} aria-hidden />;
}
