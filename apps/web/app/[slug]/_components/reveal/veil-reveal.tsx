'use client';

/**
 * VeilReveal — the trademark Setnayan bridal-veil reveal (organic family · V1
 * "sheer · multi-touch").
 *
 * A sheer tulle veil with a scalloped filigree-lace hem and a small woven gold
 * Setnayan mark, rendered as a real cloth simulation on a TRANSPARENT full-screen
 * canvas that sits over the invitation. The guest drags / scrolls up to lift the
 * veil off — once it clears, `onRevealed` fires and the overlay removes itself,
 * leaving the page beneath fully interactive. The page content shows softly
 * through the sheer veil while it's up.
 *
 * three.js is imported here (not in the page bundle); this component is only ever
 * loaded via next/dynamic(ssr:false) from RevealOverlay, so three lands in a
 * code-split chunk fetched only when the reveal actually mounts. The net body,
 * lace hem and recolourable material live in ./veil-shared (the look every
 * organic reveal shares); only the motion is template-specific.
 *
 * Colour: `veilColor` flows in from the couple's Mood Board palette (the page
 * resolves it). The gold Setnayan mark stays gold; only the tulle recolours.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildVeilTextures, makeVeilMaterial, markUrl } from './veil-shared';

type Props = {
  /** Veil tulle colour (hex), Mood-Board-driven. Ivory fallback handled by caller. */
  veilColor: string;
  /** Fired once when the veil has been lifted clear of the invitation. */
  onRevealed: () => void;
};

export default function VeilReveal({ veilColor, onRevealed }: Props) {
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

    // cloth grid (Verlet) — pinned along the top crown line, drapes over the frame
    const cols = 28;
    const rows = 40;
    const N = cols * rows;
    const clothW = 6.4;
    const clothH = 9.2;
    const topY = 2.6;
    const frontZ = 0.6;
    const dx = clothW / (cols - 1);
    const dy = clothH / (rows - 1);
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const pz = new Float32Array(N);
    const qx = new Float32Array(N);
    const qy = new Float32Array(N);
    const qz = new Float32Array(N);
    const idx = (ix: number, iy: number) => iy * cols + ix;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const k = idx(ix, iy);
        const X = -clothW / 2 + ix * dx;
        const Y = topY - iy * dy;
        px[k] = qx[k] = X;
        py[k] = qy[k] = Y;
        pz[k] = qz[k] = frontZ;
      }
    }
    const cons: Array<[number, number, number]> = [];
    const diag = Math.hypot(dx, dy);
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        if (ix < cols - 1) cons.push([idx(ix, iy), idx(ix + 1, iy), dx]);
        if (iy < rows - 1) cons.push([idx(ix, iy), idx(ix, iy + 1), dy]);
        if (ix < cols - 1 && iy < rows - 1) cons.push([idx(ix, iy), idx(ix + 1, iy + 1), diag]);
      }
    }

    const geo = new THREE.PlaneGeometry(clothW, clothH, cols - 1, rows - 1);
    const veil = new THREE.Mesh(geo, mat);
    scene.add(veil);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;

    // lift: 0 (covering) → 1 (lifted clear). Driven by drag / scroll / wheel.
    let lift = 0;
    let liftTarget = 0;
    let t = 0;

    const step = (dt: number) => {
      t += dt;
      const drag = 0.97;
      const g = -3.2;
      const wind = 0.5;
      const pinY = topY + lift * (clothH + 2.4); // pin line rises as it lifts
      for (let k = 0; k < N; k++) {
        const isTop = k < cols;
        if (isTop) {
          const ix = k;
          px[k] = -clothW / 2 + ix * dx;
          py[k] = pinY + 0.04 * Math.sin(t * 1.2 + ix);
          pz[k] = frontZ + lift * 1.2;
          qx[k] = px[k]!;
          qy[k] = py[k]!;
          qz[k] = pz[k]!;
          continue;
        }
        const ax = wind * 0.25 * Math.sin(t * 0.9 + py[k]! * 0.5);
        const az = wind * (0.3 + 0.3 * Math.sin(t * 1.6 + (px[k]! + py[k]!) * 0.7));
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
          const aTop = A < cols;
          const bTop = B < cols;
          if (!aTop) {
            px[A] = px[A]! + ox;
            py[A] = py[A]! + oy;
            pz[A] = pz[A]! + oz;
          }
          if (!bTop) {
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
      lift += (liftTarget - lift) * 0.07;
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

    // interaction: drag up or scroll up lifts the veil off
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
      // snap: past a third of the way → finish the lift; else settle back
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
