/**
 * ⚖ Owner tracker d16 + d15 (2026-10-02): **"Suppliers" everywhere** ("Your
 * Team" and "vendor(s)" retire as words a host or a supplier reads) and
 * **"Event Details" everywhere** ("Your info" retires as a name).
 *
 * 🔑 THE PROPERTY: outside the reasoned allowlist (`SUPPLIER_WORD_ALLOWED`,
 * each entry with its why), no word a person reads says "vendor". Identifiers,
 * routes, columns, SKU codes and log lines are not words on a screen and stay —
 * the scan judges each occurrence by its AST position (`scanVendorWord`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPLIER_WORD_ALLOWED, scanVendorWord, supplierFor, supplierWordAllowed } from './supplier-word';
import { scanRetiredNames } from './retired-names-scan';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function* sources(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '.tmp') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith('.d.ts') && !e.endsWith('.generated.ts')) yield p;
  }
}
const ALL = ['app', 'lib', 'components'].flatMap((r) => [...sources(join(WEB, r))]);
const SELF = new Set(['lib/supplier-word.ts', 'lib/retired-names-scan.ts']);

test('the scanner reads what a person reads, and leaves code alone', () => {
  const shown = [
    ['a.tsx', `export const A = () => <p>No vendors booked yet</p>;`],
    ['b.ts', `export const t = 'Manage vendors';`],
    ['c.ts', `export const t = { label: 'Vendor' };`],
    ['d.ts', "export const t = (n: string) => `Confirmed by vendor ${n}`;"],
    ['e.tsx', `export const E = () => <a aria-label="Chat with this vendor" />;`],
  ] as const;
  for (const [f, s] of shown) assert.ok(scanVendorWord(f, s).length >= 1, `missed a visible word in: ${s}`);
  const code = [
    `export const s = 'event_id, vendor_id, vendor_name';`,
    `export const e = 'id, vendor:vendor_profiles ( business_name, slug )';`,
    `export const l = 'event_id, vendor, status';`,
    `export const r = '/dashboard/x/vendors';`,
    `export const k = 'vendor';`,
    `export const c = 'vendor-card shadow';`,
    `export const v = { vendor: 1 };`,
    `export const a = 'Per the Vendor Agreement § 9.1, two admins decide.';`,
    `import x from './vendor-packages';`,
    `export const g = () => console.warn('vendor read failed');`,
    `// a vendor in a comment`,
    `export const t = 'Heads up — your {vendor} payment is due';`,
  ];
  for (const s of code) assert.deepEqual(scanVendorWord('x.tsx', s), [], `flagged code as copy: ${s}`);
  assert.equal(supplierFor('vendor'), 'supplier');
  assert.equal(supplierFor('Vendors'), 'Suppliers');
  assert.equal(supplierFor('VENDOR'), 'SUPPLIER');
});

test('no screen a host or a supplier reads says "vendor"', () => {
  const findings: string[] = [];
  let scanned = 0;
  let allowedHits = 0;
  for (const file of ALL) {
    const rel = relative(WEB, file);
    if (SELF.has(rel)) continue;
    scanned += 1;
    const hits = scanVendorWord(file, readFileSync(file, 'utf8'));
    if (!hits.length) continue;
    if (supplierWordAllowed(rel)) {
      allowedHits += hits.length;
      continue;
    }
    for (const h of hits) findings.push(`${rel}:${h.line}  "${h.word}" → "${supplierFor(h.word)}"  ·  ${h.text}`);
  }
  console.log(`[supplier-word] ${scanned} files · ${findings.length} findings · ${allowedHits} allowlisted hits`);
  assert.ok(scanned > 1000, `walked only ${scanned} files — the walk is broken`);
  assert.ok(allowedHits > 0, 'the allowlist matched nothing — the scan is not reading the tree');
  assert.deepEqual(
    findings,
    [],
    'Say "supplier", never "vendor", where a person reads it (owner d16). Change the WORD, never ' +
      'the identifier — or, if nobody but staff/legal/SEO reads it, add the file to ' +
      'SUPPLIER_WORD_ALLOWED with its reason:\n  ' + findings.join('\n  '),
  );
});

test('every allowlist entry is real and says why', () => {
  for (const a of SUPPLIER_WORD_ALLOWED) {
    assert.ok(a.why.trim().length > 10, `${a.prefix} has no reason`);
    assert.ok(existsSync(join(WEB, a.prefix.replace(/\/$/, ''))) || ALL.some((f) => relative(WEB, f).startsWith(a.prefix)), `${a.prefix} no longer exists — drop it`);
  }
});

test('"Your Team" is retired where a host reads it — "Suppliers"', () => {
  const name = [{ was: 'Your Team', now: 'Suppliers', pattern: 'your team' }];
  const findings: string[] = [];
  for (const file of ALL) {
    const rel = relative(WEB, file);
    // A supplier's "your team" is their own staff — a different, correct meaning.
    const host =
      rel.startsWith('app/dashboard/') ||
      rel.startsWith('app/onboarding/') ||
      ['lib/tours.ts', 'lib/our-services.ts', 'lib/customer-menu.ts', 'lib/home-first-screen.ts'].includes(rel);
    if (!host) continue;
    for (const f of scanRetiredNames(file, readFileSync(file, 'utf8'), name)) findings.push(`${rel}:${f.line}  ${f.text}`);
  }
  assert.deepEqual(findings, [], '"Your Team" is back on a host screen — say "Suppliers":\n  ' + findings.join('\n  '));
});

test('"Your info" is retired as a name — "Event Details"', () => {
  // ⏳ maker-bar.ts is #6291's (the Maker in 4), which renames it there.
  const IN_FLIGHT = new Set(['app/dashboard/[eventId]/launch/_components/maker-bar.ts']);
  const name = [{ was: 'Your info', now: 'Event Details', pattern: 'your info' }];
  const findings: string[] = [];
  for (const file of ALL) {
    const rel = relative(WEB, file);
    if (IN_FLIGHT.has(rel)) continue;
    for (const f of scanRetiredNames(file, readFileSync(file, 'utf8'), name)) findings.push(`${rel}:${f.line}  ${f.text}`);
  }
  assert.deepEqual(findings, [], '"Your info" is back on a screen — say "Event Details":\n  ' + findings.join('\n  '));
});
