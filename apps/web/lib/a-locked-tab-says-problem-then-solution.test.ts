/**
 * a-locked-tab-says-problem-then-solution.test.ts — 🔒 THE MAKER EDIT SHELL'S LOCKED TABS (owner-approved 2026-11-13,
 * "maker shell approved"; prototype `prototypes/approved_2026-11-13/maker-toolbar-fable.html` v3, frame 5 and the
 * Camera ruling "camera one style only.").
 *
 *   (1) every grey tool on every part has a Problem AND a Solution — never empty, never the same sentence twice;
 *   (2) a cover word's Background ends in the ONE tap that selects the Cover Scene; nothing else has a door;
 *   (3) the toolbar draws it IN THE ROWS (`ToolLock`), the tab wears 🔒, and the tap sets no tool;
 *   (4) the Camera's Style is locked with the one-style ruling, and its rows still save nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { MAKER_CAMERA_STYLE_LOCK, MAKER_COVER_SCENE, MAKER_PARTS, MAKER_PART_TOOLS, makerPartParent, makerPartToolLock, makerPartToolWorks, type MakerPartKey } from './maker-parts';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const KEYS = Object.keys(MAKER_PARTS) as MakerPartKey[];
// tsx compiles the components' JSX with the classic runtime outside Next, which reaches for a global React.
(globalThis as unknown as { React: unknown }).React = React;

test('(1) every grey tool on every part says a Problem and a Solution', () => {
  let n = 0;
  for (const k of KEYS) {
    for (const t of MAKER_PART_TOOLS) {
      if (makerPartToolWorks(k, t) && !(k === 'camera' && t === 'style')) continue;
      const lock = makerPartToolLock(k, t);
      assert.ok(lock.problem.trim().length > 8, `${k} · ${t}: no problem`);
      assert.ok(lock.solution.trim().length > 8, `${k} · ${t}: no solution`);
      assert.notEqual(lock.problem, lock.solution, `${k} · ${t}: the solution repeats the problem`);
      n++;
    }
  }
  assert.ok(n >= 40, `anti-vacuity: only ${n} locked tabs read`);
  /* A line the toolbar worked out itself (a sample on the canvas) stays the problem. */
  assert.equal(makerPartToolLock('seats', 'bg', 'A sample: each guest sees their own seat.').problem, 'A sample: each guest sees their own seat.');
});

test('(2) only a cover word’s Background has a door — the Cover Scene', () => {
  for (const k of KEYS) {
    for (const t of MAKER_PART_TOOLS) {
      const door = makerPartToolLock(k, t).door;
      if (t === 'bg' && makerPartParent(k) === MAKER_COVER_SCENE) assert.equal(door, MAKER_COVER_SCENE, `${k}: no door to the Cover Scene`);
      else assert.equal(door, null, `${k} · ${t}: a door nobody drew`);
    }
  }
  assert.match(makerPartToolLock('heroline', 'bg').problem, /sits on the Cover Scene\.$/);
});

test('(3) the toolbar draws the lock in its rows, the tab wears 🔒, and the tap sets no tool', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /if \(!toolWorks\(t\)\) return setLockTool\(t\);/);
  assert.match(tools, /<ToolLock\s+problem=\{lock\.problem\}/, 'the lock is not drawn in the rows');
  assert.match(tools, /data-stage-tool-locked=\{tabLocked\(t\) \? '' : undefined\}/);
  assert.match(tools, /\[data-stage-tool\]\[data-stage-tool-locked\]::before\{content:"🔒/, 'the locked tab does not wear its lock');
  /* …at EVERY width: the rule sits before the phone-only block, never inside it (W1 2026-11-14: missing at 1280). */
  const lockAt = tools.indexOf('[data-stage-tool-locked]::before');
  const phoneAt = tools.indexOf("@media (max-width:1023.98px){");
  assert.ok(phoneAt > 0 && lockAt > 0 && lockAt < phoneAt, 'the lock is drawn only on a phone — it must show at every width');
  /* Over the work area's body too — it stands aside while the lock is up. */
  assert.match(tools, /\[data-maker-shell\]:has\(\[data-stage-tools\]\[data-stage-locked\]\) \[data-phone-chrome="panel"\]\{visibility:hidden;pointer-events:none\}/);
  const lockFile = read(`${L}/stage-panel/tool-lock.tsx`);
  assert.match(lockFile, /label="Problem"/);
  assert.match(lockFile, />Solution</);
  assert.doesNotMatch(lockFile, /hubDraftAction|makerSave|FormData/, 'a lock saves something');
});

test('(4) the Camera keeps ONE style — its Style tab is locked and says so', async () => {
  assert.equal(makerPartToolLock('camera', 'style').problem, MAKER_CAMERA_STYLE_LOCK);
  assert.deepEqual(MAKER_PARTS.camera.layouts, { kind: 'none' });
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CameraPartNote } = await import(`../${L}/stage-panel/camera-face`);
  for (const pro of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(CameraPartNote, { pro }));
    assert.match(html, /Problem/);
    assert.match(html, /The camera has one style\./);
    assert.doesNotMatch(html, /<button[^>]*data-style/, 'a camera style can be picked');
  }
});
