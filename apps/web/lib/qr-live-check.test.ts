import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import CjsModuleRaw from 'node:module';

import { ipIsPublic, liveCheckAllowed, readRegistryPage } from './qr-live-check';

// `server-only` throws outside a React server build; stub it, as the repo's other .server tests do.
const CjsModule = CjsModuleRaw as unknown as {
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
  _cache: Record<string, unknown>;
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const STUB = path.join(process.cwd(), '__server_only_stub_qr_live_check__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const orig = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return orig.call(this, request, ...rest);
  };
}
let live: typeof import('./qr-live-check.server');
before(async () => {
  live = await import('./qr-live-check.server');
});

/** SYNTHETIC — no real registry is contacted by this file. */
const PAPER = { name: 'Sample Blooms Event Styling', number: '5512034' };
const PAGE = '<html><body><h1>Business Name Registration</h1><p>Business Name: SAMPLE BLOOMS EVENT STYLING</p><p>BN No.: 5512034</p><p>Status: Registered</p><p>Valid until: 02 Feb 2030</p></body></html>';

test('the allowlist: https, allowlisted hosts only, whole-label match', () => {
  for (const ok of ['https://bnrs.dti.gov.ph/x', 'https://dti.gov.ph/x', 'https://www.sec.gov.ph/x', 'https://sec.gov.ph/x', 'https://orus.bir.gov.ph/x', 'https://BNRS.DTI.GOV.PH./x']) {
    assert.ok(liveCheckAllowed(ok), ok);
  }
  for (const bad of [
    'http://bnrs.dti.gov.ph/x', // not https
    'https://bnrs.dti.gov.ph.evil.com/x', // look-alike
    'https://evil-bnrs.dti.gov.ph/x', // not on the exact DTI list
    'https://other.dti.gov.ph/x', // DTI subdomains we have not seen are NOT allowed
    'https://xsec.gov.ph/x',
    'https://bir.gov.ph.attacker.net/x',
    'https://user:pw@bnrs.dti.gov.ph/x', // credentials
    'https://bnrs.dti.gov.ph:8443/x', // odd port
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://cityhall.pasig.gov.ph/x', // LGU portals: not yet
    'javascript:alert(1)',
    'not a url',
  ]) {
    assert.equal(liveCheckAllowed(bad), null, bad);
  }
});

test('private, loopback, link-local, metadata and v6 equivalents are not public', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', '64:ff9b::a00:1', 'garbage']) {
    assert.equal(ipIsPublic(ip), false, ip);
  }
  for (const ip of ['203.177.12.34', '8.8.8.8', '172.32.0.1', '2600:1f18::1', '::ffff:8.8.8.8']) {
    assert.equal(ipIsPublic(ip), true, ip);
  }
});

const publicResolve = async () => ['203.177.12.34'];

test('reached: the page names the same name and number', async () => {
  const r = await live.liveCheckRegistryPage('https://bnrs.dti.gov.ph/verify?bn=5512034', PAPER, {
    resolve: publicResolve,
    request: async () => ({ status: 200, location: null, contentType: 'text/html', body: PAGE }),
  });
  assert.equal(r.outcome, 'reached');
  assert.equal(r.numberOnPage, true);
  assert.equal(r.nameOnPage, true);
  assert.equal(r.status, 'Registered');
});

test('a host that resolves to a PRIVATE address is never opened', async () => {
  let requested = false;
  const r = await live.liveCheckRegistryPage('https://bnrs.dti.gov.ph/verify', PAPER, {
    resolve: async () => ['10.0.0.5'],
    request: async () => { requested = true; return { status: 200, location: null, contentType: 'text/html', body: PAGE }; },
  });
  assert.equal(r.outcome, 'blocked_address');
  assert.equal(requested, false);
  // one bad address in the answer is enough to refuse
  const r2 = await live.liveCheckRegistryPage('https://bnrs.dti.gov.ph/verify', PAPER, {
    resolve: async () => ['203.177.12.34', '169.254.169.254'],
    request: async () => { requested = true; return { status: 200, location: null, contentType: 'text/html', body: PAGE }; },
  });
  assert.equal(r2.outcome, 'blocked_address');
  assert.equal(requested, false);
});

test('a redirect OFF the allowlist is not followed; one ON it is, and re-checked', async () => {
  const hosts: string[] = [];
  const r = await live.liveCheckRegistryPage('https://bnrs.dti.gov.ph/verify', PAPER, {
    resolve: publicResolve,
    request: async ({ url }) => { hosts.push(url.hostname); return { status: 302, location: 'https://evil.example/steal', contentType: null, body: '' }; },
  });
  assert.equal(r.outcome, 'redirect_off_list');
  assert.deepEqual(hosts, ['bnrs.dti.gov.ph']);
  const r2 = await live.liveCheckRegistryPage('https://bnrs.dti.gov.ph/verify', PAPER, {
    resolve: publicResolve,
    request: async () => ({ status: 301, location: 'http://bnrs.dti.gov.ph/verify', contentType: null, body: '' }),
  });
  assert.equal(r2.outcome, 'redirect_off_list', 'a downgrade to http is off the list');
  const seen: string[] = [];
  const r3 = await live.liveCheckRegistryPage('https://dti.gov.ph/v', PAPER, {
    resolve: async (h) => { seen.push(h); return h === 'bnrs.dti.gov.ph' ? ['192.168.0.9'] : ['203.177.12.34']; },
    request: async ({ url }) => url.hostname === 'dti.gov.ph'
      ? { status: 302, location: 'https://bnrs.dti.gov.ph/v', contentType: null, body: '' }
      : { status: 200, location: null, contentType: 'text/html', body: PAGE },
  });
  assert.equal(r3.outcome, 'blocked_address', 'the redirect target is resolved and checked again');
  assert.deepEqual(seen, ['dti.gov.ph', 'bnrs.dti.gov.ph']);
});

test('an http URL or a look-alike is never resolved or requested', async () => {
  for (const u of ['http://bnrs.dti.gov.ph/v', 'https://bnrs.dti.gov.ph.evil.com/v']) {
    let touched = false;
    const r = await live.liveCheckRegistryPage(u, PAPER, {
      resolve: async () => { touched = true; return ['203.177.12.34']; },
      request: async () => { touched = true; return { status: 200, location: null, contentType: 'text/html', body: PAGE }; },
    });
    assert.equal(r.outcome, 'not_allowed');
    assert.equal(touched, false);
  }
});

test('a JavaScript-only page, a timeout and an error say "we do not know" — never a pass or a fail', async () => {
  const js = readRegistryPage('<html><body><div id="root"></div><script src="/app.js"></script></body></html>', PAPER);
  assert.equal(js.scriptOnly, true);
  assert.equal(js.numberOnPage, null);
  const t = await live.liveCheckRegistryPage('https://bnrs.dti.gov.ph/v', PAPER, {
    resolve: publicResolve,
    timeoutMs: 20,
    request: ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
  });
  assert.equal(t.outcome, 'timeout');
  const e = await live.liveCheckRegistryPage('https://bnrs.dti.gov.ph/v', PAPER, {
    resolve: publicResolve,
    request: async () => { throw new Error('ECONNRESET'); },
  });
  assert.equal(e.outcome, 'unreachable');
});

test('a page that shows a DIFFERENT number reads as not on the page', () => {
  const r = readRegistryPage(PAGE.replace('5512034', '9900001'), PAPER);
  assert.equal(r.numberOnPage, false);
});
