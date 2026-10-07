/**
 * 📥 THE REQUESTS ROWS STAY OUT OF THE MAKER'S FIRST LOAD.
 *
 * The Maker's page imports the Requests page (`launch/page.tsx` → `guests/claims/page.tsx`: RSVP ›
 * Requests draws it in place). A server page's static import of a client part puts that part in
 * the importing ROUTE's first load whether it is drawn or not — so the three client parts of the
 * Requests rows (Link ▾, the Keep quick add, Send invite) rode every cold open of the Maker:
 * 7.3 KB gzipped, measured 2026-10-08 on the train (509.5 KB against the 507 KB ceiling, which is
 * never raised — `scripts/check-maker-js-budget.mjs`).
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────
 *   1. The Requests page reaches the three parts ONLY through the lazy door
 *      (`_components/guest-setup/guest-setup-lazy.tsx`) — no static import of their files.
 *   2. The door loads each from its own file, in a chunk of its own.
 *   3. The door is one `MAKER_TOOLS` loads and warms whole, so the parts are still downloaded at
 *      idle (owner 2026-10-02: every tool is preloaded) — `maker-tools-are-all-preloaded.test.ts`
 *      then holds the walk.
 *   4. The page still mounts all three (the lazy door changed where they load, not what is drawn).
 *
 * 🛡 Sabotaged once each (2026-10-08), each red alone: `import { SendInviteActions } from
 * '../_components/send-invite'` put back in the page → 1; a door line pointed at another file → 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVENT = join(HERE, '..', '..');
const read = (...p: string[]) => stripComments(readFileSync(join(EVENT, ...p), 'utf8'));
const PAGE = read('guests', 'claims', 'page.tsx');
const DOOR = read('_components', 'guest-setup', 'guest-setup-lazy.tsx');
const TOOLS = read('launch', '_components', 'maker-tools.tsx');
const MAKER = read('launch', 'page.tsx');

const PARTS = [
  ['LinkPicker', '../../guests/claims/link-picker', /from '\.\/link-picker'/],
  ['KeepQuickAdd', '../../guests/claims/keep-quick-add', /from '\.\/keep-quick-add'/],
  ['SendInviteActions', '../../guests/_components/send-invite', /from '\.\.\/_components\/send-invite'/],
] as const;

test('anti-vacuity: the Maker still imports the Requests page — the chain this guard is about', () => {
  assert.match(MAKER, /import RequestsPage from '\.\.\/guests\/claims\/page';/, 'the Maker no longer imports the Requests page — this guard has nothing to hold');
  assert.match(MAKER, /<RequestsPage\b/, 'the Maker no longer draws the Requests rows');
});

test('1 · the Requests page reaches its three client parts only through the lazy door', () => {
  assert.match(
    PAGE,
    /import \{ KeepQuickAdd, LinkPicker, SendInviteActions \} from '\.\.\/\.\.\/_components\/guest-setup\/guest-setup-lazy';/,
    'the Requests page does not take its client parts from the lazy door',
  );
  for (const [name, , direct] of PARTS) {
    assert.doesNotMatch(PAGE, direct, `the Requests page imports ${name} straight from its file — it is back in the Maker's first load`);
  }
});

test('2 · the door loads each part from its own file, in a chunk of its own', () => {
  const raw = readFileSync(join(EVENT, '_components', 'guest-setup', 'guest-setup-lazy.tsx'), 'utf8');
  for (const [name, file] of PARTS) {
    assert.ok(
      raw.includes(`import(/* webpackChunkName: "maker-guest-requests" */ '${file}').then((m) => m.${name})`),
      `the lazy door does not load ${name} from ${file} in the requests chunk`,
    );
    assert.match(DOOR, new RegExp(String.raw`export const ${name} = dynamic\(`), `${name} is not a next/dynamic stand-in`);
  }
  assert.doesNotMatch(DOOR, /^import [^;]*from '\.\.\/\.\.\/guests\//m, 'the door imports a Guests part statically — that is the first load again');
});

test('3 · the door is one MAKER_TOOLS loads and warms whole — the parts are still preloaded at idle', () => {
  assert.match(
    TOOLS,
    /import\(\s*'\.\.\/\.\.\/_components\/guest-setup\/guest-setup-lazy'\)\.then\(warmDynamicExports\)/,
    'MAKER_TOOLS no longer loads and warms the lazy Guests door',
  );
});

test('4 · the Requests page still mounts all three', () => {
  for (const [name] of PARTS) assert.match(PAGE, new RegExp(String.raw`<${name}\b`), `the Requests page no longer mounts <${name}>`);
});
