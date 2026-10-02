/**
 * EVERY FAILURE IS RECORDED — the unit + wiring half (owner 2026-10-02,
 * DECISION_LOG "SPOT PROBLEMS BEFORE USERS REPORT THEM").
 *
 * Two kinds of assertion:
 *   1. the DETECTORS — each source turns its failure into the right record
 *      (thrown · returned · zero-row · button timeout · dead end · dead tap ·
 *      rage tap · drop-off), and nothing personal survives the scrub;
 *   2. the WIRING — the one central place each source is recorded from is
 *      still wired (instrumentation, the fetch layer, every error boundary,
 *      both not-found pages, the observer's lazy mount, the flow anchors).
 *      A detector nobody calls records nothing, and looks exactly like an app
 *      with no problems.
 *
 * The database half — that each of these becomes a trace row AND one grouped
 * issue — is tests/db/every-failure-is-recorded.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  TOP_LEVEL_SEGMENTS,
  classifyPostgrest,
  normalizeMessage,
  normalizePath,
  readActionResult,
  redirectSaysFailed,
  scrubText,
} from './fault-normalize';
import { redactPayload } from './redact';
import { shapeRequestError } from './request-error-shape';
import {
  ACTION_TIMEOUT_MS,
  createRageCounter,
  isDeadTap,
  judgeLanding,
  watchRequest,
  type TapSignals,
  type WireFault,
} from './fault-observer';
import { FLOWS, WEDDING_SCREENS, funnelOf, reachStep, type FlowRuns } from './flows';
import { countKeyFor, wireToRecord } from './ingest-shape';
import { problemLine } from './problem-line';
import { createLoggingFetch, type DbFaultSink } from '@/lib/supabase/db-error-log';

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const code = (p: string) => stripComments(read(p));

// ── 0 · NO PERSONAL DATA ────────────────────────────────────────────────────

test('an email, a phone number and a name in a message are scrubbed', () => {
  const raw = 'Could not invite Maria Santos (maria.santos@gmail.com, +63 917 123 4567) to Juan dela Cruz';
  const out = scrubText(raw);
  assert.ok(!out.includes('maria.santos@gmail.com'), out);
  assert.ok(!/917/.test(out), out);
  assert.ok(!out.includes('Maria Santos'), out);
  assert.ok(!out.includes('Juan dela Cruz'), out);
  assert.match(out, /\[email\]/);
  assert.match(out, /\[phone\]/);
  assert.match(out, /\[name\]/);
});

test('a single first name after "for/guest/to" is scrubbed, and quoted values are blanked', () => {
  assert.ok(!scrubText('Seat not found for Bea').includes('Bea'));
  assert.ok(!scrubText('duplicate key value "Ana Reyes"').includes('Ana'));
});

test('the fingerprint form collapses numbers so one failure is one issue', () => {
  assert.equal(normalizeMessage('timed out after 15012ms'), normalizeMessage('timed out after 15007ms'));
  assert.equal(normalizeMessage('x\n    at foo (a.ts:1:2)'), 'x', 'stack frames are not part of the identity');
});

test('payload VALUES are scrubbed too, ids are kept', () => {
  const p = redactPayload({
    note: 'call Maria Santos at 0917-123-4567',
    eventId: '4f9c2a10-1b2c-4d3e-8f90-123456789abc',
    email: 'a@b.co',
  });
  assert.ok(!String(p.note).includes('Maria'), String(p.note));
  assert.ok(!String(p.note).includes('0917'), String(p.note));
  assert.equal(p.eventId, '4f9c2a10-1b2c-4d3e-8f90-123456789abc', 'an id is not personal data and is kept');
  assert.equal(p.email, '[redacted]');
});

test("a path loses its query, ids and an event's own address", () => {
  assert.equal(normalizePath('/maria-and-juan/invite/reply?code=abc'), '/[slug]/invite/reply');
  assert.equal(normalizePath('/dashboard/4f9c2a10-1b2c-4d3e-8f90-123456789abc/guests'), '/dashboard/[id]/guests');
  assert.equal(normalizePath('/vendor-dashboard/messages/S89T-ABCDEFGHJK#quote', true), '/vendor-dashboard/messages/[id]#quote');
});

test('TOP_LEVEL_SEGMENTS is exactly the top-level routes under app/', () => {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('_') || e.name.startsWith('[')) continue;
      if (e.name.startsWith('(') && e.name.endsWith(')')) {
        walk(`${dir}/${e.name}`);
        continue;
      }
      found.add(e.name);
    }
  };
  walk('app');
  const missing = [...found].filter((s) => !TOP_LEVEL_SEGMENTS.has(s));
  const stale = [...TOP_LEVEL_SEGMENTS].filter((s) => !found.has(s));
  assert.deepEqual(missing, [], `new top-level route(s) would be blanked to [slug] on the Problems list: ${missing}`);
  assert.deepEqual(stale, [], `TOP_LEVEL_SEGMENTS names routes that no longer exist: ${stale}`);
});

// ── 1 · THROWN (onRequestError) ─────────────────────────────────────────────

test('THROWN: a server action throw becomes SERVER_THROWN with route, action, digest', () => {
  const err = Object.assign(new Error('boom'), { digest: '123456' });
  const r = shapeRequestError(
    err,
    { path: '/dashboard/x/guests?e=a@b.co', method: 'POST', headers: { 'next-action': 'a'.repeat(40) } },
    { routePath: '/dashboard/[eventId]/guests', routeType: 'action' },
    () => 'app/dashboard/[eventId]/guests/actions.ts#addGuest',
  );
  assert.ok(r);
  assert.equal(r.kind, 'SERVER_THROWN');
  assert.equal(r.action, 'app/dashboard/[eventId]/guests/actions.ts#addGuest');
  assert.equal(r.trace?.digest, '123456');
  assert.equal(r.trace?.page, '/dashboard/[eventId]/guests');
});

test("THROWN: Next's redirect / notFound are control flow, never failures", () => {
  const ctx = { routePath: '/x', routeType: 'render' };
  assert.equal(shapeRequestError(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/a;307;' }), {}, ctx, () => null), null);
  assert.equal(shapeRequestError(Object.assign(new Error('x'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }), {}, ctx, () => null), null);
});

test('WIRED: instrumentation onRequestError records every thrown request error', () => {
  const src = code('instrumentation.ts');
  assert.match(src, /export const onRequestError/);
  assert.match(src, /Sentry\.captureRequestError\(/, 'Sentry still gets it');
  assert.match(src, /recordRequestError\(error, request, context\)/, 'the Problems list gets it');
});

// ── 2 · RETURNED (the action's reply, read once in the browser) ─────────────

test('RETURNED: { ok:false, error } in the action reply is a failure; ok:true is a success', () => {
  const failed = readActionResult('0:{"a":"$@1","f":"","b":"build"}\n1:{"ok":false,"error":"That did not save"}\n');
  assert.deepEqual(failed, { failed: true, message: 'That did not save' });
  const fine = readActionResult('0:{"a":"$@1","f":"","b":"build"}\n1:{"ok":true}\n2:{"ok":false}\n');
  assert.equal(fine.failed, false, 'only the chunk the action returned is read');
  assert.equal(redirectSaysFailed('/x?error=nope;push'), 'redirected with error=nope');
  assert.equal(redirectSaysFailed('/x?notice=proposal_failed'), 'redirected with notice=proposal_failed');
  assert.equal(redirectSaysFailed('/x?notice=proposal_sent'), null);
});

function fakeEnv() {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  const sent: WireFault[] = [];
  const counted: string[] = [];
  return {
    timers,
    sent,
    counted,
    env: {
      setTimeout: (fn: () => void, ms: number) => {
        const t = { fn, ms, cleared: false };
        timers.push(t);
        return t;
      },
      clearTimeout: (t: never) => {
        (t as unknown as { cleared: boolean }).cleared = true;
      },
      send: (w: WireFault) => sent.push(w),
      count: (k: string) => counted.push(k),
    },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test('RETURNED: the observer sends ACTION_RETURNED_ERROR with the pressed button; a success is only COUNTED', async () => {
  const f = fakeEnv();
  const body = '0:{"a":"$@1","f":"","b":"b"}\n1:{"ok":false,"error":"Juan Cruz is already invited"}\n';
  watchRequest(Promise.resolve(new Response(body, { status: 200 })), { actionId: 'abc123', apiPath: null, page: '/maria-juan/invite/reply', element: 'Send my reply' }, f.env);
  await tick();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0]!.event_type, 'ACTION_RETURNED_ERROR');
  assert.equal(f.sent[0]!.element_name, 'Send my reply');
  assert.equal(f.sent[0]!.payload_snapshot.page, '/[slug]/invite/reply');

  const ok = fakeEnv();
  watchRequest(Promise.resolve(new Response('0:{"a":"$@1"}\n1:{"ok":true}\n', { status: 200 })), { actionId: 'abc123', apiPath: null, page: '/', element: null }, ok.env);
  await tick();
  assert.deepEqual(ok.sent, [], 'NO row for a success');
  assert.deepEqual(ok.counted, ['id:abc123'], 'only a count');
});

test('RETURNED: an action 5xx is NOT re-sent (the server already recorded the throw)', async () => {
  const f = fakeEnv();
  watchRequest(Promise.resolve(new Response('x', { status: 500 })), { actionId: 'abc', apiPath: null, page: '/', element: null }, f.env);
  await tick();
  assert.deepEqual(f.sent, []);
});

// ── 3 · BUTTON TIMEOUT ──────────────────────────────────────────────────────

test('TIMEOUT: a press with no answer after 15 s is BUTTON_TIMEOUT; an answer in time is not', async () => {
  const f = fakeEnv();
  watchRequest(new Promise<Response>(() => {}), { actionId: 'abc', apiPath: null, page: '/dashboard/x', element: 'Save' }, f.env);
  assert.equal(f.timers.length, 1);
  assert.equal(f.timers[0]!.ms, ACTION_TIMEOUT_MS);
  assert.equal(ACTION_TIMEOUT_MS, 15_000);
  f.timers[0]!.fn();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0]!.event_type, 'BUTTON_TIMEOUT');
  assert.equal(f.sent[0]!.element_name, 'Save');

  const g = fakeEnv();
  watchRequest(Promise.resolve(new Response('0:{"a":"$@1"}\n1:{"ok":true}\n')), { actionId: 'abc', apiPath: null, page: '/', element: null }, g.env);
  await tick();
  assert.equal(g.timers[0]!.cleared, true, 'an answer clears the clock');
});

// ── 4 · ZERO-ROW + REFUSED (the server fetch layer) ─────────────────────────

test('ZERO-ROW: a targeted PATCH that matched nothing is DB_ZERO_ROW; a sweep is not', () => {
  const zero = classifyPostgrest({ method: 'PATCH', url: 'https://x.supabase.co/rest/v1/vendor_services?vendor_service_id=eq.1', status: 204, contentRange: '*/*' });
  assert.equal(zero?.kind, 'DB_ZERO_ROW');
  assert.equal(zero?.action, 'PATCH vendor_services');
  const one = classifyPostgrest({ method: 'PATCH', url: 'https://x.supabase.co/rest/v1/vendor_services?vendor_service_id=eq.1', status: 204, contentRange: '0-0/*' });
  assert.equal(one, null);
  const sweep = classifyPostgrest({ method: 'PATCH', url: 'https://x.supabase.co/rest/v1/app_x?status=eq.active&created_at=lt.2026', status: 204, contentRange: '*/*' });
  assert.equal(sweep, null, 'a sweep may legitimately match nothing');
  const refused = classifyPostgrest({ method: 'POST', url: '/rest/v1/guests', status: 403, errorCode: '42501', errorMessage: 'permission denied' });
  assert.equal(refused?.kind, 'DB_WRITE_REFUSED');
  assert.equal(classifyPostgrest({ method: 'GET', url: '/rest/v1/x', status: 406, errorCode: 'PGRST116' }), null);
  assert.equal(classifyPostgrest({ method: 'POST', url: '/rest/v1/rpc/record_app_fault', status: 500 }), null, 'the recorder never records itself');
});

test('ZERO-ROW: the fetch layer every server client rides hands it to the recorder', async () => {
  const real = globalThis.fetch;
  const got: unknown[] = [];
  const sink: DbFaultSink = { verdict: (v) => got.push(v), unreachable: () => {} };
  globalThis.fetch = (async () => new Response(null, { status: 204, headers: { 'content-range': '*/*' } })) as typeof fetch;
  try {
    const f = createLoggingFetch(`zr-${Math.random()}`, sink);
    const res = await f('https://x.supabase.co/rest/v1/vendor_services?vendor_service_id=eq.9', { method: 'PATCH' });
    assert.equal(res.status, 204, 'the caller still gets the untouched response');
  } finally {
    globalThis.fetch = real;
  }
  assert.equal((got[0] as { kind: string }).kind, 'DB_ZERO_ROW');
});

test('WIRED: both server Supabase clients ride the recording fetch layer', () => {
  assert.match(code('lib/supabase/admin.ts'), /createLoggingFetch\(/);
  assert.match(code('lib/supabase/server.ts'), /createLoggingFetch\(/);
  assert.match(code('lib/supabase/db-error-log.ts'), /recordDbVerdict\(/);
});

// ── 5 · DEAD END ────────────────────────────────────────────────────────────

test('DEAD END: not-found, a forwarding stub and a missing #section; a sign-in wall is not one', () => {
  const base = { tappedPath: '/a', tappedHash: '', fromPath: '/home', landedPath: '/a', notFoundShown: false, sectionFound: null };
  assert.equal(judgeLanding({ ...base, notFoundShown: true })?.reason, 'not_found');
  assert.equal(judgeLanding({ ...base, landedPath: '/b' })?.reason, 'forwarded');
  assert.equal(judgeLanding({ ...base, tappedHash: '#x', sectionFound: false })?.reason, 'missing_section');
  assert.equal(judgeLanding({ ...base, landedPath: '/login' }), null);
  assert.equal(judgeLanding({ ...base, tappedHash: '#x', sectionFound: true }), null);
});

test('WIRED: both not-found pages carry the dead-end marker the observer reads', () => {
  for (const f of ['app/not-found.tsx', 'app/[slug]/not-found.tsx']) {
    assert.match(code(f), /data-dead-end="not-found"/, f);
  }
  assert.match(code('lib/telemetry/fault-observer.ts'), /querySelector\('\[data-dead-end\]'\)/);
});

// ── 6 · DEAD TAP + RAGE TAP ─────────────────────────────────────────────────

test('DEAD TAP: nothing at all answered → dead; any one answer → not dead', () => {
  const none: TapSignals = { navigated: false, requested: false, dialogOpened: false, mutatedNearby: false, scrolled: false, focusMoved: false, leftPage: false };
  assert.equal(isDeadTap(none), true);
  for (const k of Object.keys(none) as Array<keyof TapSignals>) {
    assert.equal(isDeadTap({ ...none, [k]: true }), false, `${k} is an answer`);
  }
});

test('RAGE TAP: the 3rd tap of one element within 2 s, once per burst', () => {
  const rage = createRageCounter();
  const el = {};
  assert.equal(rage(el, 0), false);
  assert.equal(rage(el, 500), false);
  assert.equal(rage(el, 900), true);
  assert.equal(rage(el, 1200), false, 'once per burst');
  const slow = createRageCounter();
  assert.equal(slow(el, 0) || slow(el, 2500) || slow(el, 5000), false, 'slow taps are not rage');
});

test('WIRED: the observer is installed lazily from the one always-mounted component, never statically', () => {
  const deferred = code('app/_components/deferred-observability.tsx');
  assert.match(deferred, /import\('@\/lib\/telemetry\/fault-observer'\)/);
  assert.match(deferred, /installFaultObserver\(\)/);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(e.name) && !e.name.endsWith('.test.ts')) {
        const s = read(p);
        if (/from ['"]@\/lib\/telemetry\/fault-observer['"]/.test(s)) offenders.push(p);
      }
    }
  };
  walk('app');
  walk('components');
  assert.deepEqual(offenders, [], 'a static import puts the observer in a first load');
});

// ── 7 · CRASHES + STALLED UPLOADS ───────────────────────────────────────────

test('WIRED: every error boundary reports a browser-born crash', () => {
  const boundaries: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name === 'error.tsx' || e.name === 'global-error.tsx') boundaries.push(p);
    }
  };
  walk('app');
  assert.ok(boundaries.length >= 2);
  for (const b of boundaries) assert.match(code(b), /report-crash'\)[\s\S]*reportCrash\(error,/, `${b} records nothing`);
});

test('WIRED: a stalled upload is recorded by the upload watchdog', () => {
  const src = code('app/_components/file-upload.tsx');
  const stall = src.slice(src.indexOf('onStall'), src.indexOf('onStall') + 900);
  assert.match(stall, /eventType: 'UPLOAD_STALLED'/);
});

// ── 8 · DROP-OFF ────────────────────────────────────────────────────────────

test('DROP-OFF: a step counts once per run, only inside a live run, and the worst stop is found', () => {
  const flow = FLOWS.find((f) => f.flow === 'guest_reply')!;
  const runs: FlowRuns = {};
  assert.equal(reachStep(runs, flow, 'ticket', 0), null, 'no run → a returning guest is not counted as finishing');
  assert.equal(reachStep(runs, flow, 'open', 1), 'open');
  assert.equal(reachStep(runs, flow, 'choose', 2), 'choose');
  assert.equal(reachStep(runs, flow, 'choose', 3), null, 'once per run');
  const { worst } = funnelOf(flow, { open: 100, choose: 80, send: 30, ticket: 29 });
  assert.equal(worst?.step, 'choose', '50 stopped after choosing — the most');
  assert.equal(worst?.stoppedHere, 50);
});

test('DROP-OFF: a step only some people see is not read as a cliff', () => {
  const flow = FLOWS.find((f) => f.flow === 'create_event')!;
  const { steps } = funnelOf(flow, { start: 10, welcome: 10, role: 10, kind: 10, faith: 3, name: 9 });
  assert.equal(steps.find((s) => s.step === 'kind')!.stoppedHere, 1);
  assert.equal(steps.find((s) => s.step === 'faith')!.stoppedHere, 0);
});

test('WIRED: every flow anchor still exists in its component', () => {
  const shell = code('app/onboarding/wedding/_components/onboarding-shell.tsx');
  const ids = /const FLOW_IDS = \[([^\]]+)\]/.exec(shell)?.[1]?.match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1));
  assert.deepEqual(ids, [...WEDDING_SCREENS], 'WEDDING_SCREENS must mirror FLOW_IDS');
  assert.match(shell, /data-flow-screen=\{activeId\}/);
  const rsvp = code('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(rsvp, /className="rsvp-form /);
  assert.match(rsvp, /name="rsvp_status"/);
  const rsvpActions = code('app/[slug]/actions.ts');
  assert.match(rsvpActions, /\?rsvp=\$\{outcome\}/);
  assert.match(rsvpActions, /: 'ok'/);
  assert.match(rsvpActions, /'details'/);
  assert.match(code('app/_components/proposal-maker.tsx'), /data-flow="supplier-quote"/);
  assert.match(code('app/vendor-dashboard/messages/[threadId]/proposal-actions.ts'), /'proposal_sent'/);
  const drawer = code('app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx');
  assert.match(drawer, /aria-labelledby="inline-checkout-title"/);
  assert.match(drawer, /data-flow-mark="checkout-submitted"/);
});

// ── 9 · THE INGEST + THE LINE ───────────────────────────────────────────────

test('INGEST: a browser cannot forge a server-only kind, and count keys are restricted', () => {
  const r = wireToRecord({ event_type: 'SERVER_THROWN', payload_snapshot: { page: '/a?x=1' } }, () => null);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.record.kind, 'OTHER');
  assert.equal(countKeyFor('anything', () => null), null);
  assert.equal(countKeyFor('flow:guest_reply:open', () => null), 'flow:guest_reply:open');
  assert.equal(countKeyFor('flow:guest_reply:invented', () => null), null);
  assert.equal(countKeyFor('id:abc', () => 'app/x.ts#y'), 'app/x.ts#y');
});

test('INGEST: the public door is rate-limited per IP and per instance', () => {
  const src = code('app/api/telemetry/client-fault/route.ts');
  assert.match(src, /enforceRateLimit\('telemetry_ingest'/);
  assert.match(src, /rateLimit\('telemetry_ingest:all'/);
  const i = src.indexOf("enforceRateLimit('telemetry_ingest'");
  assert.ok(i < src.indexOf('recordFault('), 'the limit runs before the write');
});

test('THE LINE: one plain sentence — what, where, what went wrong, today, 1 in N', () => {
  const line = problemLine({
    kind: 'BUTTON_TIMEOUT',
    action: 'app/[slug]/actions.ts#submitRsvp',
    label: 'Reply',
    page: '/[slug]/invite/reply',
    dayCount: 6,
    dayDate: '2026-10-02',
    today: '2026-10-02',
    failures: 6,
    successes: 234,
  });
  assert.equal(line, 'Reply button on the guest invitation — no answer · 6 times today · 1 in 40');
});
