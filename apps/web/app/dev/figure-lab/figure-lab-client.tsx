'use client';

/**
 * /dev/figure-lab — THROWAWAY character-design prototype (2026-07-08).
 * RAW three.js (no react-three-fiber) — same standalone-canvas pattern as the
 * Save-the-Date veil reveal, so the mount has zero framework mystery. A
 * lineup of the wedding cast rendered three ways; the winning style's
 * parameters fold into kit/figure.tsx and this page is deleted.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { plainMaterial, outfitMaterial, SLEEVE_GEO, type OutfitKind } from '@/app/_components/plan3d/kit/outfits';

// ── Style presets: the three options ─────────────────────────────────────────

type Style = {
  key: string;
  label: string;
  blurb: string;
  headR: number;
  headLift: number;
  pelvisY: number;
  shoulderX: number;
  limbThick: number;
  shellXZ: number;
  face: 'minimal' | 'sims' | 'editorial';
  hairScale: number;
};

const STYLES: Style[] = [
  {
    key: 'editorial',
    label: 'A · Editorial minimal',
    blurb: 'What ships today — 6.8-head proportions, quiet dot faces, matte cloth.',
    headR: 0.115,
    headLift: 0.13,
    pelvisY: 0.8,
    shoulderX: 0.16,
    limbThick: 1.0,
    shellXZ: 1.0,
    face: 'minimal',
    hairScale: 1.0,
  },
  {
    key: 'sims',
    label: 'B · Sims charm',
    blurb: 'Bigger heads, rounder bodies, expressive eyes + brows + smiles — the reference look.',
    headR: 0.15,
    headLift: 0.15,
    pelvisY: 0.74,
    shoulderX: 0.165,
    limbThick: 1.18,
    shellXZ: 1.09,
    face: 'sims',
    hairScale: 1.12,
  },
  {
    key: 'runway',
    label: 'C · Runway real',
    blurb: 'Taller, slimmer, small refined features — closest to live proportions.',
    headR: 0.102,
    headLift: 0.13,
    pelvisY: 0.85,
    shoulderX: 0.15,
    limbThick: 0.88,
    shellXZ: 0.96,
    face: 'editorial',
    hairScale: 0.95,
  },
];

// ── The cast ─────────────────────────────────────────────────────────────────

type Cast = {
  label: string;
  outfit: OutfitKind;
  color: string | null;
  skin: string;
  hair: 'crop' | 'bun' | 'long' | 'side' | 'short';
  hairColor: string;
};

const CAST: Cast[] = [
  { label: 'Bride', outfit: 'gown', color: '#f4efe6', skin: '#c8996c', hair: 'bun', hairColor: '#241a12' },
  { label: 'Groom', outfit: 'barong', color: null, skin: '#a9764a', hair: 'crop', hairColor: '#181210' },
  { label: 'Maid of Honor', outfit: 'gown', color: '#96455f', skin: '#b98a63', hair: 'long', hairColor: '#2c1c10' },
  { label: 'Best Man', outfit: 'suit', color: '#2e3345', skin: '#8f6238', hair: 'short', hairColor: '#141414' },
  { label: 'Bridesmaid', outfit: 'filipiniana', color: '#c9a4ad', skin: '#d3a97e', hair: 'side', hairColor: '#3a2413' },
  { label: 'Groomsman', outfit: 'suit', color: '#41465a', skin: '#9c7047', hair: 'crop', hairColor: '#1c1712' },
  { label: 'Ninang', outfit: 'gown', color: '#c9b483', skin: '#b07f52', hair: 'bun', hairColor: '#4a3a2c' },
  { label: 'Ninong', outfit: 'barong', color: null, skin: '#8a5f3c', hair: 'short', hairColor: '#332a22' },
  { label: 'Guest', outfit: 'neutral', color: null, skin: '#c19467', hair: 'long', hairColor: '#221607' },
];

// ── Builders ─────────────────────────────────────────────────────────────────

function lathe(points: ReadonlyArray<readonly [number, number]>, xz: number): THREE.LatheGeometry {
  const pts = points.map(([r, y]) => new THREE.Vector2(r * xz, y));
  const last = points[points.length - 1]!;
  pts.push(new THREE.Vector2(0.001, last[1]));
  return new THREE.LatheGeometry(pts, 24);
}

const GOWN_PROFILE = [
  [0.045, 0.5],
  [0.15, 0.44],
  [0.165, 0.32],
  [0.108, 0.18],
  [0.155, 0.02],
  [0.205, -0.38],
  [0.245, -0.62],
] as const;
const SUIT_PROFILE = [
  [0.05, 0.52],
  [0.155, 0.46],
  [0.15, 0.3],
  [0.125, 0.1],
  [0.14, -0.05],
] as const;
const NEUTRAL_PROFILE = [
  [0.048, 0.5],
  [0.14, 0.44],
  [0.13, 0.15],
  [0.135, -0.02],
] as const;

function faceTexture(kind: Style['face']): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2;
  if (kind === 'sims') {
    for (const side of [-1, 1]) {
      const ex = cx + side * 46;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, 108, 22, 27, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b1c12';
      ctx.beginPath();
      ctx.ellipse(ex, 112, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex - 4, 105, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#241a12';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(ex, 84, 24, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.fillStyle = 'rgba(214,106,89,0.35)';
      ctx.beginPath();
      ctx.ellipse(ex + side * 14, 152, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#5d3327';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, 150, 34, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
  } else if (kind === 'editorial') {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#241a12';
      ctx.beginPath();
      ctx.ellipse(cx + side * 38, 112, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#241a12';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx + side * 38, 92, 16, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4a2a20';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, 148, 22, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
  } else {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#241a12';
      ctx.beginPath();
      ctx.ellipse(cx + side * 36, 112, 9, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#4a2a20';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, 146, 26, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFigure(style: Style, cast: Cast): THREE.Group {
  const skirted = cast.outfit === 'gown' || cast.outfit === 'filipiniana';
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = style.pelvisY;
  root.add(body);

  const shellMat = outfitMaterial(cast.outfit, cast.color);
  const skinMat = plainMaterial(cast.skin);
  const hairMat = plainMaterial(cast.hairColor);
  const trouser = plainMaterial('#23262f');

  // shell
  const profile = skirted ? GOWN_PROFILE : cast.outfit === 'neutral' ? NEUTRAL_PROFILE : SUIT_PROFILE;
  body.add(new THREE.Mesh(lathe(profile, style.shellXZ), shellMat));

  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 0.09, 10), skinMat);
  neck.position.y = 0.545;
  body.add(neck);

  // legs
  const legGeo = new THREE.CapsuleGeometry(0.052 * style.limbThick, 0.32, 3, 8);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, skirted || cast.outfit === 'neutral' ? skinMat : trouser);
    leg.position.set(s * 0.075, skirted ? -style.pelvisY + 0.22 : -style.pelvisY * 0.48, 0);
    const len = skirted ? 0.5 : (style.pelvisY * 0.96) / 0.42;
    leg.scale.set(skirted ? 0.8 : 1, len, skirted ? 0.8 : 1);
    body.add(leg);
  }

  // arms + shoulder caps
  const armGeo = new THREE.CapsuleGeometry(0.04 * style.limbThick, 0.3, 3, 8);
  const capGeo = new THREE.SphereGeometry(0.055 * style.limbThick, 10, 8);
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * style.shoulderX, 0.45, 0);
    g.rotation.z = s * 0.09;
    const cap = new THREE.Mesh(capGeo, skirted ? skinMat : shellMat);
    const arm = new THREE.Mesh(armGeo, skirted ? skinMat : shellMat);
    arm.position.y = -0.2;
    g.add(cap, arm);
    body.add(g);
  }

  // filipiniana butterfly sleeves
  if (cast.outfit === 'filipiniana') {
    for (const s of [-1, 1]) {
      const sl = new THREE.Mesh(SLEEVE_GEO, shellMat);
      sl.position.set(s * style.shoulderX, 0.49, 0);
      sl.scale.set(1.5, 0.8, 1.05);
      body.add(sl);
    }
  }

  // head + face + hair
  const head = new THREE.Group();
  head.position.y = 0.52 + style.headLift;
  body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(style.headR, 20, 14), skinMat));
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(style.face), transparent: true, depthWrite: false });
  const face = new THREE.Mesh(new THREE.CircleGeometry(style.headR * 0.85, 24), faceMat);
  face.position.set(0, -style.headR * 0.06, -style.headR * 0.96);
  face.rotation.y = Math.PI; // decal faces -z, the lineup-camera side
  head.add(face);

  const r = style.headR * style.hairScale;
  const hairAdd = (geo: THREE.BufferGeometry, p: [number, number, number], sc: [number, number, number] = [1, 1, 1]) => {
    const m = new THREE.Mesh(geo, hairMat);
    m.position.set(...p);
    m.scale.set(...sc);
    head.add(m);
  };
  switch (cast.hair) {
    case 'bun':
      hairAdd(new THREE.SphereGeometry(r * 1.04, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.38), [0, 0.012, style.headR * 0.06]);
      hairAdd(new THREE.SphereGeometry(r * 0.42, 10, 8), [0, r * 0.95, r * 0.75]);
      break;
    case 'long':
      hairAdd(new THREE.SphereGeometry(r * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), [0, 0.012, style.headR * 0.06]);
      hairAdd(new THREE.CapsuleGeometry(r * 0.55, r * 1.5, 3, 8), [0, -r * 0.8, r * 0.72], [1.35, 1, 0.6]);
      break;
    case 'side':
      hairAdd(new THREE.SphereGeometry(r * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), [r * 0.12, 0.014, style.headR * 0.06]);
      hairAdd(new THREE.CapsuleGeometry(r * 0.4, r * 1.1, 3, 8), [r * 0.75, -r * 0.55, 0], [0.7, 1, 0.7]);
      break;
    case 'short':
      hairAdd(new THREE.SphereGeometry(r * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), [0, 0.02, style.headR * 0.05], [1, 1.05, 1]);
      break;
    default:
      hairAdd(new THREE.SphereGeometry(r * 1.03, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.33), [0, 0.03, style.headR * 0.05]);
  }

  root.rotation.y = -0.28;
  return root;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FigureLabClient() {
  const [styleKey, setStyleKey] = useState('sims');
  const mountRef = useRef<HTMLDivElement>(null);
  const style = STYLES.find((s) => s.key === styleKey)!;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#efe9df');

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);

    const hemi = new THREE.HemisphereLight('#fff6ea', '#b8ac9c', 0.9);
    const dir = new THREE.DirectionalLight('#ffffff', 1.6);
    dir.position.set(3, 6, 4);
    dir.castShadow = true;
    scene.add(hemi, dir);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ color: '#e2dacb' }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const figures: THREE.Group[] = CAST.map((c, i) => {
      const f = buildFigure(style, c);
      f.position.x = -(i - (CAST.length - 1) / 2) * 0.78;
      scene.add(f);
      return f;
    });

    // Manual orbit (yaw + pitch + zoom) around the lineup centre.
    const target = new THREE.Vector3(0, 0.95, 0);
    let yaw = Math.PI; // faces spawn looking at -z from this camera side
    let pitch = 0.12;
    let dist = 4.6;
    const applyCam = () => {
      camera.position.set(
        target.x + dist * Math.sin(yaw) * Math.cos(pitch),
        target.y + dist * Math.sin(pitch),
        target.z + dist * Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(target);
    };
    applyCam();

    let dragging = false;
    let px = 0;
    let py = 0;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    const down = (e: PointerEvent) => {
      dragging = true;
      px = e.clientX;
      py = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - px) * 0.005;
      pitch = Math.min(0.9, Math.max(-0.1, pitch + (e.clientY - py) * 0.004));
      px = e.clientX;
      py = e.clientY;
      applyCam();
    };
    const up = () => {
      dragging = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      dist = Math.min(9, Math.max(1.4, dist + e.deltaY * 0.003));
      applyCam();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
      figures.forEach((f) => scene.remove(f));
      renderer.dispose();
      if (el.parentElement === mount) mount.removeChild(el);
    };
    // Rebuild the whole scene per style switch — throwaway lab, clarity > perf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey]);

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#efe9df', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 20px 6px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15 }}>Figure lab — character options</strong>
        {STYLES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStyleKey(s.key)}
            className="rounded-full"
            style={{
              padding: '8px 16px',
              border: s.key === styleKey ? '2px solid #2a2925' : '1px solid rgba(42,41,37,.3)',
              background: s.key === styleKey ? '#2a2925' : 'transparent',
              color: s.key === styleKey ? '#faf7f2' : '#2a2925',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {s.label}
          </button>
        ))}
        <span style={{ fontSize: 12.5, color: '#6b665e', flexBasis: '100%' }}>{style.blurb} · drag to orbit · scroll to zoom</span>
      </header>
      <div ref={mountRef} style={{ flex: 1, minHeight: 0 }} />
      <footer style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 12px' }}>
        {CAST.map((c) => (
          <span key={c.label} style={{ width: 86, textAlign: 'center', fontSize: 11, color: '#57524a' }}>
            {c.label}
          </span>
        ))}
      </footer>
    </main>
  );
}
