/**
 * Owner, 2026-11-05 (DECISION_LOG "THE 15 'ACT FIRST' ITEMS", item 11): Live Studio asks before going live.
 *
 * Walks every client file under `app/` that CALLS a go-live action — `goLivePanood(` (the one-tap YouTube go-live)
 * or the older room's `setLive(eventId, …)` — and holds it to the shared question in `live-studio-go-live-confirm.ts`.
 * A new Go live button that forgets to ask fails here, by file name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GO_LIVE_CONFIRM } from './live-studio-go-live-confirm';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}


// `setLive(eventId` is the older room's action; a bare `setLive(` is also a common React state setter.
const CALLS = /\bgoLivePanood\(|\bsetLive\(eventId\b/;

const callers = walk(join(WEB, 'app'))
  .map((p) => ({ rel: relative(WEB, p), src: stripComments(readFileSync(p, 'utf8')) }))
  .filter((f) => CALLS.test(f.src));

test('the go-live callers are found (an empty walk would pass vacuously)', () => {
  const names = callers.map((c) => c.rel).sort();
  for (const expected of [
    'app/panood/control/[eventId]/transport-row.tsx',
    'app/dashboard/[eventId]/studio/panood/setup/go-live-card.tsx',
    'app/dashboard/[eventId]/_components/home-cards/live-air-button.tsx',
    'app/dashboard/[eventId]/studio/panood/broadcast/control-room.tsx',
  ]) {
    assert.ok(names.includes(expected), `${expected} no longer calls a go-live action — update this list`);
  }
});

test('every Go live button asks GO_LIVE_CONFIRM first', () => {
  for (const { rel, src } of callers) {
    assert.match(src, /confirm\(GO_LIVE_CONFIRM\)/, `${rel} goes live without asking "${GO_LIVE_CONFIRM.title}"`);
    assert.match(src, /\{dialog\}/, `${rel} asks but never renders the confirm box`);
    const ask = src.indexOf('confirm(GO_LIVE_CONFIRM)');
    const call = src.search(CALLS);
    assert.ok(ask > -1 && ask < call, `${rel} must ask before it calls the go-live action`);
  }
});

test('the question says nothing about money or a day being used up (LS6: one unlock per event, no clock)', () => {
  const words = `${GO_LIVE_CONFIRM.title} ${GO_LIVE_CONFIRM.body}`.toLowerCase();
  for (const stale of ['₱', 'day', 'charge', 'pay', 'website', 'celebration']) {
    assert.ok(!words.includes(stale), `the go-live question must not say "${stale}"`);
  }
});
