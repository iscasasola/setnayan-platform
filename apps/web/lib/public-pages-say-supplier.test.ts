/**
 * PUBLIC PAGES SAY "SUPPLIER", NEVER "VENDOR" (owner, 2026-09-27: *"we will
 * also stop calling them vendors · we will start calling them suppliers across
 * the whole website"*).
 *
 * WHAT THIS READS: the public surfaces — the pages Google and answer engines
 * read, which is why they went first (phase 1 of the sweep): the front door,
 * the (shell) doorways, /features, /vendors, the shop page, help, blog and
 * /llms.txt. Comments are stripped by the one canonical lexer.
 *
 * WHAT COUNTS AS A WORD A READER SEES: a string literal or JSX text that holds a
 * space (a phrase, not a key) and is not an identifier or a path. So
 * `vendor_profiles`, `/vendor-dashboard`, `?as=vendor`, `VendorCard` and a bare
 * `'vendor'` key are NOT counted — code names are frozen on purpose, the same
 * split as "Event Hub, never website" (2026-09-24).
 *
 * ⚠ THE THREE LEGAL PAGES ARE NOT SCANNED, deliberately and visibly. In
 * /privacy, /terms and /acceptable-use "vendor" can be a defined term (the
 * Vendor Agreement), and renaming a defined term in a legal document is a legal
 * change, not a copy change — it waits for the owner. Delete them from
 * LEGAL_PENDING the day they are rewritten, and this guard will hold them too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PUBLIC = [
  'app/(shell)',
  'app/page.tsx',
  'app/layout.tsx',
  'app/features',
  'app/for-suppliers',
  'app/v',
  'app/blog',
  'app/help',
  'app/_components/marketing',
  'app/_components/frontdoor',
  'app/tl',
  'app/our-story',
  'app/creators',
  'app/open-shop',
  'app/realstories',
  'lib/help.ts',
  'lib/blog.ts',
  'lib/llms-txt.ts',
  'lib/studio-apps.ts',
  'lib/marketing-i18n.tsx',
];

const LEGAL_PENDING = new Set([
  'app/(shell)/privacy/page.tsx',
  'app/(shell)/terms/page.tsx',
  'app/(shell)/acceptable-use/page.tsx',
]);

const WORD = /\b[Vv]endors?\b/g;
const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|>[^<>{}\n]+</g;
/** Identifier / path / query shapes — the word joined to code, not read by a person. */
const CODE_SHAPE = /[/_.@#=-]vendor|vendor[_/.&=-]|vendor[A-Z]|[a-z]Vendor/;
/** A proper name that keeps its word. */
const PROPER_NAME = /Vendor Agreement/i;

function walk(p: string, out: string[]): void {
  if (!existsSync(p)) return;
  if (statSync(p).isFile()) {
    if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
    return;
  }
  for (const name of readdirSync(p)) walk(path.join(p, name), out);
}

export function vendorWordsReadByPeople(source: string): string[] {
  const hits: string[] = [];
  for (const m of stripComments(source).matchAll(LITERAL)) {
    const t = m[0];
    if (!/\s/.test(t.slice(1, -1)) || CODE_SHAPE.test(t) || PROPER_NAME.test(t)) continue;
    if (WORD.test(t)) hits.push(t.trim().slice(0, 120));
    WORD.lastIndex = 0;
  }
  return hits;
}

test('the guard sees the word a person reads, and not the code around it', () => {
  // SABOTAGE: loosen CODE_SHAPE or the space rule → one of these flips.
  assert.equal(vendorWordsReadByPeople(`const t = 'Browse verified vendors';`).length, 1);
  assert.equal(vendorWordsReadByPeople(`<p>Find your vendor here</p>`).length, 1);
  assert.equal(vendorWordsReadByPeople(`const href = \`/signup?as=vendor&next=\${x}\`;`).length, 0);
  assert.equal(vendorWordsReadByPeople(`from('vendor_profiles')`).length, 0);
  assert.equal(vendorWordsReadByPeople(`<VendorCard />`).length, 0);
  assert.equal(vendorWordsReadByPeople(`const k = 'vendor';`).length, 0);
  assert.equal(vendorWordsReadByPeople(`// browse verified vendors\nconst a = 1;`).length, 0);
  assert.equal(vendorWordsReadByPeople(`'Read the Vendor Agreement before you sign'`).length, 0);
});

test('no public page calls a supplier a "vendor"', () => {
  const files: string[] = [];
  for (const rel of PUBLIC) walk(path.join(WEB, rel), files);
  assert.ok(files.length > 60, `only ${files.length} files scanned — the walk went blind`);
  const offenders: string[] = [];
  for (const f of files) {
    const rel = path.relative(WEB, f);
    if (LEGAL_PENDING.has(rel)) continue;
    for (const hit of vendorWordsReadByPeople(readFileSync(f, 'utf8'))) offenders.push(`${rel}: ${hit}`);
  }
  assert.deepEqual(offenders, [], `a public page says "vendor" — the owner's word is "supplier":\n  ${offenders.join('\n  ')}`);
});

test('the legal carve-out still points at real files', () => {
  for (const rel of LEGAL_PENDING) assert.ok(existsSync(path.join(WEB, rel)), `${rel} is gone — drop it from LEGAL_PENDING`);
});
