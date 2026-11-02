/**
 * 🎛 MY PERFORMANCE'S TWO PICKERS ARE EACH ONE DROPDOWN (owner 2026-10-30, DECISION_LOG "ONE SELECTOR FOR EVERY PAGE —
 * COUPLE · SUPPLIER · ADMIN", Q1 "the segmented rows become the same ▾"; house rule "every choice is one dropdown";
 * `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §12 Step 4 "pickers").
 *
 *   · Momentum window (Daily · Monthly · Annual) — was a sliding `PillTrack`.
 *   · Service scope (All services · each active service) — was a pill tablist at ≤4 services and a native `<select>`
 *     at 5+: two looks for one choice. Now the shared `PickMenu` at every count, each option its own address.
 *
 * Source checks (each fails with the change reverted) + the scope's options built by the server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const C = join(__dirname, '_components');
const read = (f: string) => stripComments(readFileSync(join(C, f), 'utf8'));
const WINDOW = read('momentum-window-toggle.tsx');
const SCOPE = read('service-scope-selector.tsx');
const SCOPE_CLIENT = read('service-scope-select-client.tsx');

test('the Momentum window is the shared PickMenu, never a pill track', () => {
  assert.match(WINDOW, /from '@\/app\/dashboard\/\[eventId\]\/website\/editor\/_components\/pick-menu'/);
  assert.match(WINDOW, /<PickMenu[\s\S]{0,80}label="Momentum window"/);
  assert.doesNotMatch(WINDOW, /PillTrack|PillButton|role="tablist"/);
  // Solo hides Daily — kept.
  assert.match(WINDOW, /isFull \|\| w\.key !== 'day'/);
});

test('the service scope is ONE dropdown at every count — no pill tablist, no native select', () => {
  assert.doesNotMatch(SCOPE + SCOPE_CLIENT, /role="tablist"|role="tab"|<select\b|usePills|ScopePill/);
  assert.match(SCOPE_CLIENT, /<PickMenu[\s\S]{0,80}label="Filter performance by service"/);
  assert.match(SCOPE, /<ServiceScopeSelectClient value=\{activeServiceId \?\? ''\} options=\{options\} \/>/);
  // "All services" leads, and every option keeps the momentum window in its address.
  assert.match(SCOPE, /\{ key: '', label: 'All services', href: buildPerformanceHref\(\{ service: null, momentum \}\) \}/);
  assert.match(SCOPE, /href: buildPerformanceHref\(\{ service: o\.id, momentum \}\)/);
  // A pick navigates to the option's own address (Back works), never client state.
  assert.match(SCOPE_CLIENT, /router\.push\(hit\.href, \{ scroll: false \}\)/);
});
