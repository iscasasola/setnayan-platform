/**
 * the-app-offers-saved-passwords.test.ts — the iPhone app's sign-in can fill
 * a password saved for setnayan.com.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * Owner, 27 Nov 2026 (Apple walkthrough): the app's sign-in would not offer his
 * saved passwords. iOS only offers a site's saved passwords inside an app when
 * BOTH halves agree: the site's apple-app-site-association lists the app under
 * `webcredentials`, and the app's entitlements claim `webcredentials:<domain>`.
 * Neither half existed — only `applinks` did.
 *
 * 🛡 Mutation-checked: removing either half goes red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const AASA = join(WEB, 'public/.well-known/apple-app-site-association');
const ENT = join(WEB, '..', 'mobile/ios/App/App/App.entitlements');
const APP_ID = 'P95JPDWWB3.com.setnayan.app';

test('the site names the app for saved passwords', () => {
  const aasa = JSON.parse(readFileSync(AASA, 'utf8'));
  assert.deepEqual(aasa.webcredentials?.apps, [APP_ID]);
});

test('the app claims the same domain for passwords as for links', () => {
  const xml = readFileSync(ENT, 'utf8');
  const domains = xml.match(/<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>([\s\S]*?)<\/array>/);
  assert.ok(domains, 'associated-domains entitlement exists');
  const entries = [...domains[1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]);
  assert.ok(entries.includes('applinks:www.setnayan.com'));
  assert.ok(entries.includes('webcredentials:www.setnayan.com'), 'webcredentials claim for the sign-in domain');
});
