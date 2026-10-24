## 2026-10-24 · perf(hub-veil): the falling petals hold their frame rate — no mid-lift shader re-link, a cheaper mesh update

Owner, on his phone: *"why is the veil reveal lagging. and the petal falling"*.

Measured on live `/cale-ice` (the only Pro event with the veil) at 390×844 · DPR 3, Chromium with CPU ×4
(a mid-range phone) and desktop WebKit (indicative of an iPhone):

- The veil's own `requestAnimationFrame` loop (a 3,300-particle Verlet cloth in JS, three.js render, 100 instanced
  petals) already took ~12–14 ms of every 16.7 ms frame with the veil just hanging there. The main thread was 99.7 %
  busy in every phase, so anything else cost frames — and the cloth steps a fixed 1/60 s per frame, so a dropped frame
  slows the lift itself.
- The instant the first petal fell, the petals' shader program was recompiled and re-linked (`GetProgramiv`):
  three.js creates `instanceColor` on the first `setColorAt`, and an instanced mesh with colour is a different
  program. 47–315 ms frame, every visit, exactly as the petals appear.
- After the cloth step, the next-largest cost in the loop was handing the cloth to the mesh: 3,300 `setXYZ` calls and
  three.js's generic `computeVertexNormals` — ~2 ms a frame at CPU ×4.
- In WebKit the falling-petals phase sat at ~30 fps (p50 31–35 ms: every frame just missing vsync).

Fix (same motion, timing and art — bit-identical, see the test):

- `veil-reveal.tsx` makes the petals' `instanceColor` before the mesh joins the scene, so their program is compiled
  once, at mount.
- `lib/veil-cloth.ts` (new, pure) writes the positions and builds the normals straight on the attributes'
  `Float32Array`s — the same arithmetic in the same order as three.js, so the output is EQUAL, not close.

Before → after (same harness; Chromium "after" = the live page with the patched veil chunk swapped in):

- Veil loop alone (isolated, CPU ×4, 3 runs each): 13.2–13.6 → 11.5–13.0 ms of main-thread work per frame; mesh
  update 1.8–2.0 → ~0.3 ms.
- Live, Chromium CPU ×4, falling petals: 51.7 → 54.3 fps (4 runs each), dropped frames 41 → 29; the mid-lift
  shader-link frame is gone in every run.
- Live, WebKit, falling petals: 27.8 / 28.4 / 31.7 → 50.5 / 50.5 fps; p50 frame 31–35 → 17 ms. Neither change alone
  moved it (instance colour only: 31.8 / 31.0; normals only: 32.4 / 32.1) — it takes both to get under the frame.

NOT fixed here (measured, left for an owner call): the lift itself still runs ~44 fps (Chromium ×4) / ~30 fps
(WebKit) because the page behind the veil starts on the tap — the veil hold's `body *` rule coming off restyles
~1,224 elements (60–150 ms at the tap), a later React `<script>`/`<style>` insert restyles them again through a
`:has()` selector (40–180 ms), and below-the-fold CSS animations restyle ~33 elements every frame. Moving the cloth
off the main thread (a worker) is the structural fix for the ~12 ms/frame floor.

Guarded by `apps/web/app/[slug]/_components/reveal/the-veil-keeps-the-frame.test.ts` (bit-for-bit vs three.js;
no `computeVertexNormals` / per-vertex `setXYZ` in the veil; no per-frame inline style writes in the loop beyond the
grab-zone's change-gated resize; `instanceColor` made before the first render).

SPEC IMPACT: None.
