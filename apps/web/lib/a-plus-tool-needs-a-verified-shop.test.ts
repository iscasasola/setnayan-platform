/**
 * 🪪 EVERY ＋ TOOL NEEDS A VERIFIED SHOP — with a server check on every send (UNICHAT ＋ P1, owner 21 Nov v2 drawing).
 *
 * Part 1 drives the gate on a fake client: verified → open · unverified → refused · a refused read → refused as
 * "couldn't check" (never open) · a group thread (no shop) → open. Part 2 is a source guard: each shop-side ＋ send asks
 * the gate BEFORE it writes, so a send path added without it goes red here.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { PLUS_GATE_UNKNOWN, PLUS_NEEDS_VERIFIED, plusGateRefusal } from './shop-plus-gate';

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_plus_gate__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

type Row = Record<string, unknown> | null;
type Answer = { data: Row; error: { message: string } | null };
/** A client whose every `.from(t)…maybeSingle()` answers from `answers[t]`. */
function fakeClient(answers: Record<string, Answer>) {
  const chain = (table: string) => {
    const c = { select: () => c, eq: () => c, maybeSingle: async () => answers[table] ?? { data: null, error: null } };
    return c;
  };
  return { from: (t: string) => chain(t) } as never;
}

let gate: typeof import('./shop-plus-gate.server');
before(async () => {
  gate = await import('./shop-plus-gate.server');
});

describe('the ＋ gate', () => {
  it('opens for a verified shop', async () => {
    const c = fakeClient({ vendor_profiles: { data: { verification_state: 'verified' }, error: null } });
    assert.equal(await gate.shopPlusGate(c, 'S89V-1'), 'open');
  });
  it('refuses an unverified shop, in words', async () => {
    const c = fakeClient({ vendor_profiles: { data: { verification_state: 'pending' }, error: null } });
    const g = await gate.shopPlusGate(c, 'S89V-1');
    assert.equal(g, 'unverified');
    assert.equal(plusGateRefusal(g), PLUS_NEEDS_VERIFIED);
  });
  it('refuses when the read fails — "couldn’t check", never open', async () => {
    const c = fakeClient({ vendor_profiles: { data: null, error: { message: 'boom' } } });
    const g = await gate.shopPlusGate(c, 'S89V-1');
    assert.equal(g, 'unknown');
    assert.equal(plusGateRefusal(g), PLUS_GATE_UNKNOWN);
  });
  it('from a thread: a group (no shop) is open, a refused thread read is not', async () => {
    assert.equal(await gate.threadPlusGate(fakeClient({ chat_threads: { data: { vendor_profile_id: null }, error: null } }), 't'), 'open');
    assert.equal(await gate.threadPlusGate(fakeClient({ chat_threads: { data: null, error: { message: 'x' } } }), 't'), 'unknown');
    assert.equal(
      await gate.threadPlusGate(
        fakeClient({
          chat_threads: { data: { vendor_profile_id: 'S89V-1' }, error: null },
          vendor_profiles: { data: { verification_state: 'unverified' }, error: null },
        }),
        't',
      ),
      'unverified',
    );
  });
  it('says nothing when open', () => {
    assert.equal(plusGateRefusal('open'), null);
  });
});

const src = (...p: string[]) => readFileSync(path.join(process.cwd(), ...p), 'utf8');
/** The body of `export async function <name>` up to the next top-level export. */
function bodyOf(file: string, name: string): string {
  const s = src(file);
  const at = s.indexOf(`export async function ${name}`);
  assert.ok(at >= 0, `${name} not found in ${file}`);
  const next = s.indexOf('\nexport ', at + 10);
  return s.slice(at, next < 0 ? undefined : next);
}

/** [file, function, the first write the gate must come before] */
const SENDS: Array<[string, string, string]> = [
  ['app/vendor-dashboard/messages/[threadId]/proposal-actions.ts', 'sendCustomProposalFromChat', 'sendCustomProposalCore('],
  ['app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/access-actions.ts', 'askHostForAccess', ".from('event_access_requests')"],
  ['app/_components/negotiation-actions.ts', 'createScheduleRequestFromChat', ".from('event_appointments')"],
  ['app/vendor-dashboard/forms/actions.ts', 'formsAction', 'sendFormIntoEvent(supabase'],
  ['lib/chat-send.ts', 'sendChatMessageCore', ".from('chat_messages')"],
];

it('the chat’s payment ask (inline=1) asks the gate before it inserts', () => {
  const s = src('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const core = s.slice(s.indexOf('async function askForPaymentCore'));
  const g = core.indexOf("formData.get('inline') === '1'");
  const w = core.indexOf(".from('vendor_payment_asks').insert");
  assert.ok(g >= 0 && core.indexOf('shopPlusGate(', g) > g, 'the inline payment ask never asks the ＋ gate');
  assert.ok(core.indexOf('shopPlusGate(', g) < w, 'the inline payment ask asks the gate AFTER it inserts');
});

describe('every shop-side ＋ send asks the gate before it writes', () => {
  for (const [file, fn, write] of SENDS) {
    it(fn, () => {
      const body = bodyOf(file, fn);
      const g = body.search(/(?:shop|thread)PlusGate\(/);
      const w = body.indexOf(write);
      assert.ok(g >= 0, `${fn} never asks the ＋ gate`);
      assert.ok(w >= 0, `${fn}: its write ${write} moved — repoint this guard`);
      assert.ok(g < w, `${fn} asks the gate AFTER it writes`);
    });
  }
});
