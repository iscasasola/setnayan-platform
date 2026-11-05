/**
 * 📶 A GUEST-FACING LIMIT IS COUNTED FOR REAL — event-day L1·8.
 *
 * `rateLimit()` (lib/rate-limit.ts) is an in-memory window PER WARM SERVERLESS
 * INSTANCE. On Vercel one caller is spread over many instances, so a limit of
 * 10 is really 10 × N — not a limit. `enforceRateLimit()` (lib/with-rate-limit.ts)
 * keeps that window as its L1 and adds the Postgres window as L2 (fails open on
 * a database fault). Every guest/public-facing door named in the event-day audit
 * now goes through it, with its numbers kept — except where a number counted
 * for real would refuse a venue sharing one Wi-Fi, which is raised and says so.
 *
 * Two doors stay on the bare limiter ON PURPOSE, each with its reason held here:
 *   · app/papic/media/[...key]/route.ts — every still and clip a guest gallery
 *     shows is one GET. Counted durably, every image would be a write into
 *     `rate_limit_hits` (thousands a minute at a busy reception, on a 60-connection
 *     database), and 600/min for ONE venue address counted across instances
 *     would black out galleries at exactly the moment they are opened together.
 *   · app/api/vendor/qr-guard/route.ts — a signed-in SUPPLIER's own pre-save
 *     check on their showcase media; not a guest or public door.
 *   · app/api/sign-in/google-domain/route.ts — "is this DOMAIN's mail Google?",
 *     asked while a person types an address on the sign-in / sign-up card
 *     (2026-10-18). It reads only public DNS, answers are cached in the process
 *     and at the edge, and it writes nothing; a durable count would turn every
 *     typing pause on every sign-in card into a `rate_limit_hits` write for a
 *     question anyone can ask DNS directly.
 * (login / forgot-password / csp-report / client-fault were not in the audit's
 * list and are unchanged.)
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • rotate-qr back on the bare limiter import                 → tests 1, 3 red;
 *   • the order-link token handed to the limiter unhashed         → test 2 red;
 *   • a new bare `rateLimit(` import in app/papic/buy/actions.ts  → tests 1, 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const DURABLE = [
  'app/api/upload/route.ts',
  'app/[slug]/rotate-qr-actions.ts',
  'app/live/actions.ts',
  'app/papic/buy/actions.ts',
];

const BARE_ON_PURPOSE = new Set([
  'app/papic/media/[...key]/route.ts',
  'app/api/vendor/qr-guard/route.ts',
  'app/api/sign-in/google-domain/route.ts',
  // not in the audit's list:
  'app/login/actions.ts',
  'app/forgot-password/actions.ts',
  'app/api/csp-report/route.ts',
  'app/api/telemetry/client-fault/route.ts',
]);

test('1 · the audited guest doors count through the durable limiter', () => {
  for (const f of DURABLE) {
    const src = read(f);
    assert.doesNotMatch(src, /from '@\/lib\/rate-limit'/, `${f} is back on the per-instance limiter`);
    assert.match(src, /\benforceRateLimit\(/, `${f} no longer limits durably`);
  }
});

test('2 · no address and no credential is stored raw by those limits', () => {
  assert.match(read('app/[slug]/rotate-qr-actions.ts'), /enforceRateLimit\('guest_qr_rotate_ip', joinDoorIdent\(session\.event_id, ip\)/);
  assert.match(read('app/live/actions.ts'), /enforceRateLimit\('live_screen_pair', joinDoorIdent\('live-screen', ip\)/);
  assert.match(read('app/papic/buy/actions.ts'), /enforceRateLimit\('papic_pay', joinDoorIdent\('papic-pay', token\)/, 'the order link’s token is written into the limiter log');
});

test('3 · the bare limiter is imported only where this file says why', () => {
  const users: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        if (/import \{[^}]*\brateLimit\b[^}]*\} from '@\/lib\/rate-limit'/.test(readFileSync(full, 'utf8'))) {
          users.push(full.slice(WEB.length + 1));
        }
      }
    }
  };
  walk(join(WEB, 'app'));
  const unexplained = users.filter((u) => !BARE_ON_PURPOSE.has(u));
  assert.deepEqual(unexplained, [], `a door counts per instance only — make it durable or say why here: ${unexplained.join(', ')}`);
});
