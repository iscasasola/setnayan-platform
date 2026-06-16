'use client';

/**
 * VeilReveal — the trademark Setnayan bridal-veil reveal (organic family).
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
 * code-split chunk fetched only when the reveal actually mounts.
 *
 * Colour: `veilColor` flows in from the couple's Mood Board palette (the page
 * resolves it). The gold Setnayan mark stays gold; only the tulle recolours.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  /** Veil tulle colour (hex), Mood-Board-driven. Ivory fallback handled by caller. */
  veilColor: string;
  /** Fired once when the veil has been lifted clear of the invitation. */
  onRevealed: () => void;
};

const GOLD = '#cb9e4b';
// Official Setnayan brand mark, drawn as a gold thread accent in the lace.
const MARK_PATH =
  'M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z';

function markUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5333.3335 5333.3335" width="140" height="140"><path d="${MARK_PATH}" fill="${GOLD}" fill-rule="nonzero" transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Build the veil's coverage (alpha) + gold-thread (emissive) textures: a fine
// tulle net, a scalloped filigree-lace hem of outline star-flowers + picots, and
// the small gold Setnayan mark scattered through the field.
function buildVeilTextures(markImg: HTMLImageElement | null): {
  alpha: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
} {
  const S = 1024;
  const cv = (): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  const aC = cv();
  const a = aC.getContext('2d')!;
  const eC = cv();
  const e = eC.getContext('2d')!;
  a.fillStyle = '#2a2a2a';
  a.fillRect(0, 0, S, S);
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);

  const td = (cx: number, cy: number, L: number, W: number, ang: number) => {
    const p: Array<[number, number]> = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * 6.2832;
      const r = (1 - Math.cos(t)) / 2;
      const x = W * Math.sin(t) * Math.pow(r, 0.8);
      const y = -L * r;
      p.push([cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]);
    }
    return p;
  };
  const star = (ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, col: string, lw: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    for (let k = 0; k < 8; k++) {
      const p = td(cx, cy, R, R * 0.42, (k / 8) * 6.2832);
      ctx.beginPath();
      ctx.moveTo(p[0]![0], p[0]![1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i]![0], p[i]![1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = col;
    for (let b = 0; b < 6; b++) {
      const aa = (b / 6) * 6.2832;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(aa) * R * 0.2, cy + Math.sin(aa) * R * 0.2, lw * 0.9, 0, 6.2832);
      ctx.fill();
    }
  };

  // fine tulle net
  a.strokeStyle = 'rgba(255,255,255,0.26)';
  a.lineWidth = 1;
  for (let d = -S; d < S * 2; d += 14) {
    a.beginPath();
    a.moveTo(d, 0);
    a.lineTo(d + S, S);
    a.stroke();
    a.beginPath();
    a.moveTo(d, S);
    a.lineTo(d + S, 0);
    a.stroke();
  }

  const laceTop = Math.floor(S * 0.8);
  for (let i = 0; i < 24; i++) {
    star(a, ((i * 137) % S), 40 + ((i * 211) % (laceTop - 110)), 8 + (i % 5), 'rgba(255,255,255,0.78)', 1);
  }

  // gold Setnayan mark accents
  if (markImg) {
    const mwG = cv();
    mwG.width = mwG.height = 120;
    const gc = mwG.getContext('2d')!;
    gc.drawImage(markImg, 0, 0, 120, 120);
    const mwW = cv();
    mwW.width = mwW.height = 120;
    const wc = mwW.getContext('2d')!;
    wc.drawImage(markImg, 0, 0, 120, 120);
    wc.globalCompositeOperation = 'source-in';
    wc.fillStyle = '#fff';
    wc.fillRect(0, 0, 120, 120);
    for (let k = 0; k < 11; k++) {
      const mx = 70 + ((k * 173) % (S - 140));
      const my = 110 + ((k * 251) % (laceTop - 200));
      const ms = 42;
      e.drawImage(mwG, mx - ms / 2, my - ms / 2, ms, ms);
      a.globalAlpha = 0.5;
      a.drawImage(mwW, mx - ms / 2, my - ms / 2, ms, ms);
      a.globalAlpha = 1;
    }
  }

  // scalloped filigree-lace hem
  const units = 12;
  const period = S / units;
  const rscal = period * 0.46;
  const baseE = S - 3;
  const topE = baseE - rscal;
  const topTrim = topE - rscal * 1.4;
  a.save();
  a.beginPath();
  a.rect(0, topTrim, S, topE - topTrim);
  for (let u = 0; u < units; u++) {
    const cxs = period * (u + 0.5);
    a.moveTo(cxs + rscal, topE);
    a.arc(cxs, topE, rscal, 0, Math.PI, false);
  }
  a.clip();
  a.strokeStyle = 'rgba(255,255,255,0.5)';
  a.lineWidth = 1;
  for (let d = -S; d < S * 2; d += 8) {
    a.beginPath();
    a.moveTo(d, topTrim);
    a.lineTo(d + S, S);
    a.stroke();
    a.beginPath();
    a.moveTo(d, S);
    a.lineTo(d + S, topTrim);
    a.stroke();
  }
  a.restore();
  for (let u = 0; u < units; u++) star(a, period * (u + 0.5), topE - 3, period * 0.3, 'rgba(255,255,255,0.92)', 1.3);
  a.strokeStyle = 'rgba(255,255,255,0.9)';
  a.lineWidth = 2;
  for (let u = 0; u < units; u++) {
    a.beginPath();
    a.arc(period * (u + 0.5), topE, rscal, 0, Math.PI, false);
    a.stroke();
  }
  // clip alpha to the scallop silhouette below topE
  const mk = cv();
  const mc = mk.getContext('2d')!;
  mc.fillStyle = '#fff';
  mc.fillRect(0, 0, S, topE);
  for (let u = 0; u < units; u++) {
    mc.beginPath();
    mc.arc(period * (u + 0.5), topE, rscal, 0, Math.PI, false);
    mc.fill();
  }
  a.globalCompositeOperation = 'destination-in';
  a.drawImage(mk, 0, 0);
  a.globalCompositeOperation = 'source-over';
  // picots
  for (let u = 0; u < units; u++) {
    const cx = period * (u + 0.5);
    for (let deg = 14; deg < 170; deg += 20) {
      const ar = (deg * Math.PI) / 180;
      a.fillStyle = 'rgba(255,255,255,0.95)';
      a.beginPath();
      a.arc(cx + Math.cos(ar) * (rscal + 4), topE + Math.sin(ar) * (rscal + 4), 2, 0, 6.2832);
      a.fill();
    }
  }

  const alpha = new THREE.CanvasTexture(aC);
  const emissive = new THREE.CanvasTexture(eC);
  alpha.anisotropy = 4;
  // sRGB on the emissive so the gold reads true
  // (CanvasTexture defaults are fine for the alpha map).
  return { alpha, emissive };
}

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

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorRef.current || '#f3ece1'),
      roughness: 0.84,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: new THREE.Color(GOLD),
      emissiveIntensity: 0.85,
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
          '#include <dithering_fragment>\nvec3 V=normalize(cameraPosition-vWP);float fr=pow(1.0-abs(dot(V,normalize(vNN))),1.8);gl_FragColor.rgb+=fr*0.7;gl_FragColor.a=clamp(gl_FragColor.a+fr*0.5,0.0,1.0);',
        );
    };

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
