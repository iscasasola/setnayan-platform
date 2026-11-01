/**
 * a-tip-wraps-in-its-own-width.test.ts — 🔒 the InfoTip bubble (`.sn-tip`) sets its OWN `white-space`, so its text
 * wraps inside its 18rem box whatever its trigger inherits.
 *
 * Walk 2026-11-01: Admin › Categories was 1,856 px wide at a 1,280 window. Each column head wraps its title (and the
 * title's ⓘ) in `whitespace-nowrap`; the tip inherited it, so every tip's text was ONE line 1,000+ px long running
 * out of its 288-px box. The tip is always laid out (hidden, not removed — `aria-describedby` must resolve), so the
 * closed tips alone widened the page into a sideways scroll, and an opened one ran off the screen.
 *
 * The property: the `.sn-tip` rule itself declares a wrapping `white-space` (normal · pre-wrap · pre-line) — a
 * declaration on the bubble beats anything inherited from any trigger, on every page that uses InfoTip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const CSS = stripComments(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));

test('the .sn-tip rule declares a wrapping white-space of its own', () => {
  const blocks = [...CSS.matchAll(/(^|\})\s*\.sn-tip\s*\{([^}]*)\}/g)].map((m) => m[2] ?? '');
  assert.ok(blocks.length > 0, 'the base `.sn-tip { … }` rule was not found in app/globals.css');
  const ws = blocks.flatMap((b) => [...b.matchAll(/white-space\s*:\s*([a-z-]+)/g)].map((m) => m[1] ?? ''));
  assert.ok(ws.length > 0, '`.sn-tip` sets no white-space — it inherits its trigger’s (a nowrap heading makes it one endless line)');
  for (const v of ws) assert.ok(['normal', 'pre-wrap', 'pre-line', 'break-spaces'].includes(v), `.sn-tip white-space: ${v} does not wrap`);
});
