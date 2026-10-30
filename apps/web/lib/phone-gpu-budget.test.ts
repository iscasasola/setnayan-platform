/**
 * phone-gpu-budget.test.ts — a phone can never be killed by the 3D room.
 *
 * Owner, 29 Oct 2026, the installed iPhone app: *"When i pressed 3d plan"* → iOS's `"Setnayan" Crashed` dialog. The
 * seat plan's 3D room (`seating-lab-3d.tsx`, Guests › Seats › 3D) always ran the desktop tier, kept rendering every
 * frame with nothing moving, and — mounted on first open and KEPT by R4 — held its GPU context behind `hidden` while
 * 2D and List ran. Measured in WebKit at 390×844 DPR 3 on a 25-table / 230-guest plan (the size of the event that
 * crashed): GPU-process footprint ~290 MB in Build → ~140 MB with the phone tier; ~390–465 MB in Play → ~240 MB; while
 * hidden 258 MB → 103 MB with no canvas; idle draws 144–170 per 2 s → 0.
 *
 * What this holds, each a PROPERTY of the source (an anchor per component, not a word count):
 *   1. THE CAPS — `canvasDpr` caps a phone at `PHONE_3D.dprMax` (≤ 1.5) and leaves a computer alone; the phone
 *      reading covers iPhone, iPad-as-Mac, Android, the app's marker and a coarse pointer, never the desktop app.
 *   2. THE ROOM'S CANVAS — its `dpr` comes from `canvasDpr(phoneGpu, …)` (no literal range), its loop is
 *      `'demand'` on a settled phone scene with `DemandTail` inside, it is mounted only while the room has a size
 *      and WebGL is not lost, its context loss is watched (`onCreated={webgl.onCreated}`), no scene part is pinned to
 *      `quality="high"`, and the Tier B composer is off on a phone.
 *   3. THE CONTEXT-LOST LINE — the hook ignores the loss our own unmount causes (`isConnected`) and the fallback
 *      offers the 2D plan; `DemandTail` invalidates from inside the frame loop.
 *   4. THE SHARED 3D SURFACES (the Event Hub's venue walk, the 3D Plan demo) — no literal `dpr={[` and a watched
 *      context.
 *
 * SABOTAGES (2026-10-29, each run → red → restored, `git status --short` clean after):
 *   · `dprMax: 1.25` → `dprMax: 3`                                          → 1 RED
 *   · lab `dpr={canvasDpr(phoneGpu, 1.5)}` → `dpr={[1, 1.5]}`               → 2 RED
 *   · lab `frameloop={phoneGpu && sceneSettled ? 'demand' : 'always'}` → `frameloop="always"` → 2 RED
 *   · lab `{roomOnScreen && !webgl.lost ? (` → `{!webgl.lost ? (`           → 2 RED
 *   · hook `if (canvas.isConnected) setLost(true)` → `setLost(true)`         → 3 RED
 *   · lab `cinematicFx` without `&& !phoneGpu` (composer on a phone)       → 2 RED
 *
 *   5. THE FULL-SCREEN PATH (owner, iPhone app, 2026-10-30: *"3d crashed again. when i tried to press the full screen
 *      icon"*). The installed app's web view has the element Fullscreen API ON (Capacitor 8.4.3 sets
 *      `isElementFullscreenEnabled = true`; iPhone Safari has no element API at all), so the ⤢ handed the live WebGL
 *      canvas to WebKit's NATIVE full screen. On a phone the press now grows the SAME element in the page: one Canvas,
 *      one context, never remounted (no full-screen state in the Canvas's key or props, no portal), its dpr still
 *      `canvasDpr`. Measured (lab, WebKit 390×844 DPR 3, 25 tables / 230 guests): open → full → exit → full = 1 context
 *      throughout, drawing buffer 487×655 → 487×1055 → 487×655 → 487×1055 (DPR 1.25 held).
 *      Sabotages (2026-10-30, each run → red → restored): the phone branch removed from `toggleFullscreen` → test 5 RED ·
 *      `key={`${webgl.attempt}-${inPageFull}`}` on the Canvas → tests 2 + 5 RED · a `createPortal` import in the room →
 *      test 5 RED.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHONE_3D, canvasDpr, phoneGpuFrom } from './phone-gpu-budget';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const LAB = 'app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx';
const HOOKS = 'app/_components/plan3d/phone-gpu-budget.tsx';
const SHARED = ['app/[slug]/venue/_components/guest-venue-3d.tsx', 'app/_components/plan3d/plan3d-scene.tsx'];

/**
 * Every `<Canvas …>` opening tag WITH PROPS in a file (up to the first `>` that closes the tag at depth 0 of `{}`). A
 * bare `<Canvas>` is how the comments name it; every real Canvas here carries props.
 */
function canvasTags(src: string): string[] {
  const out: string[] = [];
  const next = (from: number) => {
    const m = /<Canvas\s/.exec(src.slice(from));
    return m ? from + m.index : -1;
  };
  let i = next(0);
  while (i !== -1) {
    let depth = 0;
    let j = i + '<Canvas'.length;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(src.slice(i, j + 1));
    i = next(j);
  }
  return out;
}

const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

test('1 · the caps: a phone is capped, a computer is not', () => {
  assert.ok(PHONE_3D.dprMax <= 1.5, `phone DPR cap ${PHONE_3D.dprMax} must be ≤ 1.5`);
  assert.equal(PHONE_3D.quality, 'low');
  assert.deepEqual(canvasDpr(true, 1.5), [1, PHONE_3D.dprMax]);
  assert.deepEqual(canvasDpr(true, 2), [1, PHONE_3D.dprMax]);
  assert.deepEqual(canvasDpr(false, 1.5), [1, 1.5]);
  assert.deepEqual(canvasDpr(false, 2), [1, 2]);

  assert.equal(phoneGpuFrom(UA_IPHONE, 5, true), true, 'iPhone');
  assert.equal(phoneGpuFrom(`${UA_IPHONE} SetnayanApp SetnayanSignIn/1 SetnayanIAP/2`, 5, true), true, 'the iOS app');
  assert.equal(phoneGpuFrom(UA_MAC, 5, false), true, 'an iPad that says Macintosh');
  assert.equal(phoneGpuFrom('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile', 5, true), true, 'Android');
  assert.equal(phoneGpuFrom(UA_MAC, 0, false), false, 'a Mac');
  assert.equal(phoneGpuFrom(`${UA_MAC} SetnayanApp/desktop`, 0, false), false, 'the desktop app is not a phone');
  assert.equal(phoneGpuFrom('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, true), true, 'a coarse pointer');
});

test("2 · the seat plan's 3D room: capped, on-demand, unmounted while hidden, context watched", () => {
  const src = read(LAB);
  const tags = canvasTags(src);
  assert.equal(tags.length, 1, `the room draws ONE Canvas (found ${tags.length})`);
  const tag = tags[0]!;
  assert.match(tag, /dpr=\{canvasDpr\(phoneGpu,\s*[\d.]+\)\}/, 'dpr comes from canvasDpr(phoneGpu, …)');
  assert.doesNotMatch(tag, /dpr=\{\[/, 'no literal dpr range');
  assert.match(tag, /frameloop=\{phoneGpu && sceneSettled \? 'demand' : 'always'\}/, "a settled phone scene draws on demand");
  assert.match(tag, /onCreated=\{webgl\.onCreated\}/, 'the context is watched');
  assert.match(tag, /key=\{webgl\.attempt\}/, '"Try 3D again" mounts a fresh Canvas');

  // The Canvas sits inside the on-screen + not-lost gate, and DemandTail rides inside it on a phone.
  const at = src.indexOf(tag);
  const before = src.slice(Math.max(0, at - 120), at);
  assert.match(before, /\{roomOnScreen && !webgl\.lost \? \(\s*$/, 'the Canvas mounts only while the room has a size and WebGL is not lost');
  assert.match(src, /const roomOnScreen = useHasSize\(wrapperRef\);/);
  assert.match(src.slice(at + tag.length, at + tag.length + 200), /\{phoneGpu \? <DemandTail busy=\{!sceneSettled\} \/> : null\}/);
  assert.match(src, /\{webgl\.lost \? \(\s*<ContextLostNotice/, 'a lost context shows the honest line');

  // No scene part pinned to the desktop tier; the Tier B composer is off on a phone.
  assert.doesNotMatch(src, /quality="high"/, 'quality comes from sceneQuality');
  assert.match(src, /const sceneQuality = phoneGpu \? PHONE_3D\.quality : 'high';/);
  assert.match(src, /const cinematicFx = [^;]*&& !phoneGpu;/, 'no postprocessing composer on a phone');
});

test('3 · the context-lost hook and the demand tail', () => {
  const src = read(HOOKS);
  assert.match(src, /addEventListener\('webglcontextlost', onLost\)/);
  assert.match(src, /if \(canvas\.isConnected\) setLost\(true\);/, 'our own unmount (forceContextLoss) is not a failure');
  assert.match(src, /new ResizeObserver\(read\)/);
  assert.match(src, /el\.clientWidth > 0 && el\.clientHeight > 0/);
  assert.match(src, /useFrame\(\(\) => \{\s*if \(busyRef\.current \|\| performance\.now\(\) < until\.current\) invalidate\(\);/);
  assert.match(src, />\s*Show 2D\s*</, 'the fallback offers the 2D plan');
});

test('4 · the shared 3D surfaces (Event Hub venue walk, 3D Plan demo): capped and watched', () => {
  for (const rel of SHARED) {
    const src = read(rel);
    const tags = canvasTags(src);
    assert.ok(tags.length >= 1, `${rel}: a Canvas`);
    for (const tag of tags) {
      assert.doesNotMatch(tag, /dpr=\{\[/, `${rel}: no literal dpr range`);
      assert.match(tag, /dpr=\{canvasDpr\(phoneGpu,\s*[\d.]+\)\}/, `${rel}: dpr from canvasDpr`);
      assert.match(tag, /onCreated=\{webgl\.onCreated\}/, `${rel}: context watched`);
    }
    assert.match(src, /\{webgl\.lost \? <ContextLostNotice onRetry=\{webgl\.retry\} \/> : null\}/, `${rel}: honest line`);
  }
});

test('5 · full screen on a phone: the same Canvas grows in the page — never the Fullscreen API, never a second context', () => {
  const src = read(LAB);
  // The toggle: a phone flips the in-page state and RETURNS before any Fullscreen API call.
  const at = src.indexOf('const toggleFullscreen = useCallback(');
  assert.ok(at > -1, 'toggleFullscreen moved — this guard is blind');
  const body = src.slice(at, src.indexOf('}, [phoneGpu]);', at));
  assert.ok(body.length > 0 && body.length < 2000, 'toggleFullscreen no longer ends on [phoneGpu] — read it again');
  const phone = body.search(/if \(phoneGpu\) \{\s*setInPageFull\(\(v\) => !v\);\s*return;\s*\}/);
  const api = body.search(/requestFullscreen/);
  assert.ok(phone > -1, 'a phone does not take the in-page full screen');
  assert.ok(api > phone, 'the Fullscreen API is reachable on a phone (the phone branch must return first)');

  // The in-page full screen is the wrapper's own class — the SAME element, so the SAME Canvas.
  assert.match(src, /ref=\{wrapperRef\}\s*data-room-fullscreen=\{inPageFull \? 'in-page' : undefined\}/);
  assert.match(src, /inPageFull\s*\?\s*'fixed inset-0 /, 'the in-page full screen is a fixed box over the viewport');

  // One Canvas whose identity and pixel ratio know nothing of full screen: no remount, no escape from the cap.
  const tags = canvasTags(src);
  assert.equal(tags.length, 1, 'one Canvas');
  assert.doesNotMatch(tags[0]!, /inPageFull|isFullscreen/, 'full screen reaches the Canvas (a remount, or a dpr outside the cap)');
  assert.match(tags[0]!, /key=\{webgl\.attempt\}/);
  assert.match(tags[0]!, /dpr=\{canvasDpr\(phoneGpu,\s*[\d.]+\)\}/);
  assert.doesNotMatch(src, /createPortal/, 'a portal would move the room — React remounts the Canvas, a second WebGL context');
  // The mount gate is the size + lost gate only — full screen never unmounts it.
  assert.doesNotMatch(src.slice(Math.max(0, src.indexOf(tags[0]!) - 120), src.indexOf(tags[0]!)), /inPageFull|isFullscreen/);
});
