/**
 * The banner must stop re-asking people who already answered.
 *
 * 🔴 THE BUG, as the owner reported it: *"it re-asks people who have already
 * answered."* The choice lived ONLY in `localStorage`, written by script.
 * **Safari's Intelligent Tracking Prevention deletes all script-writable
 * storage after seven days without a first-party interaction** — localStorage,
 * IndexedDB and `document.cookie` alike. Answer once, return a fortnight later,
 * get asked again, on a device where nothing was broken.
 *
 * ⚖ HOW THAT DIAGNOSIS WAS REACHED, stated plainly because it was NOT observed:
 * I did not watch Safari purge anything. What was checked is everything else —
 * the storage key has never been version-bumped (one commit in its whole
 * history), the banner's own show/hide logic is correct, and the origin-split
 * theory was already eliminated (`setnayan.com` 307s to `www`, `setnayan.ph`
 * does not resolve). Storage lifetime is what is left, and the known Safari
 * behaviour matches the symptom exactly.
 *
 * 🔑 WHY `document.cookie` WOULD NOT HAVE FIXED IT — the trap in this fix.
 * ITP's seven-day cap is about **how a value was written**, not what it is. A
 * cookie written by script is capped exactly like localStorage. Only a
 * `Set-Cookie` from our own server escapes it. That is the entire reason
 * `POST /api/cookie-consent` exists rather than one more line in `writeConsent`.
 *
 * ⚖ AND THE BOUNDARY THIS MUST NOT CROSS. The fix stays **per-device and
 * anonymous**: a cookie on the browser that answered, and nothing else. No
 * database row, no account, no identifier. Keying consent to a USER would
 * create an RA 10173 proof-of-consent record — a DPO decision the owner has not
 * made. A test below fails if this route ever starts writing to the database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSENT_COOKIE_MAX_AGE, CONSENT_STORAGE_KEY } from './cookie-consent';

const HERE = dirname(fileURLToPath(import.meta.url));
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const LIB = strip(readFileSync(resolve(HERE, 'cookie-consent.ts'), 'utf8'));
const ROUTE = strip(
  readFileSync(resolve(HERE, '..', 'app', 'api', 'cookie-consent', 'route.ts'), 'utf8'),
);

test('the choice outlives Safari’s seven-day purge', () => {
  const SEVEN_DAYS = 7 * 24 * 60 * 60;
  assert.ok(
    CONSENT_COOKIE_MAX_AGE > SEVEN_DAYS * 4,
    `the cookie expires in ${CONSENT_COOKIE_MAX_AGE}s — the bug is a 7-day purge`,
  );
});

test('🔑 the durable copy is set by the SERVER, never by document.cookie', () => {
  // The whole fix. A script-written cookie is capped exactly like localStorage,
  // so persisting it client-side would have changed nothing a visitor can feel.
  assert.ok(
    !/document\.cookie\s*=/.test(LIB),
    'the consent cookie is written by script — ITP caps that at 7 days too',
  );
  assert.match(ROUTE, /res\.cookies\.set\(/, 'the route does not set a cookie');
  assert.match(LIB, /fetch\('\/api\/cookie-consent'/, 'nothing asks the server to persist it');
});

test('the cookie is readable by the banner, so it cannot flash', () => {
  // httpOnly would make a returning visitor watch the banner appear and vanish.
  assert.match(ROUTE, /httpOnly:\s*false/, 'the banner cannot read the cookie it relies on');
  assert.match(LIB, /document\.cookie\.split/, 'readConsent never looks at the cookie');
});

test('the cookie is read BEFORE localStorage', () => {
  // On the visit where the purge has happened, the cookie is the only record
  // that exists. Reading localStorage first would find nothing and re-ask.
  assert.match(
    LIB,
    /readConsentCookie\(\)\s*\?\?\s*window\.localStorage\.getItem/,
    'localStorage is consulted first — on a purged device that means re-asking',
  );
});

test('localStorage is KEPT, so nobody who already decided is re-asked', () => {
  // Everyone who chose before this shipped has only the localStorage copy.
  // Dropping it to "tidy up" would re-ask exactly the people this fix is for.
  assert.match(LIB, /window\.localStorage\.setItem\(CONSENT_STORAGE_KEY/, 'localStorage write removed');
});

test('⚖ it stays per-device and anonymous — no record keyed to a person', () => {
  // The line this fix must not cross. A durable proof-of-consent record keyed
  // to a user is a DPO decision, not a bug fix.
  for (const forbidden of ['createAdminClient', 'createClient', 'auth.getUser', '.from(']) {
    assert.ok(
      !ROUTE.includes(forbidden),
      `the consent route reaches for "${forbidden}" — that turns a per-device choice into a stored record about a person`,
    );
  }
});

test('a malformed body cannot write a cookie', () => {
  assert.match(ROUTE, /typeof analytics !== 'boolean'/, 'the route accepts any body');
  assert.match(ROUTE, /status: 400/, 'the route has no refusal path');
});

test('both stores use the same key, so they cannot disagree', () => {
  assert.equal(CONSENT_STORAGE_KEY, 'setnayan-cookie-consent-v1');
  assert.match(ROUTE, /name: CONSENT_STORAGE_KEY/, 'the route hardcodes its own key');
});

test('persisting must never block the choice taking effect', () => {
  // It runs from a click handler. A slow or failed request must not stop the
  // banner closing or analytics honouring the answer in this tab.
  assert.match(LIB, /void fetch\('\/api\/cookie-consent'/, 'the request is awaited in a click handler');
  assert.match(LIB, /\.catch\(\(\) => \{\}\)/, 'a failed request can reject unhandled');
});
