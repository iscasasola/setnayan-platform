'use client';

/**
 * VeilCrown — the bridal-veil reveal, V2 "crown-pinned · folding" (organic
 * family · template 6 of 7).
 *
 * Same trademark tulle + filigree-lace + gold Setnayan mark as the sheer veil
 * (shared from ./veil-shared), but a different drape and a different gesture:
 * the veil is GATHERED NARROW at the crown (top centre) and FANS WIDE into deep
 * folds toward the hem. The guest scrolls / drags UP and the HEM lifts up & back
 * OVER the crown — the veil folds away upward rather than lifting off as one
 * sheet. Once it clears, `onRevealed` fires and the overlay fades + removes it.
 *
 * Real cloth simulation (Verlet grid + distance constraints + gravity + wind),
 * crown row + hem row pinned. three.js is code-split: this is only ever loaded
 * via next/dynamic(ssr:false) from RevealOverlay, so three lands in its own
 * chunk fetched only when the reveal mounts.
 *
 * Craft constants are baked Setnayan-wide (S-fold depth · wind · net gap are not
 * couple controls) — the only customizable knob is `veilColor`, Mood-Board-driven
 * (ivory fallback handled by the caller). The gold mark stays gold; tulle recolours.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildVeilTextures, makeVeilMaterial, markUrl } from './veil-shared';

type Props = {
  /** Veil tulle colour (hex), Mood-Board-driven. Ivory fallback handled by caller. */
  veilColor: string;
  /** Fired once when the veil has been folded clear of the invitation. */
  onRevealed: () => void;
};

export default function VeilCrown({ veilColor, onRevealed }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef(veilColor);
  colorRef.current = veilColor;
  const revealedRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let W = mount.clientWidth || window.innerWidth;
    let H = mount.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL → reveal silently (never gate the guest).
      onRevealed();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 4.4);
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x241c16, 0.6));
    const key = new THREE.SpotLight(0xfff3e0, 1.6, 40, Math.PI / 5, 0.6, 1.0);
    key.position.set(2, 3.2, 4.8);
    scene.add(key);

    const mat = makeVeilMaterial(colorRef.current);

    const applyTextures = (img: HTMLImageElement | null) => {
      const { alpha, emissive } = buildVeilTextures(img);
      mat.alphaMap = alpha;
      mat.emissiveMap = emissive;
      mat.needsUpdate = true;
    };
    const img = new Image();
    img.onload = () => applyTextures(img);
    img.onerror = () => applyTextures(null);
    img.src = markUrl();

    // cloth grid (Verlet) — gathered narrow at the crown, fanning wide to the hem.
    const cols = 30;
    const rows = 44;
    const N = cols * rows;
    const crownHalf = 0.55; // narrow gather at the crown (top)
    const hemHalf = 3.6; // wide spread at the hem (bottom)
    const topY = 1.5; // crown sits at the top of the frame
    const clothH = 7.6;
    const frontZ = 0.5;
    const dyRow = clothH / (rows - 1);
    const FOLDS = 3; // deep S folds across the width…
    const sAmp = 0.6; // …fanning out toward the hem (locked craft constant)
    const idx = (ix: number, iy: number) => iy * cols + ix;

    // rest shape (the fanned, folded drape every node springs toward)
    const rx = new Float32Array(N);
    const ry = new Float32Array(N);
    const rz = new Float32Array(N);
    for (let iy = 0; iy < rows; iy++) {
      const rowT = iy / (rows - 1);
      const halfW = crownHalf + (hemHalf - crownHalf) * rowT;
      for (let ix = 0; ix < cols; ix++) {
        const k = idx(ix, iy);
        const colT = ix / (cols - 1);
        rx[k] = -halfW + 2 * halfW * colT;
        ry[k] = topY - iy * dyRow;
        rz[k] = frontZ + sAmp * rowT * Math.sin(colT * Math.PI * FOLDS);
      }
    }

    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const pz = new Float32Array(N);
    const qx = new Float32Array(N);
    const qy = new Float32Array(N);
    const qz = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      px[k] = qx[k] = rx[k]!;
      py[k] = qy[k] = ry[k]!;
      pz[k] = qz[k] = rz[k]!;
    }

    const dist3 = (a: number, b: number) =>
      Math.hypot(rx[a]! - rx[b]!, ry[a]! - ry[b]!, rz[a]! - rz[b]!);
    const cons: Array<[number, number, number]> = [];
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const k = idx(ix, iy);
        if (ix < cols - 1) cons.push([k, idx(ix + 1, iy), dist3(k, idx(ix + 1, iy))]);
        if (iy < rows - 1) cons.push([k, idx(ix, iy + 1), dist3(k, idx(ix, iy + 1))]);
        if (ix < cols - 1 && iy < rows - 1) cons.push([k, idx(ix + 1, iy + 1), dist3(k, idx(ix + 1, iy + 1))]);
      }
    }

    const pinTop = (k: number) => k < cols; // crown row (gathered, stays up)
    const pinHem = (k: number) => k >= N - cols; // hem row (lifts up & back)
    const pinned = (k: number) => pinTop(k) || pinHem(k);

    const geo = new THREE.PlaneGeometry(1, 1, cols - 1, rows - 1);
    const veil = new THREE.Mesh(geo, mat);
    scene.add(veil);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;

    // lift: 0 (covering) → 1 (folded clear). Driven by drag / scroll / wheel.
    let lift = 0;
    let liftTarget = 0;
    let t = 0;

    const step = (dt: number) => {
      t += dt;
      const drag = 0.97;
      const g = -3.2;
      const wind = 0.4;
      // crown rises only late (quadratic) so the gather pulls up with the fold;
      // the hem swings up well above the crown and back behind it.
      const crownRise = lift * lift * 2.2;
      const hemRise = lift * (clothH + 3.4);
      for (let k = 0; k < N; k++) {
        if (pinTop(k)) {
          const ix = k;
          px[k] = rx[k]! + 0.03 * Math.sin(t * 1.1 + ix * 0.6);
          py[k] = ry[k]! + crownRise + 0.02 * Math.sin(t * 1.3 + ix);
          pz[k] = rz[k]!;
          qx[k] = px[k]!;
          qy[k] = py[k]!;
          qz[k] = pz[k]!;
          continue;
        }
        if (pinHem(k)) {
          const ix = k - (N - cols);
          px[k] = rx[k]! * (1 - 0.72 * lift) + 0.02 * Math.sin(t * 1.2 + ix);
          py[k] = ry[k]! + hemRise;
          pz[k] = rz[k]! - lift * 2.6; // fold back behind the crown
          qx[k] = px[k]!;
          qy[k] = py[k]!;
          qz[k] = pz[k]!;
          continue;
        }
        const ax = wind * 0.22 * Math.sin(t * 0.9 + py[k]! * 0.5);
        const az = wind * (0.28 + 0.28 * Math.sin(t * 1.5 + (px[k]! + py[k]!) * 0.7));
        const nx = px[k]! + (px[k]! - qx[k]!) * drag + ax * dt * dt;
        const ny = py[k]! + (py[k]! - qy[k]!) * drag + g * dt * dt;
        const nz = pz[k]! + (pz[k]! - qz[k]!) * drag + az * dt * dt;
        qx[k] = px[k]!;
        qy[k] = py[k]!;
        qz[k] = pz[k]!;
        px[k] = nx;
        py[k] = ny;
        pz[k] = nz;
      }
      for (let it = 0; it < 4; it++) {
        for (let c = 0; c < cons.length; c++) {
          const con = cons[c]!;
          const A = con[0];
          const B = con[1];
          const rest = con[2];
          const ddx = px[B]! - px[A]!;
          const ddy = py[B]! - py[A]!;
          const ddz = pz[B]! - pz[A]!;
          const d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1e-4;
          const f = ((d - rest) / d) * 0.5;
          const ox = ddx * f;
          const oy = ddy * f;
          const oz = ddz * f;
          if (!pinned(A)) {
            px[A] = px[A]! + ox;
            py[A] = py[A]! + oy;
            pz[A] = pz[A]! + oz;
          }
          if (!pinned(B)) {
            px[B] = px[B]! - ox;
            py[B] = py[B]! - oy;
            pz[B] = pz[B]! - oz;
          }
        }
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      lift += (liftTarget - lift) * 0.06;
      mat.color.set(colorRef.current || '#f3ece1');
      step(1 / 60);
      for (let k = 0; k < N; k++) posAttr.setXYZ(k, px[k]!, py[k]!, pz[k]!);
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
      renderer.render(scene, camera);
      if (lift > 0.985 && !revealedRef.current) {
        revealedRef.current = true;
        onRevealed();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // interaction: drag up or scroll up folds the veil up & back over the crown
    let acc = 0;
    let dragging = false;
    let startY = 0;
    let startAcc = 0;
    const setLift = (v: number) => {
      acc = Math.max(0, Math.min(1, v));
      liftTarget = acc;
    };
    const onWheel = (ev: WheelEvent) => {
      setLift(acc + ev.deltaY * 0.0016);
    };
    const onDown = (ev: PointerEvent) => {
      dragging = true;
      startY = ev.clientY;
      startAcc = acc;
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging) return;
      setLift(startAcc + (startY - ev.clientY) * 0.0035);
    };
    const onUp = () => {
      dragging = false;
      // snap: past a third of the way → finish the fold; else settle back
      if (acc > 0.34) setLift(1);
      else setLift(0);
    };
    const el = renderer.domElement;
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      W = mount.clientWidth || window.innerWidth;
      H = mount.clientHeight || window.innerHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      geo.dispose();
      mat.dispose();
      mat.alphaMap?.dispose();
      mat.emissiveMap?.dispose();
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [onRevealed]);

  return <div ref={mountRef} className="absolute inset-0" style={{ touchAction: 'none' }} aria-hidden />;
}
