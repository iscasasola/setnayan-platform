/**
 * "ADD TO APPLE WALLET" STANDS BESIDE "SAVE MY TICKET" — ON AN iPHONE — AND NEVER WITHOUT A PASS THAT CAN BE SIGNED.
 *
 * Owner, 2026-10-25 (DECISION_LOG "ADD TO APPLE WALLET IS ON FOR EVERYONE"): the RSVP ends with "You're on the list →
 * Save my ticket", and **Add to Apple Wallet** sits beside Save my ticket on iPhone — switched on for everyone (*"any
 * build that we have should not be for internal only"*). Three promises, each EXECUTED where it can be:
 *
 *   1 · WHERE — the button is drawn only by the three places that draw "Save my ticket" for a guest's OWN ticket (Me's
 *       `GuestTicket`, the thank-you page, its "ticket updated" pop-up), right after that Save, and only for a real
 *       ticket — rendered, not read, for `GuestTicket`.
 *   2 · WHO — an iPhone only. Android, a Mac, Windows and an unknown browser get nothing (`appleWalletLink`).
 *       Messenger on an iPhone gets the Safari hand-off; the Setnayan app gets its in-app browser sheet.
 *   3 · NEVER WITHOUT A SIGNABLE PASS — `offered` is false → no button anywhere; the pages ask `appleWalletOffered()`,
 *       which answers from a REAL probe signature (`probeSigner`), not from "the six values are present": a wrong
 *       passphrase, an expired certificate, a key that is not the certificate's own and a garbled certificate each
 *       draw nothing. And no switch and no `is_internal` gate is left on the path.
 *
 * 🔒 Throwaway certificates, minted in memory. No Apple value is read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import forge from 'node-forge';
import { stripComments } from './strip-comments';
import { APPLE_WALLET_ROUTE, PASS_CARD_WORDS } from './pass-card';
import { appleWalletLink, walletBackPath, walletNoticeHtml, type AppleWalletLink } from './wallet-pass';
import { probeSigner } from './wallet-pass-pkpass';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const LINK = 'https://setnayan.com/indalecio-claire/invite?sample=guest-link';
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  iphoneMessenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]',
  iphoneApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp SetnayanSignIn/1 SetnayanIAP/2',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  androidApp: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 SetnayanApp SetnayanSignIn/1',
  androidMessenger: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0]',
} as const;

// ─── 2 · WHO ─────────────────────────────────────────────────────────────────

test('2 · an iPhone only — Android, a Mac, Windows and nothing-at-all get no button', () => {
  const kinds: Record<string, AppleWalletLink['kind'] | null> = {};
  for (const [name, ua] of Object.entries(UA)) {
    kinds[name] = appleWalletLink(ua, LINK, true, { storeShell: /SetnayanApp/.test(ua) })?.kind ?? null;
  }
  kinds.none = appleWalletLink(null, LINK, true)?.kind ?? null;
  assert.deepEqual(kinds, {
    iphoneSafari: 'download',
    iphoneChrome: 'download',
    iphoneMessenger: 'safari',
    iphoneApp: 'sheet',
    ipad: 'download',
    macSafari: null,
    macChrome: null,
    windows: null,
    android: null,
    androidApp: null,
    androidMessenger: null,
    none: null,
  });
  const dl = appleWalletLink(UA.iphoneSafari, LINK, true)!;
  assert.deepEqual(dl, { kind: 'download', href: APPLE_WALLET_ROUTE, label: PASS_CARD_WORDS.appleWallet });
  // The app's sheet opens the guest's OWN link (which signs them in there) — never the route, whose cookie the sheet lacks.
  assert.equal(appleWalletLink(UA.iphoneApp, LINK, true, { storeShell: true })!.href, LINK);
  assert.equal(appleWalletLink(UA.iphoneApp, 'not a link', true, { storeShell: true }), null);
});

// ─── 3 · NEVER WITHOUT A SIGNABLE PASS ──────────────────────────────────────

test('3a · not offered → no button for anybody, whatever the device', () => {
  for (const ua of [...Object.values(UA), null]) {
    assert.equal(appleWalletLink(ua, LINK, false), null);
    assert.equal(appleWalletLink(ua, LINK, false, { storeShell: true }), null);
  }
});

function mint(opts: { notBefore?: string; notAfter?: string; passphrase?: string } = {}) {
  const mk = () => generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ca = mk();
  const leaf = mk();
  const other = mk();
  const caKey = forge.pki.privateKeyFromPem(ca.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString());
  const cert = (pub: string, cn: string, serial: string) => {
    const c = forge.pki.createCertificate();
    c.publicKey = forge.pki.publicKeyFromPem(pub);
    c.serialNumber = serial;
    c.validity.notBefore = new Date(opts.notBefore ?? '2026-01-01');
    c.validity.notAfter = new Date(opts.notAfter ?? '2027-11-12');
    c.setSubject([{ name: 'commonName', value: cn }]);
    c.setIssuer([{ name: 'commonName', value: 'Throwaway WWDR' }]);
    c.sign(caKey, forge.md.sha256.create());
    return forge.pki.certificateToPem(c);
  };
  const passphrase = opts.passphrase ?? 'throwaway';
  return {
    signer: {
      certPem: cert(leaf.publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'Pass Type ID: pass.test', '02'),
      keyPem: leaf.privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase }).toString(),
      keyPassphrase: passphrase,
      wwdrPem: cert(ca.publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'Throwaway WWDR', '01'),
    },
    otherKeyPem: other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

test('3b · the probe signs for real: a good set passes; a wrong passphrase, an expired certificate, a stranger’s key and a garbled certificate each fail', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  const { signer, otherKeyPem } = mint();
  const ok = probeSigner(signer, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.notAfter.toISOString(), '2027-11-12T00:00:00.000Z');

  const step = (p: ReturnType<typeof probeSigner>) => (p.ok ? 'ok' : p.step);
  assert.equal(step(probeSigner({ ...signer, keyPassphrase: 'wrong' }, now)), 'key');
  assert.equal(step(probeSigner(signer, new Date('2027-11-12T00:00:01Z'))), 'expired');
  assert.equal(step(probeSigner(mint({ notBefore: '2027-01-01' }).signer, now)), 'expired');
  assert.equal(step(probeSigner({ ...signer, keyPem: otherKeyPem, keyPassphrase: null }, now)), 'mismatch');
  assert.equal(step(probeSigner({ ...signer, certPem: '-----BEGIN CERTIFICATE-----\nnot a certificate\n-----END CERTIFICATE-----' }, now)), 'certificate');
  assert.equal(step(probeSigner({ ...signer, wwdrPem: '' }, now)), 'wwdr');
});

test('3c · the pages ask the PROBE — `appleWalletOffered` answers from `probeSigner`; no switch, no `is_internal` on the path', () => {
  const config = code('lib/wallet-pass-config.server.ts');
  const offered = config.slice(config.indexOf('export async function appleWalletOffered'));
  assert.ok(offered.length > 50, 'appleWalletOffered is gone, or is no longer async');
  assert.match(offered, /if \(!config\.ok\) return false;/, 'appleWalletOffered no longer refuses a missing set');
  assert.match(offered, /probeSigner\(config\.signer/, 'appleWalletOffered no longer asks the probe signature');
  assert.match(offered, /if \(!probe\?\.ok\) return false;/, 'a failed probe no longer draws nothing');
  const path = [
    'lib/wallet-pass-config.server.ts',
    'lib/wallet-pass.ts',
    'app/api/guest/wallet/apple/route.ts',
    'app/[slug]/_components/apple-wallet-button.tsx',
    'app/[slug]/_components/apple-wallet-sheet-link.tsx',
  ];
  for (const rel of path) {
    const src = code(rel);
    assert.doesNotMatch(src, /WALLET_PASS_ENABLED|envFlagEnabled|is_internal|isInternal/, `${rel}: a switch or an internal-only gate is back on the Wallet path`);
  }
  // Every caller hands `appleWalletLink` the probe's answer — never `true`, never a flag.
  const callers = walk(join(WEB, 'app')).filter((p) => code(relative(WEB, p)).includes('appleWalletLink('));
  const calls: string[] = [];
  for (const p of callers) {
    for (const m of code(relative(WEB, p)).matchAll(/appleWalletLink\(([^;]*?)\)\s*(?::|;)/g)) calls.push(`${relative(WEB, p)} :: ${m[1]}`);
  }
  assert.equal(calls.length, 2, `appleWalletLink callers moved: ${JSON.stringify(calls)}`);
  for (const c of calls) assert.match(c, /,\s*await appleWalletOffered\(\),/, `a caller does not hand appleWalletLink the probe's answer: ${c}`);
});

// ─── 1 · WHERE ───────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const GUEST_TICKET = 'app/[slug]/_components/guest-ticket.tsx';
const POPUP = 'app/[slug]/_components/ticket-popup.tsx';
const THANK_YOU = 'app/[slug]/invite/enter/page.tsx';

test('1a · exactly three places draw the button — one mount each, and each is a "Save my ticket" place', () => {
  const mounts: Record<string, number> = {};
  for (const p of walk(join(WEB, 'app'))) {
    const rel = relative(WEB, p);
    const n = (code(rel).match(/<AppleWalletButton\b/g) ?? []).length;
    if (n) mounts[rel] = n;
  }
  console.log('[wallet-button mounts]', JSON.stringify(mounts));
  assert.deepEqual(mounts, { [GUEST_TICKET]: 1, [POPUP]: 1, [THANK_YOU]: 1 });

  // The pop-up and the thank-you: the button comes RIGHT AFTER their own "Save my ticket" (the Safari hand-off
  // branch is the other side of the same conditional, and the page hands no Wallet link beside it).
  const popup = code(POPUP);
  assert.match(popup, /<SavePassCardButton hrefs=\{\[src\]\} label=\{LANDING_WORDS\.saveTicket\} variant="primary" \/>\s*<AppleWalletButton link=\{appleWallet\}/, 'the pop-up’s Wallet button no longer sits under its Save my ticket');
  const page = code(THANK_YOU);
  assert.match(page, /label=\{justIn \? REQUEST_WORDS\.saveUpdated : LANDING_WORDS\.saveTicket\}\s*variant="primary"\s*\/>\s*\)\}\s*<AppleWalletButton link=\{appleWallet\}/, 'the thank-you’s Wallet button no longer sits under its Save my ticket');
  assert.match(page, /const appleWallet =\s*canvas \|\| safariSave \|\| passCard !== 'pass'\s*\?\s*null/, 'the thank-you hands a Wallet link beside the Safari hand-off, on the canvas, or without a real ticket');
  assert.match(page, /safariHref=\{safariSave\}\s*appleWallet=\{appleWallet\}/, 'the pop-up is not handed the same Wallet link as the page');
  // Me: the link exists only for a real ticket and goes only to GuestTicket.
  const me = code('app/[slug]/page.tsx');
  assert.equal((me.match(/\bmeAppleWallet\b/g) ?? []).length, 2, 'meAppleWallet is used somewhere besides GuestTicket');
  assert.match(me, /const meAppleWallet =\s*passCard === 'pass' && !isEditorCanvas\s*\?/, 'Me computes a Wallet link without a real ticket, or on the canvas');
  assert.match(me, /<GuestTicket[\s\S]{0,400}?appleWallet=\{meAppleWallet\}/, 'Me’s Wallet link no longer goes to GuestTicket');
});

test('1b · GuestTicket, RENDERED: the button only under a real ticket’s "Save my ticket" — never on the reply, the pending or the declined state', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  // The test runner compiles JSX to `React.createElement` (the app's own build uses the automatic runtime).
  (globalThis as { React?: typeof React }).React = React;
  const { GuestTicket } = await import('../app/[slug]/_components/guest-ticket');
  const link = appleWalletLink(UA.iphoneSafari, LINK, true);
  const html = (props: Record<string, unknown>) =>
    renderToStaticMarkup(React.createElement(GuestTicket as never, { name: 'Maria Santos', invitationUrl: LINK, appleWallet: link, ...props } as never));
  const wallet = /data-wallet="apple"/;

  const pass = html({ state: 'pass' });
  assert.match(pass, wallet, 'a real ticket on an iPhone shows no Wallet button');
  assert.ok(pass.indexOf(PASS_CARD_WORDS.saveOwn) >= 0, 'the real ticket lost "Save my ticket"');
  assert.ok(pass.indexOf(PASS_CARD_WORDS.saveOwn) < pass.search(wallet), 'the Wallet button is drawn before "Save my ticket", not beside it');
  assert.ok(pass.includes(`href="${APPLE_WALLET_ROUTE}"`), 'the button does not open the route');

  for (const [why, props] of [
    ['a reply still owed', { state: 'pass', replyHref: '#reply' }],
    ['the pending ticket', { state: 'awaiting' }],
    ['can’t come', { state: 'cannotCome' }],
    ['no ticket', { state: 'none' }],
    ['not offered (no signable pass / not an iPhone)', { state: 'pass', appleWallet: null }],
  ] as const) {
    assert.doesNotMatch(html(props as Record<string, unknown>), wallet, `the Wallet button shows for ${why}`);
  }
});

// ─── 4 · SIGNED OUT → ONE WAY BACK IN, NEVER A BARE LINE ────────────────────

test('4 · a guest whose sign-in ended gets the Save’s own words and ONE "Get back in" to the Event Hub path — never bare text', () => {
  // The button's target: the page they pressed from, PATH ONLY, this site only.
  const route = 'https://setnayan.com/api/guest/wallet/apple';
  assert.equal(walletBackPath('https://setnayan.com/cale-ice', route), '/cale-ice');
  assert.equal(walletBackPath('https://setnayan.com/cale-ice/invite/enter?in=1&k=secret', route), '/cale-ice/invite/enter');
  assert.equal(walletBackPath('https://evil.example/cale-ice', route), '/');
  assert.equal(walletBackPath(null, route), '/');
  assert.equal(walletBackPath('not a url', route), '/');

  const html = walletNoticeHtml({
    line: PASS_CARD_WORDS.walletSignedOut,
    why: PASS_CARD_WORDS.walletGetBackInWhy,
    button: PASS_CARD_WORDS.walletGetBackIn,
    href: '/cale-ice',
  });
  assert.match(html, /^<!doctype html>/, 'not a page');
  assert.ok(html.includes('Your sign-in on this phone ended.'), 'the line is not the Save’s own line');
  assert.ok(html.includes('Nothing you sent is lost. Open your invitation again with your QR or by signing in, then save your ticket.'), 'the ⓘ detail is not the Save’s own');
  assert.equal((html.match(/<a /g) ?? []).length, 1, 'more than one way out');
  assert.match(html, /<a href="\/cale-ice" data-wallet-notice-button="" [^>]*>Get back in<\/a>/, 'the one button is not "Get back in" to the Event Hub path');

  // The route: the no-session branch answers THAT page (401), with those three words — no bare body left anywhere.
  const src = code('app/api/guest/wallet/apple/route.ts');
  const branch = src.slice(src.indexOf('if (!session?.guest_id)'), src.indexOf('const admin = createAdminClient()'));
  assert.ok(branch.length > 20, 'the no-session branch moved');
  assert.match(branch, /return walletNotice\(request, 401, \{\s*line: PASS_CARD_WORDS\.walletSignedOut,\s*why: PASS_CARD_WORDS\.walletGetBackInWhy,\s*button: PASS_CARD_WORDS\.walletGetBackIn,\s*\}\);/, 'a signed-out guest no longer gets the "Get back in" page');
  assert.doesNotMatch(branch, /new NextResponse\(/, 'a signed-out guest gets a bare response');
  assert.match(src, /function walletNotice\([\s\S]{0,200}walletBackPath\(request\.headers\.get\('referer'\), request\.url\)[\s\S]{0,120}walletNoticeHtml\(/, 'the page’s button is not the Event Hub path');
  assert.match(src, /'Content-Type': 'text\/html; charset=utf-8'/, 'the small page is not served as a page');
});
