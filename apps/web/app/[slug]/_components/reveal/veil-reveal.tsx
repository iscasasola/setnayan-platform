'use client';

/**
 * VeilReveal — the trademark Setnayan bridal-veil reveal (organic family · V1
 * "sheer · multi-touch"). DESIGN-LOCKED port of the owner-approved reference
 * implementation (build `veil_lower_shakes_petals`, the 47th `show_widget`
 * tuning iteration, 2026-06-17).
 *
 *   Spec + locked settings : 0024_save_the_date/0024_Veil_Reveal_Spec_2026-06-17.md
 *   Reference prototype     : 0024_save_the_date/0024_Veil_Reveal_Prototype_2026-06-17.html
 *
 * A sheer tulle veil drapes over the invitation on a TRANSPARENT full-screen
 * canvas, simulated as a real Verlet cloth. The guest lifts it off — swipe up,
 * double-tap (hands-free), or grab-and-pull — and the fabric folds away in a
 * sim-driven trailing fold (NOT a rigid rotation) to a valance droop at the top
 * while the card reveals beneath. Once clear, `onRevealed` fires and the overlay
 * removes itself. Rose petals shower the moment the veil lifts; lowering it
 * shakes every clinging petal loose. The grab is inextensible (a hard 1.2%
 * strain clamp) so a pull holds taut instead of stretching like rubber.
 *
 * three.js is imported here (not the page bundle); this component is only ever
 * loaded via next/dynamic(ssr:false) from RevealOverlay, so three lands in a
 * code-split chunk fetched only when the reveal actually mounts.
 *
 * Couple-customizable: `veilColor` (tulle) + `petalsColor` (the white Setnayan
 * mark stays white). Everything else — physics, timing, fold, lighting, the
 * locked-settings block below — is author-time baked house default.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MARK_PATH } from './veil-shared';

type Props = {
  /** Veil tulle colour (hex), Mood-Board-driven. Ivory fallback handled by caller. */
  veilColor: string;
  /** Rose-petal colour family (hex). Blush-rose default. */
  petalsColor?: string;
  /** Fired once when the veil has been lifted clear of the invitation. */
  onRevealed: () => void;
};

// ── LOCKED SETTINGS (spec §6 · owner-tuned 2026-06-17) — baked, never couple-facing.
const TILEPX = 125; // logo gap px (large = plain veil)
const LOGOSIZE = 9; // mark size as % of the tile
const LOGOOP = 22; // mark opacity (subtle white)
const FOLDS = 16; // bloom fold count
const WEIGHT = 26; // gravity
const BOUNCE = 83; // settle damping (low = lively)
const LIFTPK = 70; // hold forward peak
const STRETCH = 15; // soft strain envelope (the hard 1.2% clamp dominates)
const HOLD = 22; // tap-pinch radius
const WIND = 48; // hem-weighted sway
const VAL = 30; // top-valance % (the visible fold droop)
const TRAIL = 100; // fold follow softness (loose/laggy)
const FLOAT = 100; // keeps the fold high during reveal
const FULL = 100; // fold depth at the hem
const LENGTH = 10; // hem reaches ~5–10% from the bottom
const PETALS = 100; // petal density
const TEX = 1024; // texture resolution
const AUTO_DUR = 5.0; // auto-reveal (feather) seconds

type PP = {
  type: string;
  swayPh: number;
  swayF: number;
  grav: number;
  drag: number;
  sway: number;
  sx: number;
  sy: number;
  sz: number;
  size: number;
  ox: number;
  oy: number;
};
type GrabState = {
  cluster: Array<{ k: number; ox: number; oy: number }>;
  cx: number;
  cy: number;
  lastY: number;
  t0: number;
  cx0: number;
  cy0: number;
};

export default function VeilReveal({ veilColor, petalsColor, onRevealed }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef(veilColor);
  colorRef.current = veilColor;
  const petalColorRef = useRef(petalsColor);
  petalColorRef.current = petalsColor;
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;
  const revealedRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL → reveal silently (never gate the guest).
      onRevealedRef.current();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const cv = renderer.domElement;
    cv.style.display = 'block';
    cv.style.width = '100%';
    cv.style.height = '100%';
    cv.style.touchAction = 'none';
    mount.appendChild(cv);

    const scene = new THREE.Scene();
    const camZ = 4.4;
    const fov = 45;
    const frontZ = 0.6;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
    camera.position.set(0, 0, camZ);
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x1c1610, 0.55));
    const key = new THREE.SpotLight(0xfff3e0, 2.2, 40, Math.PI / 5, 0.7, 1.0);
    key.position.set(2.8, 3.6, 4.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff0d8, 0.5);
    rim.position.set(-3, 0.4, 2.0);
    scene.add(rim);

    let W = 0;
    let H = 0;
    let vh = 0;
    let vw = 0;

    const ss = (a: number, b: number, x: number) => {
      x = (x - a) / (b - a);
      return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
    };
    const rnd = () => Math.random();

    // ── Veil texture: faint tulle weave + ONE sparse white Setnayan mark, fixed-px tiled.
    let markReady = false;
    const markImg = new Image();
    const cvs = () => {
      const c = document.createElement('canvas');
      c.width = c.height = TEX;
      return c;
    };
    const veilAlpha = () => {
      const S = TEX;
      const aC = cvs();
      const a = aC.getContext('2d')!;
      a.fillStyle = '#242424';
      a.fillRect(0, 0, S, S);
      a.strokeStyle = 'rgba(255,255,255,0.055)';
      a.lineWidth = 2;
      for (let d = -S; d < S * 2; d += 12) {
        a.beginPath();
        a.moveTo(d, 0);
        a.lineTo(d + S, S);
        a.stroke();
        a.beginPath();
        a.moveTo(d, S);
        a.lineTo(d + S, 0);
        a.stroke();
      }
      if (markReady) {
        const ms = S * (LOGOSIZE / 100);
        a.globalAlpha = Math.min(1, (LOGOOP / 100) * 1.3);
        a.drawImage(markImg, S * 0.5 - ms / 2, S * 0.5 - ms / 2, ms, ms);
        a.globalAlpha = 1;
      }
      const tx = new THREE.CanvasTexture(aC);
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.anisotropy = 8;
      return tx;
    };

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorRef.current || '#f3ece1'),
      roughness: 0.82,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    // Fresnel sheen — whiter + more opaque where the fabric folds away.
    mat.onBeforeCompile = (sh: { vertexShader: string; fragmentShader: string }) => {
      sh.vertexShader =
        'varying vec3 vWP;varying vec3 vNN;\n' +
        sh.vertexShader.replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;vNN=normalize(mat3(modelMatrix)*objectNormal);',
        );
      sh.fragmentShader =
        'varying vec3 vWP;varying vec3 vNN;\n' +
        sh.fragmentShader.replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\nvec3 V=normalize(cameraPosition-vWP);float fr=pow(1.0-abs(dot(V,normalize(vNN))),1.8);gl_FragColor.rgb+=fr*0.6;gl_FragColor.a=clamp(gl_FragColor.a+fr*0.45,0.0,1.0);',
        );
    };
    mat.alphaMap = veilAlpha();

    markImg.onload = () => {
      markReady = true;
      rebuildTex();
    };
    markImg.src =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5333.3335 5333.3335" width="480" height="480"><path d="' +
          MARK_PATH +
          '" fill="#ffffff" fill-rule="nonzero" transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"/></svg>',
      );

    // ── Cloth grid (Verlet) — pinned along the flat crown; folds bloom to the hem.
    const cols = 66;
    const rows = 50;
    const N = cols * rows;
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const pz = new Float32Array(N);
    const qx = new Float32Array(N);
    const qy = new Float32Array(N);
    const qz = new Float32Array(N);
    const pinX = new Float32Array(cols);
    const rowDx = new Float32Array(rows);
    let PINW = 0;
    const idx = (ix: number, iy: number) => iy * cols + ix;
    let clothW = 0;
    let clothH = 0;
    let topPin = 0;
    let dx = 0;
    let dy = 0;
    let cons: number[][] = [];
    let geo: THREE.PlaneGeometry = null!;
    let posAttr: THREE.BufferAttribute = null!;

    let lift = 0;
    let liftTarget = 0;
    let t = 0;
    let settling = false;
    let locked = false;
    let auto = false;
    let autoT = 0;
    let featherFrames = 0;
    let shakeFrames = 0;

    const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    veil.renderOrder = 1;
    scene.add(veil);

    // ── Rose petals (InstancedMesh, one draw call) — 4 mixed behaviours.
    const petalTexture = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      // Near-white luminance gradient so per-instance colour drives the hue.
      const grad = x.createLinearGradient(64, 8, 64, 122);
      grad.addColorStop(0, 'rgba(255,250,251,0.96)');
      grad.addColorStop(1, 'rgba(232,216,222,0.92)');
      x.fillStyle = grad;
      x.beginPath();
      x.moveTo(64, 120);
      x.bezierCurveTo(8, 92, 16, 26, 64, 9);
      x.bezierCurveTo(112, 26, 120, 92, 64, 120);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(150,120,130,0.3)';
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(64, 114);
      x.lineTo(64, 22);
      x.stroke();
      return new THREE.CanvasTexture(c);
    };
    const _hsl = { h: 0, s: 0, l: 0 };
    const petalColor = () => {
      const c = new THREE.Color();
      const base = petalColorRef.current;
      if (base) {
        try {
          new THREE.Color(base).getHSL(_hsl, THREE.SRGBColorSpace);
          c.setHSL(
            (_hsl.h + (rnd() - 0.5) * 0.03 + 1) % 1,
            Math.min(1, Math.max(0, _hsl.s + (rnd() - 0.5) * 0.25)),
            Math.min(0.92, Math.max(0.4, _hsl.l + (rnd() - 0.35) * 0.22)),
          );
          return c;
        } catch {
          /* fall through to default rose */
        }
      }
      c.setHSL(0.93 + rnd() * 0.07, 0.45 + rnd() * 0.35, 0.62 + rnd() * 0.18);
      return c;
    };
    const ptex = petalTexture();
    const pmat = new THREE.MeshStandardMaterial({
      map: ptex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0,
    });
    const NP = 100;
    const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), pmat, NP);
    petals.renderOrder = 2;
    petals.frustumCulled = false;
    scene.add(petals);
    const pPos: THREE.Vector3[] = [];
    const pVel: THREE.Vector3[] = [];
    const pRot: THREE.Euler[] = [];
    const pPar: PP[] = [];
    const pCling = new Int32Array(NP);
    const pdum = new THREE.Object3D();
    let colDirty = true;
    let petalsSeeded = false;
    for (let pi = 0; pi < NP; pi++) {
      pPos[pi] = new THREE.Vector3();
      pVel[pi] = new THREE.Vector3();
      pRot[pi] = new THREE.Euler();
      pPar[pi] = {} as PP;
      pCling[pi] = -1;
    }
    const petalParams = (P: PP, ty: string) => {
      P.type = ty;
      P.swayPh = rnd() * 6.28;
      P.swayF = 0.5 + rnd() * 0.9;
      if (ty === 'feather') {
        P.grav = -1.4;
        P.drag = 0.972;
        P.sway = 0.5;
        P.sx = 0.5 + rnd() * 0.6;
        P.sy = 0.22;
        P.sz = 0.3;
      } else if (ty === 'rotate') {
        P.grav = -2.7;
        P.drag = 0.987;
        P.sway = 0.16;
        P.sx = 0.3;
        P.sy = 2.4 + rnd() * 2.6;
        P.sz = 3 + rnd() * 3.5;
      } else {
        P.grav = -3.6;
        P.drag = 0.992;
        P.sway = 0.07;
        P.sx = 0.1;
        P.sy = 0.12;
        P.sz = 0.5 + rnd() * 1.2;
      }
    };
    const spawnFalling = (i: number) => {
      const P = pPar[i]!;
      const r = rnd();
      const ty = r < 0.4 ? 'feather' : r < 0.72 ? 'rotate' : 'straight';
      petalParams(P, ty);
      P.size = vh * (0.04 + rnd() * 0.04);
      P.ox = 0;
      P.oy = 0;
      pPos[i]!.set((rnd() * 2 - 1) * vw * 1.2, vh * (1.05 + rnd() * 0.7), frontZ + (rnd() * 2 - 1) * 0.55);
      pVel[i]!.set((rnd() * 2 - 1) * 0.05, -(0.05 + rnd() * 0.08), 0);
      pRot[i]!.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      pCling[i] = -1;
      petals.setColorAt(i, petalColor());
      colDirty = true;
    };
    const spawnCling = (i: number) => {
      const P = pPar[i]!;
      petalParams(P, 'cling');
      const iy = Math.floor(rows * (0.28 + rnd() * 0.5));
      const ix = Math.floor(rnd() * cols);
      pCling[i] = idx(ix, iy);
      P.ox = (rnd() * 2 - 1) * 0.05;
      P.oy = (rnd() * 2 - 1) * 0.05;
      P.size = vh * (0.035 + rnd() * 0.03);
      pRot[i]!.set(rnd() * 6.28, rnd() * 6.28, (rnd() * 2 - 1) * 0.5);
      petals.setColorAt(i, petalColor());
      colDirty = true;
    };
    const initPetals = () => {
      for (let i = 0; i < NP; i++) {
        if (rnd() < 0.32) spawnCling(i);
        else {
          spawnFalling(i);
          pPos[i]!.y = (rnd() * 2 - 1) * vh * 1.4;
        }
      }
    };
    const parkAll = () => {
      pdum.scale.set(0, 0, 0);
      pdum.position.set(0, 0, -99);
      pdum.updateMatrix();
      for (let i = 0; i < NP; i++) petals.setMatrixAt(i, pdum.matrix);
      petals.instanceMatrix.needsUpdate = true;
    };
    const bouncePetal = (i: number, wx: number, wy: number) => {
      pCling[i] = -1;
      const P = pPar[i]!;
      petalParams(P, 'feather');
      const ax = pPos[i]!.x - wx;
      const ay = pPos[i]!.y - wy;
      const m = Math.hypot(ax, ay) || 1;
      pVel[i]!.set((ax / m) * 0.7 + (rnd() * 2 - 1) * 0.15, 0.45 + rnd() * 0.4, (rnd() * 2 - 1) * 0.35);
      P.sx = 2.5 + rnd() * 3;
      P.sy = 2.5 + rnd() * 3;
      P.sz = 2.5 + rnd() * 3;
    };
    const bounceAt = (cx: number, cy: number) => {
      const tr = cv.getBoundingClientRect();
      const aN = Math.round((NP * PETALS) / 100);
      let best = -1;
      let bd = 38 * 38;
      for (let i = 0; i < aN; i++) {
        const vv = pPos[i]!.clone().project(camera);
        if (vv.z > 1) continue;
        const sx = tr.left + (vv.x * 0.5 + 0.5) * tr.width;
        const sy = tr.top + (-vv.y * 0.5 + 0.5) * tr.height;
        const d = (sx - cx) * (sx - cx) + (sy - cy) * (sy - cy);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best >= 0) {
        const w = planeWorld(cx, cy, pPos[best]!.z);
        bouncePetal(best, w ? w.x : pPos[best]!.x, w ? w.y : pPos[best]!.y);
        return true;
      }
      return false;
    };
    const updatePetals = (dt: number, shaking: boolean) => {
      const aN = Math.round((NP * PETALS) / 100);
      for (let i = 0; i < NP; i++) {
        const P = pPar[i]!;
        if (i >= aN) {
          pdum.scale.set(0, 0, 0);
          pdum.position.set(0, 0, -99);
          pdum.updateMatrix();
          petals.setMatrixAt(i, pdum.matrix);
          continue;
        }
        if (pCling[i]! >= 0) {
          const k = pCling[i]!;
          pPos[i]!.set(px[k]! + P.ox, py[k]! + P.oy, pz[k]! + 0.02);
          const sp = Math.hypot(px[k]! - qx[k]!, py[k]! - qy[k]!, pz[k]! - qz[k]!);
          if (sp > 0.045 || (shaking && (sp > 0.012 || rnd() < 0.2))) {
            pCling[i] = -1;
            petalParams(P, 'feather');
            pVel[i]!.set((rnd() * 2 - 1) * 0.2, -0.05 - rnd() * 0.18, (rnd() * 2 - 1) * 0.15);
          }
        } else {
          pVel[i]!.y += P.grav * dt;
          pVel[i]!.x *= P.drag;
          pVel[i]!.y *= P.drag;
          pPos[i]!.x += pVel[i]!.x * dt + P.sway * Math.sin(t * P.swayF + P.swayPh) * dt;
          pPos[i]!.y += pVel[i]!.y * dt;
          pPos[i]!.z += pVel[i]!.z * dt;
          pRot[i]!.x += P.sx * dt;
          pRot[i]!.y += P.sy * dt;
          pRot[i]!.z += P.sz * dt;
          if (pPos[i]!.y < -vh * 1.45) {
            if (rnd() < 0.3) spawnCling(i);
            else spawnFalling(i);
          }
        }
        pdum.position.copy(pPos[i]!);
        pdum.rotation.copy(pRot[i]!);
        pdum.scale.set(P.size, P.size, P.size);
        pdum.updateMatrix();
        petals.setMatrixAt(i, pdum.matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
      if (colDirty && petals.instanceColor) {
        petals.instanceColor.needsUpdate = true;
        colDirty = false;
      }
    };

    const maxStrain = () => 0.004 + (STRETCH / 100) * 0.12;
    const setRepeat = () => {
      if (!clothW) return;
      const facW = clothW / (2 * vw);
      const facH = clothH / (2 * vh);
      if (mat.alphaMap) mat.alphaMap.repeat.set((facW * W) / TILEPX, (facH * H) / TILEPX);
    };
    const rebuildTex = () => {
      const old = mat.alphaMap;
      mat.alphaMap = veilAlpha();
      setRepeat();
      mat.needsUpdate = true;
      if (old) old.dispose();
    };
    const envOf = (rf: number) => 0.16 + 0.84 * Math.pow(rf, 1.5);
    const buildCloth = () => {
      topPin = vh * 1.06;
      clothH = vh * (2.12 - LENGTH / 47);
      const pinW = 2 * vw * 1.2;
      PINW = pinW;
      const extra = 0.04 + (FULL / 100) * 0.4;
      dx = pinW / (cols - 1);
      dy = clothH / (rows - 1);
      for (let ix = 0; ix < cols; ix++) {
        const fx = ix / (cols - 1);
        pinX[ix] = -pinW / 2 + fx * pinW;
      }
      for (let iy = 0; iy < rows; iy++) {
        const rf = iy / (rows - 1);
        rowDx[iy] = (pinW * (1 + extra * envOf(rf))) / (cols - 1);
      }
      cons = [];
      for (let iy3 = 0; iy3 < rows; iy3++)
        for (let ix3 = 0; ix3 < cols; ix3++) {
          if (ix3 < cols - 1) cons.push([idx(ix3, iy3), idx(ix3 + 1, iy3), rowDx[iy3]!]);
          if (iy3 < rows - 1) cons.push([idx(ix3, iy3), idx(ix3, iy3 + 1), dy]);
          if (ix3 < cols - 1 && iy3 < rows - 1)
            cons.push([idx(ix3, iy3), idx(ix3 + 1, iy3 + 1), Math.hypot(rowDx[iy3]!, dy)]);
        }
      if (geo) geo.dispose();
      geo = new THREE.PlaneGeometry(pinW, clothH, cols - 1, rows - 1);
      veil.geometry = geo;
      posAttr = geo.attributes.position as THREE.BufferAttribute;
      clothW = pinW;
    };
    const seedPose = (extend: number) => {
      const pinW = PINW;
      for (let iy = 0; iy < rows; iy++)
        for (let ix = 0; ix < cols; ix++) {
          const k = idx(ix, iy);
          const fx = ix / (cols - 1);
          const rf = iy / (rows - 1);
          const Xf = -pinW / 2 + fx * pinW;
          if (iy === 0) {
            px[k] = Xf;
            py[k] = topPin;
            pz[k] = frontZ;
          } else {
            px[k] = Xf;
            py[k] = topPin - iy * dy * extend;
            pz[k] = frontZ + (FULL / 100) * 0.26 * envOf(rf) * Math.sin(fx * 6.2832 * FOLDS);
          }
          qx[k] = px[k]!;
          qy[k] = py[k]!;
          qz[k] = pz[k]!;
        }
      lift = 0;
      liftTarget = 0;
      locked = false;
      auto = false;
      featherFrames = 0;
    };
    const presettle = (n: number) => {
      settling = true;
      for (let s = 0; s < n; s++) step(1 / 60);
      settling = false;
    };
    const applyView = () => {
      W = cv.clientWidth || 300;
      H = cv.clientHeight || 650;
      if (W < 2 || H < 2) return;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      vh = (camZ - frontZ) * Math.tan((fov * Math.PI) / 360);
      vw = vh * (W / H);
      buildCloth();
      setRepeat();
      seedPose(1.0);
      presettle(120);
    };

    const ray = new THREE.Raycaster();
    const gplane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -frontZ);
    const hitv = new THREE.Vector3();
    const grabs: Record<string, GrabState> = {};
    const ndc = (cx: number, cy: number) => {
      const r = cv.getBoundingClientRect();
      return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    };
    const meshHit = (cx: number, cy: number) => {
      ray.setFromCamera(ndc(cx, cy), camera);
      geo.boundingSphere = null;
      geo.boundingBox = null;
      const h = ray.intersectObject(veil, false);
      return h.length ? h[0]!.point : null;
    };
    const planeWorld = (cx: number, cy: number, z: number) => {
      ray.setFromCamera(ndc(cx, cy), camera);
      gplane.constant = -z;
      return ray.ray.intersectPlane(gplane, hitv) ? { x: hitv.x, y: hitv.y } : null;
    };
    const pinchZ = () => frontZ + (LIFTPK / 100) * 0.9;

    function step(dt: number) {
      t += dt;
      const fth = featherFrames > 0;
      const le = ss(0, 0.7, lift);
      const drag = 0.952 + (BOUNCE / 100) * 0.03 + (fth ? 0.012 : 0);
      const g = -(2.5 + (WEIGHT / 100) * 7) * (fth ? 0.5 : 1) * (1 - (FLOAT / 100) * 0.92 * le);
      const pz0 = pinchZ();
      const BUNCH = 0.3;
      const wind = settling ? 0 : (WIND / 100) * 5;
      for (let k = 0; k < N; k++) {
        if (k < cols) {
          px[k] = pinX[k]!;
          py[k] = topPin + 0.005 * Math.sin(t * 0.7 + k * 0.3);
          pz[k] = frontZ;
          qx[k] = px[k]!;
          qy[k] = py[k]!;
          qz[k] = pz[k]!;
          continue;
        }
        const ix = k % cols;
        const iy = (k / cols) | 0;
        const rf = iy / (rows - 1);
        const we = rf * rf * (0.35 + 0.65 * rf);
        const aw = wind * we * (Math.sin(t * 0.6 + iy * 0.24 + ix * 0.13) + 0.35 * Math.sin(t * 1.1 + ix * 0.3));
        const az = wind * 0.55 * we * Math.cos(t * 0.5 + ix * 0.12 + iy * 0.1);
        const nx = px[k]! + (px[k]! - qx[k]!) * drag + aw * dt * dt;
        const ny = py[k]! + (py[k]! - qy[k]!) * drag + g * dt * dt;
        const nz = pz[k]! + (pz[k]! - qz[k]!) * drag + az * dt * dt;
        qx[k] = px[k]!;
        qy[k] = py[k]!;
        qz[k] = pz[k]!;
        px[k] = nx;
        py[k] = ny;
        pz[k] = nz;
      }
      // Reveal fold — hem pulled up past the top edge, two-end-led, the cloth trails.
      if (lift > 0.015) {
        const pull0 = (0.05 + (TRAIL / 100) * 0.32) * ss(0.02, 0.42, lift);
        const clothHvh = clothH / vh;
        const hemUp = Math.max(0.2, clothHvh - 4 * (VAL / 100));
        const hy = topPin + vh * hemUp * ss(0.02, 1, lift);
        const hz = frontZ - 0.25;
        for (let ix2 = 0; ix2 < cols; ix2++) {
          const fx = ix2 / (cols - 1);
          const endW = Math.max(0, 1 - Math.min(fx, 1 - fx) / 0.3);
          const w = pull0 * (0.3 + 0.7 * endW);
          const vk = idx(ix2, rows - 1);
          px[vk] = px[vk]! + ((pinX[ix2]! - px[vk]!) * w * 0.4);
          py[vk] = py[vk]! + ((hy - py[vk]!) * w);
          pz[vk] = pz[vk]! + ((hz - pz[vk]!) * w);
        }
      }
      const gl = Object.keys(grabs);
      const maxS = maxStrain();
      const COMP = 0.16;
      const TENB = 0.42;
      for (let it = 0; it < 6; it++) {
        for (let gi = 0; gi < gl.length; gi++) {
          const gg = grabs[gl[gi]!]!;
          const cl = gg.cluster;
          for (let ci = 0; ci < cl.length; ci++) {
            const kk = cl[ci]!.k;
            if (kk < cols) continue;
            const tx = gg.cx + cl[ci]!.ox * BUNCH;
            const ty = gg.cy + cl[ci]!.oy * BUNCH;
            px[kk] = px[kk]! + ((tx - px[kk]!) * 0.4);
            py[kk] = py[kk]! + ((ty - py[kk]!) * 0.4);
            pz[kk] = pz[kk]! + ((pz0 - pz[kk]!) * 0.32);
          }
        }
        for (let c = 0; c < cons.length; c++) {
          const A = cons[c]![0]!;
          const B = cons[c]![1]!;
          const rest = cons[c]![2]!;
          const ex = px[B]! - px[A]!;
          const ey = py[B]! - py[A]!;
          const ez = pz[B]! - pz[A]!;
          const dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4;
          const diff = dd - rest;
          const strain = diff / rest;
          const stiff = strain <= 0 ? COMP : TENB + (1 - TENB) * Math.min(1, strain / maxS);
          const f = (diff / dd) * stiff * 0.5;
          const ox = ex * f;
          const oy = ey * f;
          const oz = ez * f;
          if (A >= cols) {
            px[A] = px[A]! + (ox);
            py[A] = py[A]! + (oy);
            pz[A] = pz[A]! + (oz);
          }
          if (B >= cols) {
            px[B] = px[B]! - (ox);
            py[B] = py[B]! - (oy);
            pz[B] = pz[B]! - (oz);
          }
        }
      }
      // Hard strain clamp (the "no rubber" rule) — cap every edge to rest·1.012.
      const CL = 1.012;
      for (let sit = 0; sit < 4; sit++) {
        for (let c2 = 0; c2 < cons.length; c2++) {
          const A2 = cons[c2]![0]!;
          const B2 = cons[c2]![1]!;
          const lim = cons[c2]![2]! * CL;
          const ex2 = px[B2]! - px[A2]!;
          const ey2 = py[B2]! - py[A2]!;
          const ez2 = pz[B2]! - pz[A2]!;
          const dd2 = Math.sqrt(ex2 * ex2 + ey2 * ey2 + ez2 * ez2) || 1e-4;
          if (dd2 > lim) {
            const f2 = ((dd2 - lim) / dd2) * 0.5;
            const ox2 = ex2 * f2;
            const oy2 = ey2 * f2;
            const oz2 = ez2 * f2;
            if (A2 >= cols) {
              px[A2] = px[A2]! + (ox2);
              py[A2] = py[A2]! + (oy2);
              pz[A2] = pz[A2]! + (oz2);
            }
            if (B2 >= cols) {
              px[B2] = px[B2]! - (ox2);
              py[B2] = py[B2]! - (oy2);
              pz[B2] = pz[B2]! - (oz2);
            }
          }
        }
      }
    }

    const startAuto = () => {
      auto = true;
      autoT = 0;
      locked = true;
    };
    const doRevealAuto = () => {
      if (locked) {
        locked = false;
        auto = false;
        liftTarget = 0;
      } else {
        startAuto();
      }
    };
    const setLift = (v: number) => {
      auto = false;
      liftTarget = v;
      locked = v > 0.3;
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (auto) {
        autoT += dt / AUTO_DUR;
        const p = Math.min(1, autoT);
        liftTarget = ss(0.05, 0.95, p);
        if (p > 0.3) featherFrames = Math.round(AUTO_DUR * 34);
        if (autoT >= 1) {
          auto = false;
          liftTarget = 1;
        }
      }
      if (featherFrames > 0) featherFrames--;
      const pl = lift;
      lift += (liftTarget - lift) * 0.05;
      if (lift < pl - 0.0008) shakeFrames = 18;
      if (shakeFrames > 0) shakeFrames--;
      mat.color.set(colorRef.current || '#f3ece1');
      step(1 / 60);
      const zc = camZ - 0.7;
      for (let k = 0; k < N; k++) posAttr.setXYZ(k, px[k]!, py[k]!, Math.min(zc, pz[k]!));
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
      // Petals begin the moment the veil first lifts — none on the covered veil.
      if (!petalsSeeded && lift > 0.1) {
        initPetals();
        petalsSeeded = true;
      }
      if (petalsSeeded) updatePetals(Math.min(0.033, dt), shakeFrames > 0);
      renderer.render(scene, camera);
      if (lift > 0.985 && !revealedRef.current) {
        revealedRef.current = true;
        onRevealedRef.current();
      }
      raf = requestAnimationFrame(loop);
    };

    // ── Gestures: grab-and-pull (local hold) · swipe up = reveal · swipe down =
    // re-cover · double-tap = hands-free auto · tap = bat a petal away.
    let lastTap = 0;
    const onDown = (e: PointerEvent) => {
      const hp = meshHit(e.clientX, e.clientY);
      grabs[e.pointerId] = {
        cluster: [],
        cx: 0,
        cy: 0,
        lastY: 0,
        t0: performance.now(),
        cx0: e.clientX,
        cy0: e.clientY,
      };
      if (hp) {
        const hx = hp.x;
        const hy = hp.y;
        const R = 0.018 + (HOLD / 100) * 0.1;
        const R2 = R * R;
        const cl: Array<{ k: number; ox: number; oy: number }> = [];
        for (let k = cols; k < N; k++) {
          const ddx = px[k]! - hx;
          const ddy = py[k]! - hy;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < R2) cl.push({ k, ox: ddx, oy: ddy });
        }
        if (!cl.length) {
          let nb = cols;
          let bd = 1e9;
          for (let k2 = cols; k2 < N; k2++) {
            const a = px[k2]! - hx;
            const b = py[k2]! - hy;
            const dd2 = a * a + b * b;
            if (dd2 < bd) {
              bd = dd2;
              nb = k2;
            }
          }
          cl.push({ k: nb, ox: 0, oy: 0 });
        }
        grabs[e.pointerId]!.cluster = cl;
        grabs[e.pointerId]!.cx = hx;
        grabs[e.pointerId]!.cy = hy;
        grabs[e.pointerId]!.lastY = hy;
      }
      cv.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const g = grabs[e.pointerId];
      if (!g || !g.cluster.length) return;
      const w = planeWorld(e.clientX, e.clientY, pinchZ());
      if (!w) return;
      g.lastY = w.y;
      g.cx = w.x;
      g.cy = w.y;
    };
    const release = (e: PointerEvent) => {
      const g = grabs[e.pointerId];
      if (g) {
        const dur = performance.now() - g.t0;
        const dxC = e.clientX - g.cx0;
        const dyC = e.clientY - g.cy0;
        const up = -dyC;
        const net = Math.hypot(dxC, dyC);
        delete grabs[e.pointerId];
        if (up > 40 && dur < 460 && up > Math.abs(dxC) * 1.0) {
          setLift(1);
          return;
        }
        if (dyC > 40 && dur < 460 && dyC > Math.abs(dxC) * 1.0) {
          setLift(0);
          return;
        }
        if (dur < 300 && net < 18) {
          if (petalsSeeded) bounceAt(e.clientX, e.clientY);
          const n = performance.now();
          if (n - lastTap < 340) {
            doRevealAuto();
            lastTap = 0;
          } else lastTap = n;
        }
      } else delete grabs[e.pointerId];
    };
    const onCancel = (e: PointerEvent) => {
      if (grabs[e.pointerId]) delete grabs[e.pointerId];
    };
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', onCancel);

    // ── Resize / rotate — cheap re-fit immediately (no stretch), full rebuild debounced.
    let roFrame = 0;
    let roFull = 0;
    const cheapResize = () => {
      W = cv.clientWidth || W;
      H = cv.clientHeight || H;
      if (W < 2 || H < 2) return;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      vh = (camZ - frontZ) * Math.tan((fov * Math.PI) / 360);
      vw = vh * (W / H);
      setRepeat();
    };
    let ro: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        if (roFrame) cancelAnimationFrame(roFrame);
        roFrame = requestAnimationFrame(cheapResize);
        if (roFull) window.clearTimeout(roFull);
        roFull = window.setTimeout(() => applyView(), 240);
      });
      ro.observe(cv);
    }

    parkAll();
    applyView();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      if (roFrame) cancelAnimationFrame(roFrame);
      if (roFull) window.clearTimeout(roFull);
      ro?.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', onCancel);
      geo?.dispose();
      mat.dispose();
      mat.alphaMap?.dispose();
      ptex.dispose();
      pmat.dispose();
      petals.geometry.dispose();
      veil.geometry.dispose();
      renderer.dispose();
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" style={{ touchAction: 'none' }} aria-hidden />;
}
