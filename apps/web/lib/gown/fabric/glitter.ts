/**
 * 👗 gown/fabric/glitter — glitter tulle's sparkle (prototype v200 `glitShader`, `glitMat`): tiny flakes in about one
 * cell in three, each facing its own way, bright only when it faces you. Added to a sheer cloth (a veil, a cape, an
 * overlay, a layer under the skirt). There is no time in the shader: it twinkles as the view or she turns and is
 * perfectly still when nothing moves, so the 4 fps idle frame stays identical. The GLSL is v200's own, verbatim.
 */

/** Flake cells of about 3.2 mm: the uniform's value is cells per model unit (v200 `glitMat`). 0 = off. */
export const gownGlitterScale = (S: number) => S / 0.0032;
export function gownGlitterUniform() { return { value: 0 }; }
export type GownGlitterUniform = ReturnType<typeof gownGlitterUniform>;

const HEAD = 'uniform float glitOn;\nvarying vec3 vGlP;\nfloat glH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\n';
const SPARKLE = `if (glitOn > 0.0) { vec3 gp = vGlP * glitOn, ci = floor(gp); float gh = glH(ci);   // flakes in about one cell in three; each faces its own way
    if (gh > 0.6) { vec3 fp = fract(gp) - 0.5 - (vec3(glH(ci + 1.7), glH(ci + 4.3), glH(ci + 9.1)) - 0.5) * 0.4; vec3 jit = vec3(glH(ci + 2.1), glH(ci + 5.3), glH(ci + 7.9)) * 2.0 - 1.0;
      vec3 fn = normalize(normal + jit * 0.8), gv = normalize(vViewPosition); float face = pow(max(dot(fn, gv), 0.0), 10.0), fw = length(fwidth(gp)), sz = max(0.26, fw * 0.55), dd = 1.0 - smoothstep(sz * 0.45, sz, length(fp)), far = 1.0 - 0.6 * smoothstep(0.8, 2.4, fw);
      float g = face * dd * far; outgoingLight += vec3(1.0, 0.985, 0.95) * g * 1.8; diffuseColor.a = max(diffuseColor.a, min(0.9, g)); } }
  #include <opaque_fragment>`;

/** The sparkle patch: chain it in the material's `onBeforeCompile`; the uniform's value turns it on (no recompile). */
export function gownGlitterShader(u: GownGlitterUniform) {
  return (sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) => {
    sh.uniforms.glitOn = u;
    sh.vertexShader = 'varying vec3 vGlP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlP = position;');
    sh.fragmentShader = HEAD + sh.fragmentShader.replace('#include <opaque_fragment>', SPARKLE);
  };
}
