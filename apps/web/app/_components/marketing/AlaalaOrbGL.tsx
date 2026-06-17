'use client';

/**
 * AlaalaOrbGL — Step 2 of the Alaala orb.
 *
 * Upgrades the 2D CSS gradient sphere (AlaalaOrb) to a true 3D refractive
 * glass sphere rendered via WebGL fragment shader:
 *   · Ray-sphere intersection per pixel (orthographic projection)
 *   · Fresnel reflection/refraction (IOR 1.45 — between glass and water)
 *   · Chromatic aberration (slight R/B IOR split → convincing glass dispersion)
 *   · Video frames uploaded as a WebGL texture each rAF tick
 *   · Gold (#C5A059) rim light via Fresnel + top-left specular
 *   · Cold-start: warm gradient rendered entirely in the shader (no CSS)
 *   · Falls back to <AlaalaOrb> if WebGL context creation fails
 *
 * Same external API as AlaalaOrb — props: clips?, className?.
 * Same parallax / gyro / prefers-reduced-motion behaviour.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlaalaOrb } from './AlaalaOrb';

// ─── GLSL ─────────────────────────────────────────────────────────────────────

const VERT = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uTilt;       // -1..1 parallax/gyro offset
  uniform sampler2D uTex;    // current video frame
  uniform int   uHasVideo;   // 1 = video texture ready
  uniform float uFade;       // 0=show  1=black (clip transition)

  const float PI  = 3.14159265;
  const float IOR = 1.45;

  // Gold — #C5A059
  const vec3 GOLD = vec3(0.769, 0.627, 0.349);

  // Ray vs unit sphere at origin. Returns t of closest front hit, -1 if miss.
  float raySphere(vec3 ro, vec3 rd) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - 0.81;   // r = 0.9, r² = 0.81
    float d = b * b - c;
    if (d < 0.0) return -1.0;
    float t = -b - sqrt(d);
    return (t > 0.0) ? t : -1.0;
  }

  // Direction → spherical UV (equirectangular)
  vec2 toUV(vec3 d) {
    return vec2(
      0.5 + atan(d.z, d.x) / (2.0 * PI),
      0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI
    );
  }

  // Warm gradient rendered purely in the shader — cold-start / no-video skin.
  vec3 coldGradient(vec3 p, float t) {
    // Warm dark-brown to cool dark-blue radial gradient
    vec3 warm = vec3(0.172, 0.129, 0.098);
    vec3 cool = vec3(0.090, 0.110, 0.131);
    float d = length(p.xy - vec2(-0.22, 0.26));
    vec3 base = mix(warm, cool, smoothstep(0.0, 1.45, d));
    // Slow gold shimmer sweep
    float s = sin(t * 0.28 + p.x * 4.4 + p.y * 3.2) * 0.5 + 0.5;
    return base + GOLD * s * 0.038;
  }

  void main() {
    vec2 st = vUv * 2.0 - 1.0;          // NDC: -1..1

    // Tilt offset — shifts the screen-space ray origin slightly
    st -= uTilt * 0.07;

    // Orthographic ray — direction is always straight down Z
    vec3 ro = vec3(st, 2.0);
    vec3 rd = vec3(0.0, 0.0, -1.0);

    float t = raySphere(ro, rd);

    // Outside the sphere — fully transparent
    if (t < 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 pos = ro + rd * t;
    vec3 N   = normalize(pos);          // unit sphere → N == pos

    // ── Fresnel (Schlick) ──────────────────────────────────────────────────
    float cosTheta = max(0.0, -dot(rd, N));
    float f0 = ((IOR - 1.0) / (IOR + 1.0));
    f0 *= f0;
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosTheta, 4.0);

    // ── Primary refracted ray ──────────────────────────────────────────────
    vec3 refr = refract(rd, N, 1.0 / IOR);

    // ── Colour ────────────────────────────────────────────────────────────
    vec3 color;

    if (uHasVideo == 1) {
      // Chromatic aberration: R and B refract at slightly different IORs
      float ca = 0.022;
      vec3 refrR = normalize(refract(rd, N, 1.0 / (IOR - ca)));
      vec3 refrB = normalize(refract(rd, N, 1.0 / (IOR + ca)));

      float r = texture2D(uTex, toUV(refrR)).r;
      float g = texture2D(uTex, toUV(refr )).g;
      float b = texture2D(uTex, toUV(refrB)).b;
      color = vec3(r, g, b);

      // Clip-transition fade to deep shadow
      color = mix(color, vec3(0.05, 0.06, 0.07), uFade);
    } else {
      color = coldGradient(pos, uTime);
    }

    // ── Gold rim from Fresnel ──────────────────────────────────────────────
    color = mix(color, GOLD * 1.12, fresnel * 0.52);

    // ── Specular — tight top-left highlight (sells the 3D glass illusion) ──
    vec3 lightDir = normalize(vec3(-0.58, 0.82, 1.5));
    float spec    = pow(max(0.0, dot(reflect(rd, N), lightDir)), 90.0);
    color += vec3(1.0, 0.97, 0.93) * spec * 0.72;

    // ── Edge darkening (depth cueing) ─────────────────────────────────────
    float rim = smoothstep(0.5, 1.0, length(pos.xy));
    color = mix(color, color * 0.55, rim * 0.45);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Props = {
  clips?: string[];
  className?: string;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[AlaalaOrbGL] shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function AlaalaOrbGL({ clips = [], className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const videoRef     = useRef<HTMLVideoElement | null>(null);

  // WebGL handles (never trigger re-render — managed imperatively)
  const glRef      = useRef<WebGLRenderingContext | null>(null);
  const progRef    = useRef<WebGLProgram | null>(null);
  const texRef     = useRef<WebGLTexture | null>(null);
  const rafRef     = useRef<number>(0);
  const t0Ref      = useRef<number>(0);

  // Mutable state read by the rAF loop — avoid closure staleness
  const tiltRef    = useRef({ x: 0, y: 0 });
  const reducedRef = useRef(false);
  const activeRef  = useRef(0);
  const fadeRef    = useRef(0);        // 0 = show clip, 1 = black
  const fadingRef  = useRef(false);

  const [webglFailed, setWebglFailed] = useState(false);

  // ── prefers-reduced-motion ────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = mq.matches;
    const h = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // ── Cursor parallax ───────────────────────────────────────────────────────
  useEffect(() => {
    const section = containerRef.current?.closest('section');
    if (!section) return;
    const onMove = (e: MouseEvent) => {
      if (reducedRef.current) return;
      const r = section.getBoundingClientRect();
      tiltRef.current = {
        x: (e.clientX - r.left - r.width  / 2) / (r.width  / 2),
        y: (e.clientY - r.top  - r.height / 2) / (r.height / 2),
      };
    };
    const onLeave = () => { tiltRef.current = { x: 0, y: 0 }; };
    section.addEventListener('mousemove', onMove);
    section.addEventListener('mouseleave', onLeave);
    return () => {
      section.removeEventListener('mousemove', onMove);
      section.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // ── Gyro tilt (iOS) ───────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => {
      if (reducedRef.current || e.gamma === null) return;
      tiltRef.current = {
        x: Math.min(1, Math.max(-1, (e.gamma ?? 0) / 25)),
        y: Math.min(1, Math.max(-1, ((e.beta ?? 45) - 45) / 25)),
      };
    };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, []);

  // ── Clip advance ──────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (clips.length < 2 || fadingRef.current) return;
    fadingRef.current = true;

    // Fade out (0 → 1 over ~400 ms)
    const STEPS = 25;
    let step = 0;
    const fadeOut = () => {
      step++;
      fadeRef.current = step / STEPS;
      if (step < STEPS) {
        setTimeout(fadeOut, 16);
      } else {
        // Switch source
        activeRef.current = (activeRef.current + 1) % clips.length;
        const v = videoRef.current;
        if (v) {
          v.src = clips[activeRef.current] ?? '';
          v.currentTime = 0;
          v.play().catch(() => {});
        }
        // Fade back in
        let s2 = STEPS;
        const fadeIn = () => {
          s2--;
          fadeRef.current = s2 / STEPS;
          if (s2 > 0) {
            setTimeout(fadeIn, 16);
          } else {
            fadingRef.current = false;
          }
        };
        setTimeout(fadeIn, 16);
      }
    };
    fadeOut();
  }, [clips]);

  // ── WebGL bootstrap ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) { setWebglFailed(true); return; }
    glRef.current = gl;

    const vert = compileShader(gl, gl.VERTEX_SHADER,   VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) { setWebglFailed(true); return; }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[AlaalaOrbGL] link error:', gl.getProgramInfoLog(prog));
      setWebglFailed(true);
      return;
    }
    progRef.current = prog;
    gl.useProgram(prog);

    // Full-screen triangle pair (covers NDC -1..1)
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Video texture (1×1 black placeholder until first frame arrives)
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 12, 14, 255]));
    texRef.current = tex;
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);

    t0Ref.current = performance.now();

    // ── rAF animation loop ────────────────────────────────────────────────
    const uTime     = gl.getUniformLocation(prog, 'uTime');
    const uTilt     = gl.getUniformLocation(prog, 'uTilt');
    const uHasVideo = gl.getUniformLocation(prog, 'uHasVideo');
    const uFade     = gl.getUniformLocation(prog, 'uFade');

    const loop = () => {
      const c = canvasRef.current;
      if (!c) return;

      // Keep physical pixels in sync with CSS display size
      const dpr = window.devicePixelRatio || 1;
      const cw  = Math.round(c.clientWidth  * dpr);
      const ch  = Math.round(c.clientHeight * dpr);
      if (c.width !== cw || c.height !== ch) {
        c.width  = cw;
        c.height = ch;
        gl.viewport(0, 0, cw, ch);
      }

      // Upload video frame when a clip is ready
      const v = videoRef.current;
      const hasVideo = v && v.readyState >= 2 && clips.length > 0;
      if (hasVideo && !v.paused) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      }

      // Uniforms
      const elapsed = (performance.now() - t0Ref.current) / 1000;
      gl.uniform1f(uTime, elapsed);
      const tilt = reducedRef.current ? { x: 0, y: 0 } : tiltRef.current;
      gl.uniform2f(uTilt, tilt.x, tilt.y);
      gl.uniform1i(uHasVideo, hasVideo ? 1 : 0);
      gl.uniform1f(uFade, fadeRef.current);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(rafRef.current);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []); // bootstrap once

  // ── Video element lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (clips.length === 0) return;
    const v = document.createElement('video');
    v.muted      = true;
    v.playsInline = true;
    v.loop       = clips.length === 1; // loop single clip
    v.src        = clips[0] ?? '';
    v.onended    = advance;
    v.play().catch(() => {});
    videoRef.current = v;
    return () => {
      v.onended = null;
      v.pause();
      v.src = '';
      videoRef.current = null;
    };
  }, [clips, advance]);

  // ── Fallback to CSS orb ───────────────────────────────────────────────────
  if (webglFailed) {
    return <AlaalaOrb clips={clips} className={className} />;
  }

  return (
    <div ref={containerRef} className={`alaala-orb-root ${className}`} aria-hidden>
      {/* Ambient glow bleed (CSS — unchanged from Step 1) */}
      <div className="alaala-orb-glow" />

      {/* WebGL canvas — the sphere is rendered entirely here */}
      <canvas
        ref={canvasRef}
        className="alaala-orb-canvas"
      />

      {/* Glass specular overlay (pure CSS, top of stack) */}
      <div className="alaala-orb-glass" />

      {/* Inner rim vignette */}
      <div className="alaala-orb-vignette" />
    </div>
  );
}
