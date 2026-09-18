/**
 * EVERY EMAIL SAYS WHETHER IT ARRIVED — the wiring guard.
 *
 * The verdicts are executed in `email-delivery-log.test.ts`. This file pins the
 * three things that can be lost silently around them:
 *
 *   1. THE CHOKE POINT. Every Resend send goes through `sendEmail`, and
 *      `sendEmail` records the outcome. A second place that imports `resend`
 *      and sends is an email the log cannot see.
 *   2. THE MOUNTS. A strip that is defined and never rendered — or rendered
 *      behind a constant `false` — is a log line, not a pixel.
 *   3. THE LINK. The home strip jumps to `#email-delivery`; a fragment to an id
 *      that does not exist fails silently.
 *
 * Comments are stripped before every search, so a docblock naming a symbol can
 * never satisfy an assertion about code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const WEB = process.cwd();
const code = (rel: string) =>
  readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const count = (s: string, needle: string) => s.split(needle).length - 1;

test('ANCHOR — this runs from apps/web and reads real files', () => {
  const email = code('lib/email.ts');
  assert.ok(email.length > 2000, `lib/email.ts read as ${email.length} chars`);
  assert.ok(email.includes('export async function sendEmail'), 'sendEmail not found');
});

test('only lib/email.ts sends through Resend (the checker only READS status)', () => {
  const out = execFileSync('git', ['grep', '-l', '-F', "import('resend')", '--', 'lib', 'app'], {
    cwd: WEB,
    encoding: 'utf8',
  });
  const files = out.split('\n').filter(Boolean).filter((f) => !f.endsWith('.test.ts')).sort();
  console.log(`# files importing resend: ${files.join(', ')}`);
  assert.deepEqual(
    files,
    ['lib/email-delivery.server.ts', 'lib/email.ts'],
    'A new file imports `resend`. If it SENDS, route it through sendEmail — otherwise that email is invisible to the delivery log.',
  );
  const checker = code('lib/email-delivery.server.ts');
  assert.equal(count(checker, 'emails.send('), 0, 'the delivery checker must never send');
  assert.equal(count(checker, 'emails.get('), 1, 'the checker asks Resend for status exactly once per row');
});

test('sendEmail records every attempt through ONE exit', () => {
  const email = code('lib/email.ts');
  const start = email.indexOf('export async function sendEmail');
  const end = email.indexOf('\n}\n', start);
  const body = email.slice(start, end);
  console.log(`# sendEmail body: ${body.length} chars`);
  assert.ok(body.length > 200 && end > start, 'could not isolate sendEmail');
  assert.equal(count(body, 'await sendViaResend('), 1, 'sendEmail must call the Resend sender exactly once');
  assert.equal(count(body, 'await recordDelivery('), 1, 'sendEmail must record the outcome exactly once');
  assert.ok(
    body.indexOf('await recordDelivery(') > body.indexOf('await sendViaResend('),
    'the outcome is recorded AFTER the send, from its result',
  );
  // The only early return is the placeholder address — not an email attempt.
  assert.equal(count(body, 'return '), 2, 'a new early return in sendEmail would skip the log');
  // Nothing else in the file may call the raw sender.
  assert.equal(count(email, 'sendViaResend('), 2, 'sendViaResend is defined once and called once');
});

test('a notification email is tagged with its type', () => {
  const emit = code('lib/notification-emit.ts');
  assert.match(emit, /sendEmail\(\{[^}]*\bkind: type,/, 'emitNotification must pass kind: type');
});

test('the home strip is mounted — once, unconditionally', () => {
  const home = code('app/admin/page.tsx');
  assert.equal(count(home, '<EmailDeliveryStrip />'), 1);
  const at = home.indexOf('<EmailDeliveryStrip />');
  const before = home.slice(Math.max(0, at - 120), at);
  assert.ok(!/(false|0)\s*&&\s*[\s\S]*$/.test(before.split('\n').slice(-3).join('\n')), 'mounted behind a constant');
});

test('the Notifications tab renders the list, and the strip links to its id', () => {
  const surface = code('app/admin/settings/_surfaces/notifications-surface.tsx');
  assert.equal(count(surface, '<EmailDeliverySection />'), 1);
  const strip = code('app/admin/_email-delivery-strip.tsx');
  const m = strip.match(/href="\/admin\/settings\?tab=notifications#([a-z-]+)"/);
  assert.ok(m, 'the strip must link to the Notifications tab');
  const section = code('app/admin/settings/_components/email-delivery-section.tsx');
  assert.equal(count(section, `id="${m![1]}"`), 1, `#${m![1]} must exist exactly once on the target`);
});
