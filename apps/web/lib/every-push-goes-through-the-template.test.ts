/**
 * every-push-goes-through-the-template.test.ts — NO PHONE NOTIFICATION IS
 * WRITTEN ANYWHERE BUT lib/push-message.ts.
 *
 * Owner, 2026-10-31: "Also fix the way how the notification messages the phones".
 * The fix is ONE template; this keeps it one. Across every source file in app/
 * and lib/ (comments stripped):
 *   1 · only the funnel (lib/push-send.server.ts) calls a channel sender
 *       (`sendWebPush(`, and `sendApns(` when it lands);
 *   2 · the raw `webpush.sendNotification(` appears only in the two delivery
 *       files, and each sends `pushWireBody(…)` — never a JSON it built;
 *   3 · a `PushMessage` is minted only in lib/push-message.ts (no `as PushMessage`
 *       anywhere else), so no file can hand a sender an inline title or body;
 *   4 · the funnel's notice carries no `title` — the template decides it.
 *
 * SABOTAGE (seen red, then restored): a direct
 * `sendWebPush(userId, { title: 'x' } as PushMessage)` added to notification-emit.ts
 * (1 and 3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))].map((p) => ({
  rel: relative(WEB, p),
  code: stripComments(readFileSync(p, 'utf8')),
}));

const FUNNEL = 'lib/push-send.server.ts';
const TEMPLATE = 'lib/push-message.ts';
const DELIVERY = new Set(['lib/web-push.ts', 'app/api/notify/route.ts']);

test('anchor — the tree was read', () => {
  assert.ok(FILES.length > 500, `only ${FILES.length} files read`);
  assert.ok(FILES.some((f) => f.rel === FUNNEL) && FILES.some((f) => f.rel === TEMPLATE));
});

test('1 · only the funnel calls a channel sender', () => {
  const callers = FILES.filter((f) => /\b(sendWebPush|sendApns)\s*\(/.test(f.code.replace(/export async function (sendWebPush|sendApns)\s*\(/g, '')))
    .map((f) => f.rel)
    .filter((rel) => rel !== FUNNEL && !DELIVERY.has(rel));
  assert.deepEqual(callers, [], `a push is sent around the template from: ${callers.join(', ')}`);
});

test('2 · the raw sender is only in the delivery files, and only sends the template\'s wire body', () => {
  for (const f of FILES) {
    if (!/\.sendNotification\s*\(/.test(f.code)) continue;
    assert.ok(DELIVERY.has(f.rel), `${f.rel} calls webpush.sendNotification directly`);
    const call = f.code.slice(f.code.indexOf('.sendNotification('), f.code.indexOf('.sendNotification(') + 300);
    assert.match(call, /pushWireBody\(/, `${f.rel} sends a payload it built itself`);
  }
});

test('3 · a PushMessage is minted only by the template', () => {
  const minted = FILES.filter((f) => f.rel !== TEMPLATE && /\bas PushMessage\b/.test(f.code)).map((f) => f.rel);
  assert.deepEqual(minted, [], `a push is written inline in: ${minted.join(', ')}`);
});

test('3b · every push passes its level — only the emit gate and the two scheduled moments reach the funnel', () => {
  const calling = (re: RegExp) => FILES.filter((f) => f.rel !== FUNNEL && re.test(f.code.replace(/export async function \w+\s*\(/g, ''))).map((f) => f.rel).sort();
  assert.deepEqual(calling(/\bsendPush\s*\(/), ['lib/push-schedule.server.ts', 'lib/rsvp-push.server.ts']);
  assert.deepEqual(calling(/\bsendPushForNotice\s*\(/), ['lib/notification-emit.ts', 'lib/push-schedule.server.ts']);
  assert.deepEqual(calling(/\bpushRsvpReply\s*\(/), ['lib/notification-emit.ts', 'lib/push-schedule.server.ts']);
  const emit = FILES.find((f) => f.rel === 'lib/notification-emit.ts')!.code;
  assert.match(emit, /if \(isAnyPushConfigured\(\) && pushDecision\(type, Date\.now\(\)\) === 'send'\) \{/, 'the emit path pushes without asking the level');
});

test('4 · the funnel\'s notice carries no title', () => {
  const funnel = FILES.find((f) => f.rel === FUNNEL)!.code;
  const sig = funnel.slice(funnel.indexOf('export async function sendPush('), funnel.indexOf('): Promise<void>', funnel.indexOf('export async function sendPush(')));
  assert.ok(sig.length > 0, 'sendPush moved — this guard is blind');
  assert.ok(!/\btitle\b/.test(sig), 'sendPush accepts a title — a caller could write the lock-screen line itself');
  assert.match(funnel, /pushMessage\(\{/);
});
