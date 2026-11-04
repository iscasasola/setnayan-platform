import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * THE DROPDOWN LIST IS OPAQUE (2026-11-04).
 *
 * The shared PickMenu's open list was `.sn-glass-bare` — 86 % white over a
 * blur. Measured in WebKit at 390 px on the meeting composer's Via ▾: the
 * Meeting link, the Title box and "Send request" read straight through the
 * options. Every PickMenu in the app (it is the ONE dropdown — owner
 * 2026-09-28) drew the same see-through list. The list now sits on the solid
 * `surface` token (it flips in dark), above everything under it (z-[95]).
 *
 * What this holds: the portalled listbox's class names an opaque surface
 * (`bg-surface`), no glass class, no translucent `bg-…/NN`, no
 * backdrop blur — and keeps its z-index.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const PICK = 'app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx';

function listClass(): string {
  const src = stripComments(readFileSync(join(WEB, PICK), 'utf8'));
  const portal = src.indexOf('createPortal(');
  assert.ok(portal > 0, 'PickMenu no longer portals its list — re-point this guard');
  const ul = src.slice(portal, src.indexOf('</ul>', portal));
  assert.match(ul, /role="listbox"/, 'the portalled element is not the listbox');
  const m = ul.match(/className="([^"]+)"/);
  assert.ok(m, 'the listbox has no static className');
  return m![1]!;
}

test('the open list sits on the solid surface token, above what is under it', () => {
  const cls = listClass().split(/\s+/);
  assert.ok(cls.includes('bg-surface'), `the list is not on bg-surface: ${cls.join(' ')}`);
  assert.ok(cls.includes('z-[95]'), 'the list lost its z-index');
});

test('nothing on the open list lets the page show through', () => {
  const cls = listClass().split(/\s+/);
  for (const c of cls) {
    assert.doesNotMatch(c, /glass/, `"${c}" is a glass (translucent) layer`);
    assert.doesNotMatch(c, /^bg-[^\s]*\/\d+$/, `"${c}" is a translucent background`);
    assert.doesNotMatch(c, /backdrop/, `"${c}" blurs what is behind instead of covering it`);
    assert.doesNotMatch(c, /^opacity-/, `"${c}" fades the list`);
  }
});
