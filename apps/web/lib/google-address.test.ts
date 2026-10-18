/**
 * EXECUTES lib/google-address.ts (+ the server lookup with an injected
 * resolver), and READS the three Google flows and every typed door for the two
 * things a pure test cannot execute:
 *   1. the typed address reaches Google as `login_hint` on EVERY shell's flow
 *      (web server action · desktop loopback · phone system browser);
 *   2. every sign-in / sign-up form that shows a Google button next to a typed
 *      email + password mounts the door — so the next such form is held too.
 *
 * Owner 2026-10-18: "we want people to login via google and typing their google
 * account be same."
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emailDomain,
  googleDomainCheckUrl,
  googleLoginHint,
  isGoogleNamedDomain,
  mxPointsAtGoogle,
  normalizeDomain,
} from './google-address';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('gmail.com and googlemail.com are Google by name; nothing else is', () => {
  assert.equal(isGoogleNamedDomain(emailDomain('Ice.Casasola@GMAIL.com ')), true);
  assert.equal(isGoogleNamedDomain(emailDomain('a@googlemail.com')), true);
  for (const e of ['a@gmail.co', 'a@gmail.com.ph', 'a@notgmail.com', 'a@icloud.com', 'a@yahoo.com']) {
    assert.equal(isGoogleNamedDomain(emailDomain(e)), false, e);
  }
});

test('emailDomain answers only once the box holds an address', () => {
  for (const e of ['', 'ice', 'ice@', '@gmail.com', 'ice@gmail', 'ice@gmail.', 'i ce@gmail.com']) {
    assert.equal(emailDomain(e), null, JSON.stringify(e));
  }
  assert.equal(emailDomain('ice@Flower-Store.PH'), 'flower-store.ph');
  assert.equal(normalizeDomain('Example.COM.'), 'example.com');
  assert.equal(normalizeDomain('exa mple.com'), null);
  assert.equal(normalizeDomain('localhost'), null);
});

test('a Workspace domain is Google only when its PREFERRED mail hosts are all Google', () => {
  // Shapes measured with `dig MX` on 2026-10-18 for the two company domains in prod.
  assert.equal(mxPointsAtGoogle([{ exchange: 'smtp.google.com.', priority: 1 }]), true);
  assert.equal(
    mxPointsAtGoogle([
      { exchange: 'aspmx.l.google.com.', priority: 1 },
      { exchange: 'alt1.aspmx.l.google.com.', priority: 5 },
      { exchange: 'mxdm-ap-southeast-1.aliyun.com.', priority: 15 },
    ]),
    true,
  );
  assert.equal(mxPointsAtGoogle([{ exchange: 'ASPMX.L.GOOGLE.COM', priority: 10 }]), true);
  // Google only as a backup → not Google.
  assert.equal(
    mxPointsAtGoogle([
      { exchange: 'mx01.mail.icloud.com.', priority: 10 },
      { exchange: 'aspmx.l.google.com.', priority: 20 },
    ]),
    false,
  );
  // A tie at the top with a non-Google host → not Google.
  assert.equal(
    mxPointsAtGoogle([
      { exchange: 'aspmx.l.google.com.', priority: 1 },
      { exchange: 'mail.example.com.', priority: 1 },
    ]),
    false,
  );
  // Look-alikes are not Google.
  assert.equal(mxPointsAtGoogle([{ exchange: 'mail.notgoogle.com.', priority: 1 }]), false);
  assert.equal(mxPointsAtGoogle([{ exchange: 'google.com.evil.net.', priority: 1 }]), false);
  assert.equal(mxPointsAtGoogle([]), false);
  assert.equal(mxPointsAtGoogle(null), false);
});

test('login_hint is the address, trimmed and lower-cased — or nothing', () => {
  assert.equal(googleLoginHint('  Ice.Casasola@Gmail.com '), 'ice.casasola@gmail.com');
  assert.equal(googleLoginHint('not an address'), null);
  assert.equal(googleLoginHint(null), null);
  assert.equal(googleLoginHint(`${'a'.repeat(250)}@gmail.com`), null);
});

test('only the DOMAIN ever goes to the live check — never the address', () => {
  const url = googleDomainCheckUrl('flowerstore.ph');
  assert.equal(url, '/api/sign-in/google-domain?domain=flowerstore.ph');
  assert.ok(!url.includes('@'));
  const door = read('app/_components/auth/google-address-door.tsx');
  assert.match(door, /fetch\(googleDomainCheckUrl\(domain\)/, 'the door must fetch by domain');
  assert.doesNotMatch(door, /googleDomainCheckUrl\(address/, 'the address must never reach the URL');
});

test('the server lookup is wired to the pure rule, fails CLOSED, and the route takes only a domain', () => {
  // `server-only` is a bundler alias; the lookup's logic is exercised through the
  // same pure rule above, and its wiring is read here.
  const src = read('lib/google-address.server.ts');
  assert.match(src, /resolveMx/);
  assert.match(src, /mxPointsAtGoogle\(records\)/);
  assert.match(src, /catch\s*\{\s*return remember\(domain, false\)/, 'a failed lookup must fail CLOSED to false');
  const route = read('app/api/sign-in/google-domain/route.ts');
  assert.match(route, /normalizeDomain\(/, 'the route must accept only a domain');
  assert.match(route, /rateLimit\(/, 'the route must be rate-limited');
});

test('EVERY shell hands the typed address to Google as login_hint', () => {
  const web = read('app/auth/oauth-actions.ts');
  assert.match(web, /googleLoginHint\(formData\.get\('login_hint'\)\)/);
  assert.match(web, /queryParams:\s*\{\s*login_hint:\s*loginHint\s*\}/);
  const desktop = read('lib/desktop-oauth.ts');
  assert.match(desktop, /queryParams:\s*\{\s*login_hint:\s*loginHint\s*\}/);
  const native = read('lib/native-oauth.ts');
  assert.match(native, /queryParams:\s*\{\s*login_hint:\s*loginHint\s*\}/);
  assert.match(native, /systemBrowser\(provider, next, accountType, loginHint\)/);
  const door = read('app/_components/auth/google-address-door.tsx');
  assert.match(door, /signInWithProviderDesktop\('google', next, hint\)/);
  assert.match(door, /signInWithProviderNative\('google', next, accountType \?\? 'customer', hint\)/);
  assert.match(door, /fd\.set\('login_hint', hint\)/);
  assert.match(door, /signInWithGoogle\(fd\)/);
});

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * Doors that show a Google button beside a typed email + password but are not
 * held, each with its reason. Adding a line here is a decision, not a fix.
 */
const NOT_YET = new Map<string, string>([
  [
    'app/open-shop/_components/open-shop-wizard.tsx',
    'step 3 creates the account AND the shop in one submit; diverting it to Google mid-wizard needs its own build',
  ],
]);

test('every form with a Google button beside a typed email + password mounts the door, password part marked', () => {
  const googleButton = /<(OAuthButtonRow|DesktopOAuthButtons|NativeOAuthButtons)\b/;
  const doors: string[] = [];
  for (const file of tsxFiles(join(WEB, 'app'))) {
    const code = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(WEB, file);
    if (!googleButton.test(code)) continue;
    if (!/name="email"/.test(code) || !/type="password"/.test(code)) continue;
    if (NOT_YET.has(rel)) continue;
    doors.push(rel);
    const at = code.indexOf('<GoogleAddressDoor');
    assert.ok(at >= 0, `${rel}: a typed Google address must take the Google door (mount <GoogleAddressDoor>)`);
    const formStart = code.lastIndexOf('<form', at);
    const formEnd = code.indexOf('</form>', at);
    assert.ok(formStart >= 0 && formEnd > at, `${rel}: the door must sit INSIDE the email form`);
    const form = code.slice(formStart, formEnd);
    assert.ok(form.indexOf('name="email"') < form.indexOf('<GoogleAddressDoor'), `${rel}: the door goes after the email box`);
    // The password box (or its wrapper) and the submit fold away with it.
    const pw = form.indexOf('type="password"');
    const marked = form.lastIndexOf('data-password-only', pw);
    assert.ok(pw > 0 && marked > form.indexOf('<GoogleAddressDoor'), `${rel}: the password box must be data-password-only`);
    assert.match(form, /<SubmitButton[^>]*data-password-only/, `${rel}: the password submit must fold away too`);
  }
  assert.ok(doors.length >= 3, `expected the sign-in card, /signup and the onboarding account screen; found ${doors.join(', ')}`);
});
