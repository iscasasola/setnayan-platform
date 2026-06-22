'use client';

/**
 * MoltenMonogramReveal — a REAL WebGL molten-gold opening (owner 2026-06-22:
 * "real lava hardening to the monogram, not a powerpoint effect"). A custom GLSL
 * fragment shader floods the couple's monogram silhouette with molten metal that
 * FLOWS (domain-warped fbm turbulence), glows white-hot, then COOLS — the
 * emissive fades, a crust grows across the surface, and the metal HARDENS into
 * solid gold with a final foil glint, before handing off to the content film.
 *
 * This is the premium WebGL sibling to the lightweight CSS GoldMonogramReveal —
 * a genuine shader, not CSS keyframes. It mirrors veil-reveal.tsx's contract
 * exactly so it slots into the reveal system the same way:
 *   - raw three.js in a mount-once useEffect, TRANSPARENT canvas over a dark stage
 *   - DPR cap (1 under lowRes for the watermarked preview), manual rAF loop
 *   - a single normalized progress p∈[0,1] over ~5s drives the shader uniforms
 *   - a doneRef-guarded onDone() at p≥0.985 → the overlay's onOpened →
 *     'std-reveal-done' → the film starts and the overlay unmounts
 *   - ResizeObserver re-fit, full GPU dispose on unmount
 *   - WebGL-init failure / reduced-motion → finish() immediately (never gate the
 *     guest; the free film always plays)
 *
 * Lazy-loaded via next/dynamic(ssr:false) from RevealOverlay so three.js stays
 * OUT of the main couple-site bundle (Lighthouse-safe), exactly like the veil.
 *
 * The lava is MASKED to the couple's mark via the shared svgToMonogramTexture
 * helper (the one-true monogram→texture path): an uploaded bespoke SVG renders
 * pixel-exact; lettered initials build a plate-less silhouette (bare gold glyphs)
 * so the lava fills the LETTERS, not a badge. Lettered marks rasterize in a
 * system serif (the documented svg-monogram-texture font caveat — the couple's
 * chosen face needs an inlined @font-face, a deliberate followup).
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { svgToMonogramTexture, type MonogramTextureSource } from '@/lib/svg-monogram-texture';

type Props = {
  /** Couple's uploaded/bespoke SVG mark — rendered pixel-exact as the lava mask. */
  markSvg?: string | null;
  /** Initials, e.g. "A & J" — built into a plate-less silhouette when no markSvg. */
  monogram: string;
  /** Fires once the metal has hardened → the overlay's 'std-reveal-done'. */
  onDone?: () => void;
  /** Cap DPR to 1 + smaller mask for the watermarked dashboard/studio preview. */
  lowRes?: boolean;
  /** Loop forever (ambient chooser/studio preview). Default false = once → settle. */
  loop?: boolean;
};

/** Molten → hardened, in seconds. */
const DUR = 5.2;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** "M & J" → ["M","&","J"]; "MJ" → ["M","J"]. Mirrors GoldMonogramReveal.splitGlyphs. */
function splitGlyphs(s: string): string[] {
  const t = (s || '').trim();
  const spaced = t.split(/\s+/).filter(Boolean);
  const g = spaced.length >= 2 ? spaced : (t || '·').split('');
  return g.slice(0, 5);
}

/**
 * A PLATE-LESS silhouette for lettered marks — bare black glyphs on transparent,
 * so svgToMonogramTexture's alpha is the LETTER shapes (lava fills the glyphs).
 * Feeding {kind:'config'} instead would paint a cream plate + ring badge whose
 * alpha is the whole square → lava would flood a badge, not the letters. Same
 * glyph layout as GoldMonogramReveal so the two openings read identically.
 */
function lettersSilhouetteSvg(monogram: string): string {
  const glyphs = splitGlyphs(monogram);
  const W = Math.max(1, glyphs.length) * 100;
  const cells = glyphs
    .map(
      (ch, i) =>
        `<text x="${(i + 0.5) * 100}" y="128" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-weight="600" font-size="110" fill="#000">${escapeXml(ch)}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 180">${cells}</svg>`;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0); // full-screen quad straight to NDC
  }
`;

const FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;     // seconds
  uniform float uProg;     // 0..1 reveal progress
  uniform float uFill;     // smoothstep(0,.30,p)  — lava floods the mark
  uniform float uCool;     // smoothstep(.30,.85,p) — heat drains
  uniform float uHarden;   // smoothstep(.78,.95,p) — resolves to solid gold
  uniform float uAspect;   // canvas W/H
  uniform float uReduced;  // 1 → paint static gold (no motion)
  uniform sampler2D uMask; // monogram alpha mask (square, contain-fit)
  uniform float uHasMask;

  // gold (owner-approved ramp, matches GoldMonogramReveal: #A88340 → #E4C77E)
  const vec3 GOLD_DEEP = vec3(0.659, 0.514, 0.251);
  const vec3 GOLD_MID  = vec3(0.894, 0.780, 0.494);

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p = m * p;
      amp *= 0.5;
    }
    return v;
  }

  // lava heat ramp: near-black crust → deep red → orange → yellow-gold → white-hot
  vec3 lavaRamp(float h) {
    vec3 c0 = vec3(0.09, 0.03, 0.01);
    vec3 c1 = vec3(0.55, 0.09, 0.02);
    vec3 c2 = vec3(0.96, 0.35, 0.05);
    vec3 c3 = vec3(1.0, 0.78, 0.30);
    vec3 c4 = vec3(1.0, 0.97, 0.86);
    vec3 c = mix(c0, c1, smoothstep(0.0, 0.25, h));
    c = mix(c, c2, smoothstep(0.25, 0.5, h));
    c = mix(c, c3, smoothstep(0.5, 0.78, h));
    c = mix(c, c4, smoothstep(0.78, 1.0, h));
    return c;
  }

  void main() {
    // Map full-screen UV → a centred square so the mark keeps aspect (occupies
    // ~58% of the min dimension). Outside [0,1] → no coverage.
    float frac = 0.58;
    vec2 muv = (vUv - 0.5);
    muv.x *= uAspect;          // un-stretch to square space
    muv = muv / frac + 0.5;    // fit the mark box

    float cov = 0.0;
    if (uHasMask > 0.5 && muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {
      cov = texture2D(uMask, muv).a;
    }
    cov = smoothstep(0.35, 0.55, cov); // soft edge — anti-aliased glyphs stay clean
    if (cov < 0.02) {
      gl_FragColor = vec4(0.0);        // outside the mark → transparent (heavy noise skipped)
      return;
    }

    // Static gold for reduced-motion (belt-and-suspenders; overlay already gates).
    if (uReduced > 0.5) {
      float gv = 0.5 + 0.5 * sin(muv.y * 9.0);
      gl_FragColor = vec4(mix(GOLD_DEEP, GOLD_MID, gv), cov);
      return;
    }

    // ── molten flow: domain-warped fbm (slows as it thickens / cools) ──
    float scale = 3.4;
    vec2 buv = muv * scale;
    float flow = mix(0.55, 0.06, uCool);
    vec2 q = vec2(fbm(buv + vec2(0.0, uTime * flow)),
                  fbm(buv + vec2(5.2, 1.3) - vec2(0.0, uTime * flow)));
    vec2 r = vec2(fbm(buv + 2.0 * q + vec2(1.7, 9.2)),
                  fbm(buv + 2.0 * q + vec2(8.3, 2.8)));
    float n = fbm(buv + 2.5 * r);

    // ── pour: lava rises to fill the mark from the bottom up ──
    // Overshoot so at uFill=1 the line clears muv.y=1 by a full smoothstep
    // half-width — the whole mark (incl. a full-bleed square mark's top edge) is
    // uniformly opaque at rest, no hairline of leftover transparency.
    float fillLine = uFill * 1.22 - 0.07;
    float filled = 1.0 - smoothstep(fillLine - 0.07, fillLine + 0.07, muv.y);
    float dy = (muv.y - fillLine) / 0.05;
    float crest = exp(-dy * dy) * (1.0 - uCool) * filled; // bright molten crest at the rising fill line

    // ── heat: high while molten, drains as it cools; n gives hot/cool veins ──
    float heat = clamp((uFill - uCool) + (n - 0.5) * 0.55 + crest, 0.0, 1.0);
    vec3 lava = lavaRamp(heat);
    float emis = pow(heat, 1.5) * (1.0 - uHarden * 0.9) + crest * 0.6;

    // ── crust: cooling lava skins over (noise islands spread as it cools) ──
    float crustThresh = smoothstep(0.5, 0.9, uProg);
    float crust = (1.0 - smoothstep(crustThresh - 0.12, crustThresh + 0.12, n)) * (1.0 - uHarden);

    // ── hardened gold + a foil glint sweep (the final shimmer) ──
    float goldVein = 0.5 + 0.5 * sin(muv.y * 9.0 + n * 3.0);
    vec3 solidGold = mix(GOLD_DEEP, GOLD_MID, goldVein);
    float glint = pow(max(0.0, 1.0 - abs(fract(muv.x * 0.6 - uTime * 0.15) - 0.5) * 2.0), 7.0);

    // ── compose: emissive lava → matte crust → lit solid gold ──
    vec3 col = lava * emis;
    col = mix(col, solidGold * 0.32, crust);                 // crust = matte solidifying gold
    col = mix(col, solidGold + glint * uHarden * 0.45, uHarden);

    gl_FragColor = vec4(col, cov * filled);
  }
`;

export default function MoltenMonogramReveal({
  markSvg = null,
  monogram,
  onDone,
  lowRes = false,
  loop = false,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneRef = useRef(false);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current?.();
    };

    const reduced =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL → hand off to the film immediately (never gate the guest).
      finish();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowRes ? 1 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const cv = renderer.domElement;
    cv.style.display = 'block';
    cv.style.width = '100%';
    cv.style.height = '100%';
    cv.style.touchAction = 'none';
    mount.appendChild(cv);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uTime: { value: 0 },
      uProg: { value: 0 },
      uFill: { value: 0 },
      uCool: { value: 0 },
      uHarden: { value: 0 },
      uAspect: { value: 1 },
      uReduced: { value: reduced ? 1 : 0 },
      uMask: { value: null as THREE.Texture | null },
      uHasMask: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // ── monogram → alpha mask (async; the shader stays empty until it resolves) ──
    let cancelled = false;
    let maskTex: THREE.CanvasTexture | null = null;
    const src: MonogramTextureSource =
      markSvg && markSvg.trim()
        ? { kind: 'svg', svg: markSvg }
        : { kind: 'svg', svg: lettersSilhouetteSvg(monogram) };
    svgToMonogramTexture(src, lowRes ? 1024 : 2048).then((tex) => {
      if (cancelled) {
        tex?.dispose();
        return;
      }
      if (!tex) {
        // Mask couldn't rasterize → nothing to harden; hand off immediately.
        finish();
        return;
      }
      maskTex = tex;
      uniforms.uMask.value = tex;
      uniforms.uHasMask.value = 1;
    });

    let W = 1;
    let H = 1;
    const fit = () => {
      W = cv.clientWidth || W;
      H = cv.clientHeight || H;
      if (W < 2 || H < 2) return;
      renderer.setSize(W, H, false);
      uniforms.uAspect.value = W / H;
    };
    fit();
    let ro: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => fit());
      ro.observe(cv);
    }

    let raf = 0;
    const cleanup = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      geo.dispose();
      mat.dispose();
      maskTex?.dispose();
      renderer.dispose();
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    };

    const ss = (a: number, b: number, x: number) => {
      const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return u * u * (3 - 2 * u);
    };

    // Reduced motion: paint the static gold mark a few frames (waiting on the
    // async mask), then hand off. The overlay already gates RM out, so this is
    // purely defensive so nothing ever hangs.
    if (reduced) {
      uniforms.uProg.value = 1;
      uniforms.uFill.value = 1;
      uniforms.uCool.value = 1;
      uniforms.uHarden.value = 1;
      let frames = 0;
      const paint = () => {
        renderer.render(scene, camera);
        frames += 1;
        if (frames < 12) {
          raf = requestAnimationFrame(paint);
        } else {
          finish();
        }
      };
      raf = requestAnimationFrame(paint);
      return cleanup;
    }

    let t = 0;
    let last = performance.now();
    const loopFn = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      t += dt;
      uniforms.uTime.value = t;
      // Live = once. Loop (preview/studio) holds the hardened gold a beat before
      // wrapping so it doesn't snap straight back to molten each cycle.
      const LOOP_HOLD = 1.4;
      const p = loopRef.current
        ? Math.min(1, (t % (DUR + LOOP_HOLD)) / DUR)
        : Math.min(1, t / DUR);
      uniforms.uProg.value = p;
      uniforms.uFill.value = ss(0.0, 0.3, p);
      uniforms.uCool.value = ss(0.3, 0.85, p);
      uniforms.uHarden.value = ss(0.78, 0.95, p);
      renderer.render(scene, camera);
      if (!loopRef.current && p >= 0.985) finish();
      raf = requestAnimationFrame(loopFn);
    };
    raf = requestAnimationFrame(loopFn);

    return cleanup;
    // Mount-once: the sim owns its lifecycle; prop changes are stable on the live
    // site. eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)',
        touchAction: 'none',
      }}
      aria-hidden
    />
  );
}
