/**
 * guest-import-opens-dec-19.test.ts — 📥 GUEST IMPORT OPENS DECEMBER 19, LIKE EVENT CREATION (DECISION_LOG 2026-11-02;
 * owner: *"importing guests will happen on december 19."* · *"just like event creation"*).
 * EXECUTED: the one gate (`guestImportGate`) refuses a normal account before 2026-12-19 with the owner-shaped message,
 * lets an internal (founders') account through, opens for everyone on the day, and fails CLOSED when "is this account
 * internal?" does not answer. Then the wiring: the import action asks it first on both steps, and the door shows it.
 * Sabotage (2026-11-02, each reverted, each red): `exempt` ignored in `guestImportRefusal` · the gate's `.catch(() =>
 * false)` flipped to true · `importGuestsCsv` asking the gate after the file is read · the page drawing the form anyway.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { stripComments } from './strip-comments';
import { FIRST_EVENT_DAY, GUEST_IMPORT_OPENS_MESSAGE, guestImportRefusal } from './event-date-floor';

/* `server-only` shim — the shape of lib/a-locked-deal-reaches-the-budget.test.ts. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_guest_import__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const orig = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return orig.call(this, request, ...rest);
  };
}
let gate: typeof import('./guest-import-gate.server').guestImportGate;
before(async () => {
  ({ guestImportGate: gate } = await import('./guest-import-gate.server'));
});

const BEFORE = '2026-11-02';
const yes = async () => true;
const no = async () => false;
const broken = async (): Promise<boolean> => {
  throw new Error('users read refused');
};

test('a normal account is refused before December 19, with the owner-shaped message', async () => {
  assert.equal(await gate('e1', { today: BEFORE, isExempt: no }), GUEST_IMPORT_OPENS_MESSAGE);
  assert.equal(await gate('e1', { today: '2026-12-18', isExempt: no }), GUEST_IMPORT_OPENS_MESSAGE, 'the founders’ wedding day itself is still before');
  assert.match(GUEST_IMPORT_OPENS_MESSAGE, /December 19, 2026/);
  assert.match(GUEST_IMPORT_OPENS_MESSAGE, /founders' wedding on December 18, 2026/, 'not the event floor’s message shape');
});

test('an internal (founders’) account imports now', async () => {
  assert.equal(await gate('e1', { today: BEFORE, isExempt: yes }), null);
  assert.equal(guestImportRefusal(BEFORE, true), null);
});

test('everyone imports from the day — and an unanswered exempt read fails closed', async () => {
  assert.equal(await gate('e1', { today: FIRST_EVENT_DAY, isExempt: no }), null);
  assert.equal(await gate('e1', { today: '2027-01-05', isExempt: broken }), null, 'after the day nothing is asked');
  assert.equal(await gate('e1', { today: BEFORE, isExempt: broken }), GUEST_IMPORT_OPENS_MESSAGE, 'an unread "internal?" let the import through');
});

test('the import action asks first, on both steps; the door shows the message instead of the upload', () => {
  const web = process.cwd();
  const actions = stripComments(readFileSync(path.join(web, 'app/dashboard/[eventId]/guests/import/actions.ts'), 'utf8'));
  const fn = actions.slice(actions.indexOf('export async function importGuestsCsv('));
  const asked = fn.indexOf('await guestImportGate(eventId)');
  assert.ok(asked > 0, 'importGuestsCsv does not ask the gate');
  assert.ok(asked < fn.indexOf("if (mode !== 'add')"), 'the gate is asked after a step has already read or written');
  assert.match(fn, /if \(notYet\) return \{ stage: 'error', message: notYet \};/, 'a refusal is not returned as the import’s answer');
  const page = stripComments(readFileSync(path.join(web, 'app/dashboard/[eventId]/guests/import/page.tsx'), 'utf8'));
  assert.match(page, /const notYet = await guestImportGate\(eventId\);/);
  assert.match(page, /\{notYet \? \([\s\S]*?\{notYet\}[\s\S]*?\) : \(\s*<GuestImportForm action=\{action\} \/>/, 'the door draws the upload before the day');
});
