/**
 * paint-webgl.ts — WebGL2 wax-seal painter (0024 §3 upgrade).
 *
 * Drop-in upgrade over the Canvas-2D `paintWaxSeal`: the same deterministic
 * recipe (same seed → same puddle shape), but rendered with a Phong-lit dome
 * + a height-field normal map driven by the die texture — so the embossed
 * monogram has genuine 3D depth instead of the shifted-copy pixel trick.
 *
 * Public API:
 *   initWaxSealGL(canvas)             → WaxSealGLState | null   (once per canvas)
 *   buildDieForGL(svg, text)          → Promise<HTMLCanvasElement | null>
 *   paintWaxSealWebGL(state, opts)    → void  (sync, per-frame safe)
 *
 * Falls back gracefully: initWaxSealGL returns null when WebGL2 is unavailable
 * (old browsers, privacy-locked contexts) — callers fall through to Canvas-2D.
 */

import { mulberry32, type WaxFinish, type WaxSealConfig } from './types';

// ── Shaders ──────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `#version 300 es
in  vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv        = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

in  vec2 v_uv;
out vec4 fragColor;

// ── recipe uniforms ─────────────────────────────────────────────────────────
uniform float u_amount;
uniform float u_irregularity;
uniform float u_crispness;
uniform float u_depth;
uniform vec2  u_offset;   // press.offset [-1,1]
uniform float u_skew;     // press.skew   [-1,1]
uniform vec3  u_wax;      // sRGB [0,1]
uniform int   u_glossy;   // 1 = glossy, 0 = matte
uniform int   u_pressed;  // 1 = show emboss, 0 = molten puddle only

// ── puddle shape (precomputed from seed in JS) ──────────────────────────────
uniform float u_baseR;              // base radius in normalised [-1,1] space
uniform float u_ph1, u_ph2, u_ph3; // seeded Fourier phase offsets
uniform float u_noise[64];          // 64 seeded per-angle wobble values

// ── monogram die ───────────────────────────────────────────────────────────
uniform sampler2D u_die;
uniform int       u_hasDie;  // 1 when a real die is loaded

// ── bubbles ────────────────────────────────────────────────────────────────
uniform int  u_nbub;
uniform vec3 u_bub[8];   // .xy = centre, .z = radius (all in [-1,1] space)

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// ── puddle boundary radius at angle theta ───────────────────────────────────
float puddleR(float theta) {
  // smooth-interpolate the 64 seeded noise samples along the perimeter
  float t   = mod((theta + PI) / TAU, 1.0) * 64.0;
  int   i0  = int(t) % 64;
  int   i1  = (i0 + 1) % 64;
  float nv  = mix(u_noise[i0], u_noise[i1], fract(t));
  return u_baseR * (
      1.0
    + u_irregularity * 0.085 * sin(theta * 3.0 + u_ph1)
    + u_irregularity * 0.050 * sin(theta * 5.0 + u_ph2)
    + u_irregularity * 0.030 * sin(theta * 8.0 + u_ph3)
    + nv
  );
}

// ── UV into the die texture at normalised pos p ─────────────────────────────
// Matches tintedMark() from paint.ts: centred at press-offset, scale ±baseR*1.5,
// rotated by skew.  (WebGL uploads die with UNPACK_FLIP_Y_WEBGL so y maps correctly.)
vec2 dieUV(vec2 p) {
  vec2  c   = u_offset * u_baseR * 0.12;      // offset in [-1,1] space
  vec2  d   = p - c;
  float ang = u_skew * 0.08;
  float ca  = cos(ang), sa = sin(ang);
  d = vec2(d.x * ca - d.y * sa,
           d.x * sa + d.y * ca);
  return d / (2.0 * u_baseR * 1.5) + 0.5;    // → [0,1] die UV
}

// ── combined wax height field ───────────────────────────────────────────────
// Returns 0 outside the puddle.  withDie = include the pressed monogram.
float waxHeight(vec2 p, bool withDie) {
  float theta = atan(p.y, p.x);
  float r     = length(p);
  float R     = puddleR(theta);
  if (r >= R) return 0.0;

  float t = r / R;   // 0 = centre, 1 = edge

  // cosine dome — flat crown, curving gently down to the rim
  float dome = 0.5 * (cos(t * PI) + 1.0);

  // displaced-wax rim bulge (wax pushed outward by the stamp press)
  float rim = 0.18 * exp(-pow((t - 0.87) / 0.055, 2.0));

  float h = dome + rim;

  // pressed monogram: die alpha → depression (lower = further in)
  if (withDie && u_pressed == 1 && u_hasDie == 1) {
    vec2 uv = dieUV(p);
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      float die = texture(u_die, uv).a;
      h -= die * u_depth * u_crispness * 0.30;
    }
  }

  return h;
}

void main() {
  // normalised [-1,1] space, y-up
  vec2  p     = v_uv * 2.0 - 1.0;
  float theta = atan(p.y, p.x);
  float r     = length(p);
  float R     = puddleR(theta);

  // ── anti-aliased puddle edge ────────────────────────────────────────────
  float sdf   = R - r;                        // positive inside
  float aa    = fwidth(r) * 1.5;
  float alpha = smoothstep(-aa, aa, sdf);
  if (alpha < 0.001) discard;

  // ── surface normal via central-difference height field ──────────────────
  // N = cross(dPos/dx, dPos/dy) = (-dh/dx, -dh/dy, 1), normalised.
  // Central diffs: dh/dx ≈ (h(p+ε,0) - h(p-ε,0))/(2ε), so
  //   N_x = (h(p-ε,0) - h(p+ε,0)) / (2ε)  → (hL - hR)/(2ε)
  float eps = 0.005;   // ~½ pixel at 280 px canvas, ~¼ px at 560 px device
  float hL  = waxHeight(p - vec2(eps, 0.0),  true);
  float hR  = waxHeight(p + vec2(eps, 0.0),  true);
  float hD  = waxHeight(p - vec2(0.0, eps),  true);
  float hU  = waxHeight(p + vec2(0.0, eps),  true);
  vec3  N   = normalize(vec3(hL - hR, hD - hU, 2.0 * eps));

  // ── Phong lighting — soft point light from upper-left ───────────────────
  vec3  L = normalize(vec3(-0.28, 0.32, 1.0));   // matches Canvas-2D gradient centre
  vec3  V = vec3(0.0, 0.0, 1.0);                 // orthographic viewer
  vec3  H = normalize(L + V);

  float diff     = max(0.0, dot(N, L));
  float shininess = u_glossy == 1 ? 80.0 : 14.0;
  float spec     = pow(max(0.0, dot(N, H)), shininess);
  float specStr  = u_glossy == 1 ? 0.65 : 0.20;

  // ── wax colour with edge SSS stand-in ──────────────────────────────────
  // Wax is slightly translucent: thin edges glow a little warmer.
  float t      = r / max(R, 0.001);
  float thin   = 1.0 - smoothstep(0.80, 1.0, t);
  vec3  albedo = u_wax * (1.0 + 0.40 * (1.0 - thin));  // glow near rim

  vec3 color = albedo * (0.22 + diff * 0.80) + vec3(spec * specStr);

  // ── glossy: tight elliptical specular hotspot ───────────────────────────
  if (u_glossy == 1) {
    vec2  hp = p - vec2(-0.28 * u_baseR, 0.36 * u_baseR);
    float g  = exp(-(hp.x * hp.x + hp.y * hp.y * 2.4) / (0.013 * u_baseR * u_baseR));
    color += vec3(g * 0.50);
  }

  // ── micro-bubbles ───────────────────────────────────────────────────────
  vec3 darkWax  = u_wax * 0.70;
  vec3 lightWax = mix(u_wax, vec3(1.0), 0.35);
  for (int i = 0; i < 8; i++) {
    if (i >= u_nbub) break;
    float bd = length(p - u_bub[i].xy);
    if (bd < u_bub[i].z) {
      // dark body
      color = mix(color, darkWax, 0.55 * (1.0 - smoothstep(0.82, 1.0, bd / u_bub[i].z)));
    }
    // bright highlight dot (offset upper-left inside the bubble)
    vec2  hpos = u_bub[i].xy - u_bub[i].z * 0.3;
    float hd   = length(p - hpos);
    if (hd < u_bub[i].z * 0.5) {
      color = mix(color, lightWax, 0.70 * (1.0 - hd / (u_bub[i].z * 0.5)));
    }
  }

  // ── displaced-wax rim highlight (bright ring at the puddle edge) ─────────
  float rimFactor = exp(-pow((t - 0.93) / 0.028, 2.0));
  color += u_wax * rimFactor * 0.28;

  fragColor = vec4(clamp(color, 0.0, 1.8), alpha);
}`;

// ── WebGL state ───────────────────────────────────────────────────────────────

export type WaxSealGLState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  uloc: Map<string, WebGLUniformLocation | null>;
  dieTex: WebGLTexture;
  dieSrc: HTMLCanvasElement | null;   // last uploaded source (identity check)
};

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[WaxGL] shader compile error:\n', gl.getShaderInfoLog(s));
    }
    gl.deleteShader(s);
    return null;
  }
  return s;
}

/**
 * Initialise a WebGL2 context on `canvas` and compile the wax-seal program.
 * Returns null when WebGL2 is unavailable (browser support, privacy settings) or
 * shader compilation fails — callers should fall back to Canvas-2D paintWaxSeal.
 *
 * Call once per canvas element; reuse the returned state for all subsequent paints.
 */
export function initWaxSealGL(canvas: HTMLCanvasElement): WaxSealGLState | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[WaxGL] link error:\n', gl.getProgramInfoLog(prog));
    }
    return null;
  }

  // full-screen quad VAO
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // gather uniform locations
  const uNames = [
    'u_amount', 'u_irregularity', 'u_crispness', 'u_depth',
    'u_offset', 'u_skew', 'u_wax', 'u_glossy', 'u_pressed',
    'u_baseR', 'u_ph1', 'u_ph2', 'u_ph3',
    'u_noise[0]',
    'u_die', 'u_hasDie',
    'u_nbub', 'u_bub[0]',
  ] as const;
  gl.useProgram(prog);
  const uloc = new Map<string, WebGLUniformLocation | null>();
  for (const name of uNames) uloc.set(name, gl.getUniformLocation(prog, name));
  // texture unit 0 is permanent for u_die
  gl.uniform1i(uloc.get('u_die') ?? null, 0);

  // 1×1 transparent placeholder die texture
  const dieTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, dieTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return { gl, program: prog, vao, uloc, dieTex, dieSrc: null };
}

// ── Die canvas ────────────────────────────────────────────────────────────────

/** Render monogram text as a white-on-transparent canvas for use as a die. */
function buildTextDie(text: string, res = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = res;
  c.height = res;
  const t = c.getContext('2d')!;
  t.fillStyle = '#fff';
  t.font = `italic ${Math.round(res * 0.38)}px Georgia, "Times New Roman", serif`;
  t.textAlign = 'center';
  t.textBaseline = 'middle';
  t.fillText(text || '✦', res / 2, res / 2);
  return c;
}

/**
 * Build the die canvas used by the WebGL painter.
 * Handles both SVG marks and lettered fallback.
 * Always returns a canvas (never null) — falls back to the lettered die on
 * any SVG error, so the shader always has something to sample.
 */
export async function buildDieForGL(
  markSvg: string | null,
  monogramText: string,
  res = 256,
): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') return buildTextDie(monogramText, res);

  if (!markSvg) return buildTextDie(monogramText, res);

  const isRaster = /<image[\s/>]/i.test(markSvg);
  const img = new Image();
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(markSvg)}`;
  });
  if (!ok) return buildTextDie(monogramText, res);

  const c = document.createElement('canvas');
  c.width = res;
  c.height = res;
  const t = c.getContext('2d')!;
  const iw = img.naturalWidth || res;
  const ih = img.naturalHeight || res;
  const k = Math.min(res / iw, res / ih) * 0.92;
  t.drawImage(img, (res - iw * k) / 2, (res - ih * k) / 2, iw * k, ih * k);

  if (isRaster) {
    let data: ImageData;
    try { data = t.getImageData(0, 0, res, res); }
    catch { return buildTextDie(monogramText, res); }
    const px = data.data;
    let kept = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!, g = px[i + 1]!, b = px[i + 2]!, a = px[i + 3]!;
      if (a > 12 && (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.62) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 255;
        kept++;
      } else {
        px[i + 3] = 0;
      }
    }
    if (kept < res * res * 0.002) return buildTextDie(monogramText, res);
    t.putImageData(data, 0, 0);
  } else {
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = '#fff';
    t.fillRect(0, 0, res, res);
  }
  return c;
}

// ── Painter ───────────────────────────────────────────────────────────────────

export type WaxGLPaintOpts = {
  config: WaxSealConfig | null;
  mark: HTMLCanvasElement | null;   // die canvas from buildDieForGL; null → no emboss
  monogramText: string;
  waxColor: string;                 // hex (resolved: config override ?? moodboard accent)
  finish: WaxFinish;
  seed: number;
  size: number;                     // CSS-pixel diameter of the canvas element
  dpr: number;
  pressed?: boolean;                // false = pour/cool beats (show puddle only)
};

const N_CTL = 64;

function parseHexRGB(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const n = parseInt(m?.[1] ?? '5c2542', 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Render one frame of the wax seal via WebGL2.
 * Syncs recipe uniforms and the die texture on every call; GL draw is fast.
 */
export function paintWaxSealWebGL(state: WaxSealGLState, opts: WaxGLPaintOpts): void {
  const { gl, program, vao, uloc, dieTex } = state;
  const { config, mark, waxColor, finish, seed, size, dpr } = opts;

  // resize backing store if needed
  const S  = Math.max(1, Math.round(size * dpr));
  const cv = gl.canvas as HTMLCanvasElement;
  if (cv.width !== S || cv.height !== S) { cv.width = S; cv.height = S; }

  // upload die texture when the source changes (identity check)
  if (mark !== state.dieSrc) {
    gl.bindTexture(gl.TEXTURE_2D, dieTex);
    if (mark) {
      // Y-flip so Canvas-2D y-down → WebGL y-up coords match tintedMark()
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mark);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0]));
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    state.dieSrc = mark;
  }

  // extract recipe levers (mirrors Canvas-2D defaults exactly)
  const amount = config?.pour.amount       ?? 0.6;
  const irr    = config?.pour.irregularity ?? 0.3;
  const bubbles= config?.pour.bubbles      ?? 0;
  const crisp  = config?.press.crispness   ?? 0.7;
  const depth  = config?.press.depth       ?? 0.7;
  const offset = config?.press.offset      ?? [0, 0] as [number, number];
  const skew   = config?.press.skew        ?? 0;
  const pressed= opts.pressed !== false ? 1 : 0;

  // ── pre-compute puddle shape from seed ────────────────────────────────
  // MUST drive mulberry32 in the same order as Canvas-2D paintWaxSeal so that
  // given the same seed the WebGL puddle outline matches the Canvas-2D one.
  const rnd   = mulberry32(seed);
  const ph1   = rnd() * Math.PI * 2;
  const ph2   = rnd() * Math.PI * 2;
  const ph3   = rnd() * Math.PI * 2;
  const noise = new Float32Array(N_CTL);
  for (let i = 0; i < N_CTL; i++) noise[i] = (rnd() - 0.5) * irr * 0.02;

  // base radius in normalised [-1,1] space (mirrors: R = S*0.3*(0.86+amount*0.28))
  const baseR = 2 * 0.3 * (0.86 + amount * 0.28);

  // ── bubble positions ────────────────────────────────────────────────────
  const nbub = bubbles > 0 ? Math.round(bubbles * 8) : 0;
  const bubData = new Float32Array(8 * 3);
  for (let i = 0; i < nbub; i++) {
    const a  = rnd() * Math.PI * 2;
    const rr = rnd() * baseR * 0.78;
    bubData[i * 3]     = Math.cos(a) * rr;
    bubData[i * 3 + 1] = Math.sin(a) * rr;
    // Canvas-2D br = S*(0.006+rnd()*0.01); in [-1,1] space that's *2
    bubData[i * 3 + 2] = (0.006 + rnd() * 0.01) * 2;
  }

  const [wr, wg, wb] = parseHexRGB(waxColor);

  // ── draw ────────────────────────────────────────────────────────────────
  gl.viewport(0, 0, S, S);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(program);

  const u = (name: string) => uloc.get(name) ?? null;
  gl.uniform1f(u('u_amount'),       amount);
  gl.uniform1f(u('u_irregularity'), irr);
  gl.uniform1f(u('u_crispness'),    crisp);
  gl.uniform1f(u('u_depth'),        depth);
  gl.uniform2f(u('u_offset'),       offset[0], offset[1]);
  gl.uniform1f(u('u_skew'),         skew);
  gl.uniform3f(u('u_wax'),          wr, wg, wb);
  gl.uniform1i(u('u_glossy'),       finish === 'glossy' ? 1 : 0);
  gl.uniform1i(u('u_pressed'),      pressed);
  gl.uniform1f(u('u_baseR'),        baseR);
  gl.uniform1f(u('u_ph1'),          ph1);
  gl.uniform1f(u('u_ph2'),          ph2);
  gl.uniform1f(u('u_ph3'),          ph3);
  gl.uniform1fv(u('u_noise[0]'),    noise);
  gl.uniform1i(u('u_hasDie'),       mark ? 1 : 0);
  gl.uniform1i(u('u_nbub'),         nbub);
  gl.uniform3fv(u('u_bub[0]'),      bubData);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, dieTex);

  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}
