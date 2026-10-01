/**
 * THE ADMIN CONSOLE SAYS "SUPPLIER", NEVER "VENDOR" (owner, 2026-09-27 for the
 * public site; 2026-10-01 extended to admin by the P5b "Plain English" pass).
 *
 * Same split as `lib/public-pages-say-supplier.test.ts`, and the detector below
 * is that file's, line for line (importing it would re-run its tests) — one
 * definition of "a word a person reads":
 * a string literal or JSX text that holds a space (a phrase, not a key) and is
 * not an identifier or a path. `vendor_profiles`, `/admin/vendors`,
 * `?tab=demo-vendors`, `VendorCard` and a bare `'vendor'` key are NOT counted —
 * code names, routes and DB keys are frozen. "Vendor Agreement" is a defined
 * term in a legal document and stays.
 *
 * 🔑 Two more shapes are real words but are not read by the operator, and are
 * allowed by NAME below: log prefixes in brackets (`[vendor-partnerships audit]`)
 * and the `AdminXPage (…)` labels handed to `logQueryError`. Add to
 * NOT_READ_BY_PEOPLE only with a reason.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from '../../lib/strip-comments';

const WEB = path.resolve(process.cwd());

const SCANNED = ['app/admin'];

/** A hit whose text starts with one of these is a log line / query label, not screen copy. */
const NOT_READ_BY_PEOPLE = [
  /^[`'"]\[[a-z/-]+[^\]]*\]/, // [vendor-partnerships audit] — console.error prefix
  /^[`'"]Admin\w+Page\b/, // AdminVendorsPage (…) — a logQueryError label
  /^[`'"]platform_expenses\b/, // a log label
  /^[`'"][a-z_, :!()]+vendor_profiles/, // a PostgREST select list
];

/** Search keywords the palette matches on and nobody reads — kept so that typing
 *  the OLD word ("vendor") still finds the page. Lowercase words only, and only
 *  in the one file that holds them. */
const SEARCH_KEYWORD_FILE = 'app/admin/_components/admin-nav-descriptions.ts';
const SEARCH_KEYWORDS = /^'[a-z ]+(?:'$|$)/; // hits are cut at 120 chars

const WORD = /\b[Vv]endors?\b/g;
const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|>[^<>{}\n]+</g;
const CODE_SHAPE = /[/_.@#=-]vendor|vendor[_/.&=-]|vendor[A-Z]|[a-z]Vendor/;
const PROPER_NAME = /Vendor Agreement/i;

/** `${ … }` is code, not words — blank each expression body (balanced braces) so a
 *  `vendor` variable inside a template is not mistaken for screen copy. */
function blankTemplateExpressions(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      out += '${}';
      i = j - 1;
    } else out += src[i];
  }
  return out;
}

/** A capitalised one-word label — `'Vendors'`, `>Vendor<` — is a heading or a tab,
 *  read by a person even though it holds no space. Lowercase `'vendor'` is a key. */
const ONE_WORD_LABEL = /(['"`])Vendors?\1|>\s*Vendors?\s*</g;

function vendorWordsReadByPeople(source: string): string[] {
  const hits: string[] = [];
  for (const m of blankTemplateExpressions(stripComments(source)).matchAll(ONE_WORD_LABEL)) hits.push(m[0]);
  for (const m of blankTemplateExpressions(stripComments(source)).matchAll(LITERAL)) {
    const t = m[0];
    if (!/\s/.test(t.slice(1, -1)) || CODE_SHAPE.test(t) || PROPER_NAME.test(t)) continue;
    if (WORD.test(t)) hits.push(t.trim().slice(0, 120));
    WORD.lastIndex = 0;
  }
  return hits;
}

function walk(p: string, out: string[]): void {
  if (!existsSync(p)) return;
  if (statSync(p).isFile()) {
    if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !/generated/.test(p)) out.push(p);
    return;
  }
  for (const name of readdirSync(p)) walk(path.join(p, name), out);
}

export function adminVendorWords(source: string): string[] {
  return vendorWordsReadByPeople(source).filter(
    (hit) => !NOT_READ_BY_PEOPLE.some((re) => re.test(hit)),
  );
}

test('the admin guard sees a visible "vendor" and lets the code names through', () => {
  // SABOTAGE: drop the filter or the reuse → one of these flips.
  assert.equal(adminVendorWords(`label: 'Vendor recommendations'`).length, 1);
  assert.equal(adminVendorWords(`<p>No vendors match</p>`).length, 1);
  assert.equal(adminVendorWords(`<p>Pick a vendor</p>`).length, 1);
  assert.equal(adminVendorWords(`label: 'Vendors'`).length, 1);
  assert.equal(adminVendorWords(`<th>Vendor</th>`).length, 1);
  assert.equal(adminVendorWords(`kind: 'vendor'`).length, 0);
  assert.equal(adminVendorWords(`href="/admin/vendors"`).length, 0);
  assert.equal(adminVendorWords(`.from('vendor_profiles')`).length, 0);
  assert.equal(adminVendorWords(`console.error('[vendor-partnerships audit] failed')`).length, 0);
  assert.equal(adminVendorWords(`logQueryError('AdminVendorsPage (couple vendor requests)', e)`).length, 0);
  assert.equal(adminVendorWords('const c = `${(vendor as { n: string }).n} ok`;').length, 0);
  assert.equal(adminVendorWords(`'Changing prices needs a second admin (Vendor Agreement § 9.1)'`).length, 0);
});

test('no admin screen calls a supplier a "vendor"', () => {
  const files: string[] = [];
  for (const rel of SCANNED) walk(path.join(WEB, rel), files);
  assert.ok(files.length > 200, `only ${files.length} admin files scanned — the walk went blind`);
  const offenders: string[] = [];
  for (const f of files) {
    const rel = path.relative(WEB, f);
    for (const hit of adminVendorWords(readFileSync(f, 'utf8'))) {
      if (rel === SEARCH_KEYWORD_FILE && SEARCH_KEYWORDS.test(hit)) continue;
      offenders.push(`${rel}: ${hit}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `an admin screen says "vendor" — the owner's word is "supplier":\n  ${offenders.join('\n  ')}`,
  );
});
