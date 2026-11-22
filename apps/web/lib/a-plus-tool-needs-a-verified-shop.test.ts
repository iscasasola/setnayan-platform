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
  ['app/vendor-dashboard/messages/[threadId]/proposal-actions.ts', 'sendProposalFromChat', 'sendProposalCore('],
  ['app/vendor-dashboard/messages/[threadId]/proposal-actions.ts', 'sendCustomProposalFromChat', 'sendCustomProposalCore('],
  ['app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/access-actions.ts', 'askHostForAccess', ".from('event_access_requests')"],
  ['app/_components/negotiation-actions.ts', 'createScheduleRequestFromChat', ".from('event_appointments')"],
  ['app/vendor-dashboard/forms/actions.ts', 'formsAction', 'sendFormIntoEvent(supabase'],
  ['lib/chat-send.ts', 'sendChatMessageCore', ".from('chat_messages')"],
  // 🧾 The two OLDER quote doors (supplier launch walk 22 Nov, step 8) — the quotes page's Send and the app's route.
  ['app/vendor-dashboard/proposals/actions.ts', 'sendProposal', ".update({ status: 'sent'"],
  ['app/api/vendor/chat/[threadId]/proposal/route.ts', 'POST', 'sendProposalCore('],
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

/**
 * The four ＋ tools that write from the BROWSER (no server action in front of them) are checked by the database:
 * migration 20271357625672 puts one BEFORE INSERT trigger on each table they land in. Proved live in
 * tests/db/every-plus-tool-needs-a-verified-shop.db.test.ts; this pins that the trigger stays on every table.
 */
it('every browser-written ＋ tool has its verified-shop trigger', () => {
  const sql = readFileSync(path.join(process.cwd(), '../../supabase/migrations/20271357625672_every_plus_tool_needs_a_verified_shop.sql'), 'utf8');
  for (const [table, trigger] of [
    ['chat_polls', 'chat_polls_plus_needs_a_verified_shop'],
    ['chat_decision_topics', 'chat_decision_topics_plus_needs_a_verified_shop'],
    ['booking_change_asks', 'booking_change_asks_plus_needs_a_verified_shop'],
    ['chat_messages', 'chat_messages_offer_needs_a_verified_shop'],
  ]) {
    assert.match(sql, new RegExp(`CREATE TRIGGER ${trigger}\\s+BEFORE INSERT ON public\\.${table}\\b`), `${table} lost its ＋ trigger`);
  }
});

it('a plan / change ask refused by the trigger reads as the ＋ gate’s words, never a generic failure', async () => {
  const { negotiateRefusalWords } = await import('./chat-cards');
  assert.equal(negotiateRefusalWords('PLUS_NEEDS_VERIFIED: Chat tools open once your shop is verified.'), PLUS_NEEDS_VERIFIED);
});

/**
 * 🎂 The Cake Maker's "Ask for a cake design" (`runCakeAction` op `invite`) is a ＋ tool the shop sends. Hiding its tile
 * for an unverified shop is not a check — the op itself asks the gate, before the invite line is written, and returns
 * the gate's own refusal for BOTH non-open verdicts (unverified · the read failed). `plusGateRefusal` and `shopPlusGate`
 * are proved on a fake client above; this pins that the op uses them and cannot send first.
 * SABOTAGE (22 Nov 2026): the two gate lines deleted from the invite block → RED ("never asks"); the gate moved below
 * `sendChatMessageCore(` → RED ("AFTER"); `if (plusRefusal) return fail(plusRefusal);` deleted → RED ("does not refuse").
 */
it('the Cake Maker invite asks the gate before it sends, and refuses on unverified AND on a failed read', () => {
  const s = src('app/_components/cake-maker/cake-actions.ts');
  const at = s.indexOf('// invite');
  assert.ok(at >= 0, 'the invite block moved — repoint this guard');
  const block = s.slice(at, s.indexOf("if (op === 'status')", at));
  const g = block.indexOf('plusGateRefusal(await shopPlusGate(');
  const r = block.indexOf('if (plusRefusal) return fail(plusRefusal);');
  const w = block.indexOf('sendChatMessageCore(');
  assert.ok(g >= 0, 'the Cake Maker invite never asks the ＋ gate');
  assert.ok(r > g, 'the Cake Maker invite asks the gate but does not refuse on its answer');
  assert.ok(w >= 0, 'the invite no longer sends through sendChatMessageCore — repoint this guard');
  assert.ok(r < w, 'the Cake Maker invite asks the gate AFTER it sends');
  // Both non-open verdicts carry words, so `if (plusRefusal)` refuses both; 'open' carries none.
  assert.equal(plusGateRefusal('unverified'), PLUS_NEEDS_VERIFIED);
  assert.equal(plusGateRefusal('unknown'), PLUS_GATE_UNKNOWN);
  assert.equal(plusGateRefusal('open'), null);
});

/**
 * 🧾 THE TWO OLDER QUOTE DOORS REFUSE AN UNVERIFIED SHOP (supplier launch walk 22 Nov, step 8 · Build 2). Asking the
 * gate is not enough — each door must STOP on any verdict but 'open', before it writes, and fail closed: the quotes
 * page's Send refuses when its draft read failed or found nothing (it never sends on an unread shop), and the app's
 * route answers the gate's own words with the Get verified door. `shopPlusGate`/`threadPlusGate` are proved on a fake
 * client above.
 * SABOTAGE (22 Nov 2026): `if (plusGate !== 'open') redirect(…)` deleted from sendProposal → RED ("does not refuse");
 * its `: 'unknown'` fallback flipped to `: 'open'` → RED ("an unread draft"); `if (plusRefusal) {…}` deleted from the
 * route → RED ("does not refuse").
 */
describe('the two older quote doors refuse an unverified shop', () => {
  it('the quotes page’s Send (sendProposal) refuses before the draft→sent flip, and fails closed', () => {
    const body = bodyOf('app/vendor-dashboard/proposals/actions.ts', 'sendProposal');
    const g = body.indexOf('await shopPlusGate(supabase, draft.vendor_profile_id)');
    const r = body.indexOf("if (plusGate !== 'open') redirect(`/proposals/${publicId}?notice=send_plus_${plusGate}`);");
    const w = body.indexOf(".update({ status: 'sent'");
    assert.ok(g >= 0, 'sendProposal no longer asks the gate about the draft’s own shop');
    assert.ok(r > g, 'sendProposal asks the gate but does not refuse on its answer');
    assert.ok(r < w, 'sendProposal refuses AFTER it flips the draft to sent');
    assert.match(
      body,
      /const plusGate: PlusGate = draft && !draftErr \? await shopPlusGate\([^)]*\) : 'unknown';/,
      'an unread draft (refused read, or none) must be refused as unknown — never sent on an unchecked shop',
    );
  });

  it('the app’s quote route refuses with the gate’s words before it sends', () => {
    const body = bodyOf('app/api/vendor/chat/[threadId]/proposal/route.ts', 'POST');
    const g = body.indexOf('const plusRefusal = plusGateRefusal(plusGate);');
    const r = body.indexOf('if (plusRefusal) {');
    const ret = body.indexOf('return Response.json(', r);
    const w = body.indexOf('sendProposalCore(');
    assert.ok(g >= 0 && body.indexOf('threadPlusGate(auth.supabase, threadId)') < g, 'the route never asks the ＋ gate');
    assert.ok(r > g && ret > r && ret < w, 'the route asks the gate but does not refuse before it sends');
    assert.ok(body.includes('verifyHref: PLUS_TRAY_VERIFY_HREF'), 'an unverified refusal lost its Get verified door');
  });

  it('the quote page says the gate’s own words for both refusals, with the Get verified door', () => {
    const page = src('app/proposals/[publicId]/page.tsx');
    for (const verdict of ['unverified', 'unknown'] as const) {
      const at = page.indexOf(`search.notice === 'send_plus_${verdict}'`);
      assert.ok(at >= 0, `the quote page never shows send_plus_${verdict}`);
      const block = page.slice(at, page.indexOf(') : null}', at));
      assert.ok(block.includes(verdict === 'unverified' ? '{PLUS_NEEDS_VERIFIED}' : '{PLUS_GATE_UNKNOWN}'), `send_plus_${verdict} lost the gate’s words`);
      if (verdict === 'unverified') assert.ok(block.includes('href={PLUS_TRAY_VERIFY_HREF}'), 'the refusal lost its Get verified door');
    }
  });
});
