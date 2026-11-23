/**
 * 🛡 THE DASHBOARD GATE DOES NOT STRETCH HOME (review of #7988, 18 Nov 2026).
 *
 * Home moved under the (hub) layout, so `app/dashboard/layout.tsx`'s gate now renders INSIDE the hub's
 * `<main class="sn-vt-page">`, below the fixed top bar. Its `min-h-dvh` then adds a full screen under the bar, so a short
 * Home always scrolls; its `bg-page` covers the hub's ambient wash. Every other /dashboard page mounts the gate as the
 * outer box, where both stay right.
 *
 * Why no prop: a layout's default export may take only `children`, its slots and `params` — Next's generated
 * `checkFields<Diff<LayoutProps, …>>` fails the build on any other prop. So the hub mount is told apart by where it sits:
 * the gate is the direct child of the hub's `<main class="sn-vt-page">` and nowhere else.
 *
 * SABOTAGE: drop either `[main.sn-vt-page>&]` class → red · wrap `{children}` in the hub `<main>` in another element
 * (the selector would stop matching) → red · add `sn-vt-page` to the dashboard gate's own tree above it → n/a (no main).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const APP = join(import.meta.dirname, '..');
const code = (...p: string[]) => stripComments(readFileSync(join(APP, ...p), 'utf8'));

test('in the hub mount the gate is as tall as its content and paints no background', () => {
  const gate = code('dashboard', 'layout.tsx');
  const cls = gate.match(/className="(app-surface [^"]*)"/)?.[1] ?? '';
  assert.match(cls, /\bmin-h-dvh\b/, 'every other /dashboard page keeps a full-height gate');
  assert.match(cls, /\[main\.sn-vt-page>&\]:min-h-0/, 'inside the hub <main> the gate still adds a screen under the bar');
  assert.match(cls, /\[main\.sn-vt-page>&\]:bg-transparent/, 'inside the hub <main> the gate paints over the ambient wash');
});

test('the selector matches: the gate is the direct child of the hub <main class="sn-vt-page">', () => {
  const hub = code('(hub)', 'layout.tsx');
  assert.match(hub, /<main\s+className="sn-vt-page[^"]*"[^>]*>\s*\{children\}/, 'something now sits between the hub <main> and the gate');
  // The (hub)/dashboard layout renders the gate as its root, adding no element above it.
  const mid = code('(hub)', 'dashboard', 'layout.tsx');
  assert.match(mid, /return \(\s*<DashboardLayout>/);
});
