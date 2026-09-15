/**
 * THE COUPLE HAS TO BE TOLD, AND THE TELLING HAS TO LEAVE THE APP.
 *
 * 🚨 THE SHAPE THIS GUARDS, which has already cost this project twice:
 *
 *   · `emitNotification` and the email allowlist are TWO HALVES OF ONE
 *     MECHANISM. Having one is indistinguishable from having neither — a tray
 *     badge reaches nobody who is not already at a console, and the two people
 *     who need this notice are at their own reception. (The "you have been
 *     paid" alert shipped exactly this way and reached nobody.)
 *   · `MARKETING_GATED_EMAIL_TYPES` SUPPRESSES unless `users.marketing_opt_in`
 *     is TRUE — a NOT NULL DEFAULT FALSE column. All six `lock_request_*` types
 *     were on the email list AND in that set; both halves looked right in
 *     isolation and the suite stayed green because the test checked one list.
 *   · `notification_type` is a Postgres ENUM. A union member with no
 *     `ALTER TYPE … ADD VALUE` is REFUSED at INSERT, logged by design, and
 *     reaches nobody in perfect silence.
 *
 * So this asserts all three, plus that the emit site is actually wired to the
 * refusal — a notifier nothing calls is the same silence by another route.
 *
 * Reads SOURCE, not exports: both allowlists are module-private `const`s, and
 * `papic-pool-spent-notice.ts` is `server-only` so a test cannot import it.
 * That is precisely how this class of bug survives.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POOL_SPENT_NOTICE_WINDOW_MS,
  poolSpentNoticeBody,
  poolSpentNoticeTitle,
} from './papic-pool-spent-copy';
// 🔑 THE SHARED, STRING-AWARE STRIPPER — never a two-replace regex. `/*` inside
// a string (accept="image/*") opens a comment that runs to the next real close
// marker and blanks every line between, so a guard asserts against a blank and
// passes. lib/strip-comments.ts is a small lexer for exactly that reason.
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const REPO = join(WEB, '..', '..');
const EMIT = readFileSync(join(WEB, 'lib', 'notification-emit.ts'), 'utf8');

/** The body of one `const NAME: … = new Set([ … ]);` declaration. */
function setBody(name: string): string {
  const start = EMIT.indexOf(`const ${name}`);
  assert.notEqual(start, -1, `${name} must exist — this guard is worthless if it finds nothing`);
  const open = EMIT.indexOf('new Set([', start);
  assert.notEqual(open, -1, `${name} must be a Set literal`);
  const close = EMIT.indexOf(']);', open);
  assert.notEqual(close, -1, `${name} must be closed`);
  return stripComments(EMIT.slice(open, close));
}

// ── half one: the notification exists and the database knows the label ─────

test('the type is in the NotificationType union', () => {
  const src = readFileSync(join(WEB, 'lib', 'notifications.ts'), 'utf8');
  assert.match(stripComments(src), /\|\s*'papic_pool_spent'/);
});

test('a migration teaches the enum the label', () => {
  // Without it the INSERT is refused, emitNotification logs and continues, and
  // the couple is never told — with green CI the whole way.
  const dir = join(REPO, 'supabase', 'migrations');
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  const hit = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .some((f) =>
      /ALTER\s+TYPE\s+public\.notification_type\s+ADD\s+VALUE[^\n;]*'papic_pool_spent'/i.test(
        readFileSync(join(dir, f), 'utf8'),
      ),
    );
  assert.ok(hit, "no migration adds 'papic_pool_spent' to public.notification_type");
});

// ── half two: and it leaves the app ────────────────────────────────────────

test('the notice is emailed', () => {
  assert.match(
    setBody('EMAIL_ENABLED_TYPES'),
    /'papic_pool_spent'/,
    'the couple are at their own reception — an in-app-only notice reaches ' +
      'exactly the people who cannot see it',
  );
});

test('the notice is NOT marketing-gated', () => {
  assert.doesNotMatch(
    setBody('MARKETING_GATED_EMAIL_TYPES'),
    /'papic_pool_spent'/,
    'that set suppresses unless marketing_opt_in is TRUE, which defaults FALSE ' +
      '— it silences the notice for everybody',
  );
});

test('the comment stripper is not itself the reason these pass', () => {
  const emails = setBody('EMAIL_ENABLED_TYPES');
  assert.match(emails, /'order_paid'/, 'stripComments destroyed the set body');
  assert.ok(emails.length > 200, 'stripComments destroyed the set body');
});

// ── and something actually calls it ────────────────────────────────────────

test('both refusal seams call the notifier', () => {
  for (const rel of [
    ['app', 'api', 'upload', 'route.ts'],
    ['app', 'api', 'papic', 'guest-capture', 'route.ts'],
  ]) {
    const src = stripComments(readFileSync(join(WEB, ...rel), 'utf8'));
    assert.match(
      src,
      /tellTheCouplePapicPoolIsSpent\(/,
      `${rel.join('/')} refuses a capture without telling the couple`,
    );
  }
});

test('the presign seam tells them only for the POOL cause', () => {
  // Firing for a guest whose OWN camera is spent would be noise the couple
  // cannot act on, and noise is what teaches people to ignore the real one.
  const src = stripComments(
    readFileSync(join(WEB, 'app', 'api', 'upload', 'route.ts'), 'utf8'),
  );
  const at = src.indexOf('tellTheCouplePapicPoolIsSpent(');
  assert.ok(at > 0);
  const before = src.slice(Math.max(0, at - 400), at);
  assert.match(
    before,
    /cause === 'event_pool'/,
    "the presign notifier must be gated on the pool cause",
  );
});

test('the notifier dedupes rather than firing once per refused shot', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'lib', 'papic-pool-spent-notice.ts'), 'utf8'),
  );
  assert.match(src, /POOL_SPENT_NOTICE_WINDOW_MS/);
  assert.match(src, /\.eq\('type',\s*'papic_pool_spent'\)/);
  assert.match(src, /if \(\(already \?\? \[\]\)\.length > 0\) return;/);
});

// ── the words ──────────────────────────────────────────────────────────────

test('the window is a window, not "ever"', () => {
  // A couple who top up and run dry again on a second day must be told again.
  assert.ok(POOL_SPENT_NOTICE_WINDOW_MS > 0);
  assert.ok(POOL_SPENT_NOTICE_WINDOW_MS <= 24 * 60 * 60 * 1000);
});

test('the notice names the consequence happening right now', () => {
  const body = poolSpentNoticeBody('Ana & Rico');
  assert.match(body, /Ana & Rico/, 'it must name their celebration');
  assert.match(
    body,
    /turned away|refused|cannot take/i,
    'an empty-pot accounting line is not the same fact as guests being refused ' +
      'while the reception is still on',
  );
  assert.match(body, /do not refill|don’t refill/i);
  assert.doesNotMatch(body, /refills? tomorrow|today’s shots/i);
});

test('the title fits the notifications title column', () => {
  // notifications_title_check: 0 < length(title) <= 160, and emitNotification
  // slices — a truncated subject line is a sentence that stops mid-word.
  const t = poolSpentNoticeTitle();
  assert.ok(t.length > 0 && t.length <= 160, `title is ${t.length} chars`);
});
