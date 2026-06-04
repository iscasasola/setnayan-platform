'use client';
/* eslint-disable @next/next/no-img-element -- the <img> is only the WebGL-parallax fallback; the
   real render is the <canvas>, and next/image's wrapper + optimization would fight the
   absolute-positioned fallback (WebGL loads the raw asset separately via new Image()). */

/*
 * Depth parallax for the welcome hero (owner 2026-06-04 "animate the background
 * making it have depth"). A WebGL fragment shader samples the EXACT welcome photo
 * with a per-pixel UV offset proportional to a depth map × a slowly auto-orbiting
 * "camera" — so near pixels (foreground / couple) shift more than far pixels (sky),
 * giving real dimensional motion from a single still.
 *
 * Bulletproof fallback: the plain <img> renders first and only hides once the
 * canvas has genuinely drawn (both textures loaded + shaders linked). If WebGL is
 * unavailable, the shader fails to compile, or the user prefers reduced motion, the
 * <img> simply stays — i.e. it degrades to the static Ken-Burns hero, never broken.
 *
 * The depth map is an approximation (vertical sky-far→ground-near gradient + a soft
 * nearer region for the couple). Swap in a true depth map (Depth-Anything/Immersity)
 * at the same path for crisp object-parallax — no code change needed.
 */

import { useEffect, useRef } from 'react';

export function WelcomeParallax({
  src,
  depthSrc,
  alt = '',
}: {
  src: string;
  depthSrc: string;
  alt?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // keep the static <img> (which still gets the CSS Ken-Burns)

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return; // no WebGL → <img> fallback stays

    const VS = 'attribute vec2 p; varying vec2 uv;' +
      'void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }';
    const FS =
      'precision mediump float; varying vec2 uv;' +
      'uniform sampler2D photo; uniform sampler2D depthMap; uniform vec2 off; uniform float zoom; uniform vec2 cover;' +
      'void main(){' +
      '  vec2 c = (uv - 0.5) * cover / zoom + 0.5;' +
      '  float d = texture2D(depthMap, c).r;' + // 0 far .. 1 near
      '  vec2 disp = (d - 0.45) * off;' + // near shifts more than far → parallax
      '  gl_FragColor = texture2D(photo, c + disp);' +
      '}';

    const compile = (type: number, source: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return; // link failed → <img> stays
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    const uOff = gl.getUniformLocation(prog, 'off');
    const uCover = gl.getUniformLocation(prog, 'cover');
    gl.uniform1f(gl.getUniformLocation(prog, 'zoom'), 1.1); // overscan so displacement never reveals edges
    gl.uniform1i(gl.getUniformLocation(prog, 'photo'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'depthMap'), 1);

    const makeTex = (unit: number): WebGLTexture | null => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 8, 12, 255]));
      return t;
    };
    const texPhoto = makeTex(0);
    const texDepth = makeTex(1);
    let loaded = 0;
    let photoW = 0;
    let photoH = 0;
    const loadInto = (url: string, unit: number, tex: WebGLTexture | null) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => {
        if (unit === 0) {
          photoW = im.naturalWidth;
          photoH = im.naturalHeight;
        }
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        loaded += 1;
      };
      im.src = url;
    };
    loadInto(src, 0, texPhoto);
    loadInto(depthSrc, 1, texDepth);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let disposed = false;
    let revealed = false;
    const start = performance.now();
    const tick = (now: number) => {
      if (disposed) return;
      const e = (now - start) / 1000;
      // aspect-correct COVER (fill, no distortion): crop the photo to the canvas aspect
      let cx = 1;
      let cy = 1;
      if (photoW && photoH && canvas.width && canvas.height) {
        const r = photoW / photoH / (canvas.width / canvas.height);
        if (r > 1) cx = 1 / r;
        else cy = r;
      }
      gl.uniform2f(uCover, cx, cy);
      gl.uniform2f(uOff, Math.sin(e * 0.18) * 0.022, Math.cos(e * 0.13) * 0.015); // slow elliptical orbit
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!revealed && loaded >= 2) {
        revealed = true;
        canvas.style.opacity = '1';
        if (img) img.style.opacity = '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [src, depthSrc]);

  return (
    <>
      <img ref={imgRef} src={src} alt={alt} className="welcome-parallax-img" />
      <canvas ref={canvasRef} className="welcome-parallax-canvas" aria-hidden="true" />
    </>
  );
}
