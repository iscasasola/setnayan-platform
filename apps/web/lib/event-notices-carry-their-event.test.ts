/**
 * event-notices-carry-their-event.test.ts — 📍 AN EVENT'S NOTICE KNOWS WHICH EVENT IT IS FROM.
 *
 * Owner, 2026-11-13: *"how do we identify if it is from an event they are making or an event they are invited to"*.
 * The bell row names its event from `notifications.event_id` (lib/notification-place.ts). That column is written by
 * `emitNotification` from `relatedUrl` when the link is `/dashboard/<uuid>/…`, or from an explicit `eventId` — so an
 * event notice whose link names no event (`/dashboard?seg=people`, `/dashboard`, a public `/<slug>`) and passes no
 * `eventId` lands as "Your account", and the couple cannot tell which wedding it is about.
 *
 * Held here, for every emitter of each EVENT-SCOPED notice (comments stripped, so a docblock quoting a shape cannot
 * satisfy it):
 *   1 · `rsvp_received` (an RSVP AND a guest's detail edit) · `guest_claim_pending` — every `emitNotification` call
 *       passes `eventId`, or links `/dashboard/${…}` (directly or through a local `const`);
 *   2 · a couple⇄supplier `chat_message` (lib/chat-actions.ts · lib/offer-service-core.ts ·
 *       app/_actions/thread-call-actions.ts) — the same, or the supplier's own `supplierChatHref` (the shop);
 *       ⚠ NOT every `chat_message`: help-desk and concierge threads are the account's own, and say so;
 *   3 · `connection_request` sent FROM an event (lib/people-connection-request.server.ts) passes that event's id —
 *       its link stays People;
 *   4 · the two notices the DATABASE writes — `schedule_released` (`release_full_schedule`) and `event_invitation`
 *       (`an_invitation_reaches_the_account`) — insert `event_id` in their latest definitions.
 *
 * Old rows already in the table keep the event_id they were written with; this holds every notice from now on.
 *
 * SABOTAGE (seen red, then restored): dropping `eventId` from people-connection-request (3 red); the
 * `guest_claim_pending` emitter in app/join/[eventId]/actions.ts linking `/dashboard?seg=people` (1 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const REPO = join(WEB, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every `emitNotification({ … })` argument object in a source, brace-matched. */
function emitCalls(src: string): string[] {
  const calls: string[] = [];
  let at = src.indexOf('emitNotification({');
  while (at !== -1) {
    const open = src.indexOf('{', at);
    let depth = 0;
    let end = open;
    for (; end < src.length; end += 1) {
      const c = src[end];
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(src.slice(open, end + 1));
    at = src.indexOf('emitNotification({', end);
  }
  return calls;
}

/** Does this call say its event — an explicit `eventId`, or a link that names one? */
function carriesItsEvent(call: string, file: string, allowShop: boolean): boolean {
  if (/\beventId\s*[:,}]/.test(call)) return true;
  const url = /relatedUrl\s*:\s*([^\n]+)|\brelatedUrl\s*[,}]/.exec(call);
  if (!url) return false;
  let expr = url[1] ?? 'relatedUrl';
  const ident = /^\s*([A-Za-z_$][\w$]*)\s*,?\s*$/.exec(expr)?.[1];
  if (ident) {
    // A local `const relatedUrl = …;` — read its initializer.
    const def = new RegExp(`const ${ident}\\s*=([\\s\\S]*?);`).exec(file);
    if (!def) return false;
    expr = def[1]!;
  }
  if (/`\/dashboard\/\$\{/.test(expr)) return true;
  return allowShop && /supplierChatHref\(|['"`]\/vendor-dashboard/.test(expr);
}

const FILES = walk(join(WEB, 'app')).concat(walk(join(WEB, 'lib')));
const SOURCES = new Map(FILES.map((f) => [relative(WEB, f), stripComments(readFileSync(f, 'utf8'))]));

test('1 · every RSVP / guest-edit / join-request notice carries its event', () => {
  const found: Record<string, number> = { rsvp_received: 0, guest_claim_pending: 0 };
  const bad: string[] = [];
  for (const [rel, src] of SOURCES) {
    for (const call of emitCalls(src)) {
      const type = /type\s*:\s*'([a-z_]+)'/.exec(call)?.[1];
      if (!type || !(type in found)) continue;
      found[type]! += 1;
      if (!carriesItsEvent(call, src, false)) bad.push(`${rel} · ${type}`);
    }
  }
  for (const [type, n] of Object.entries(found)) assert.ok(n > 0, `no emitter of ${type} found — the scan is blind`);
  assert.deepEqual(bad, [], 'an event notice names no event (pass eventId, or link /dashboard/<uuid>)');
});

test('2 · a couple⇄supplier chat notice carries its event (or the shop)', () => {
  const files = ['lib/chat-actions.ts', 'lib/offer-service-core.ts', 'app/_actions/thread-call-actions.ts'];
  for (const rel of files) {
    const src = SOURCES.get(rel);
    assert.ok(src, `${rel} moved`);
    const chats = emitCalls(src).filter((c) => /type\s*:\s*'chat_message'/.test(c));
    assert.ok(chats.length > 0, `${rel} no longer emits chat_message — re-anchor this guard`);
    for (const c of chats) assert.ok(carriesItsEvent(c, src, true), `${rel}: a chat notice names no event:\n${c}`);
  }
});

test('3 · a connection request sent from an event passes that event', () => {
  const src = SOURCES.get('lib/people-connection-request.server.ts');
  assert.ok(src, 'people-connection-request.server.ts moved');
  const call = emitCalls(src).find((c) => /type\s*:\s*'connection_request'/.test(c));
  assert.ok(call, 'the event-sourced connection_request is gone');
  assert.match(call, /eventId\s*:\s*fromEvent\?\.eventId \?\? null/, 'a request from an event no longer says the event');
});

test('4 · the notices the database writes insert their event_id', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const migs = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const [fn, type] of [
    ['release_full_schedule', 'schedule_released'],
    ['an_invitation_reaches_the_account', 'event_invitation'],
  ] as const) {
    const def = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\b`, 'i');
    const latest = migs.filter((f) => def.test(readFileSync(join(dir, f), 'utf8'))).pop();
    assert.ok(latest, `${fn} is defined nowhere`);
    const sql = readFileSync(join(dir, latest), 'utf8');
    const body = sql.slice(sql.toUpperCase().lastIndexOf(`CREATE OR REPLACE FUNCTION PUBLIC.${fn.toUpperCase()}`));
    assert.match(body, new RegExp(`INSERT INTO public\\.notifications \\([^)]*\\bevent_id\\b[^)]*\\)[\\s\\S]*?'${type}'`), `${fn} (${latest}) writes ${type} without event_id`);
  }
});
