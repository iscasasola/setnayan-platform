/**
 * title-template.test.ts — the brand is appended ONCE.
 *
 * `app/layout.tsx` sets `title: { template: '%s · Setnayan' }`, so Next appends
 * the brand to the title of every CHILD route segment. 94 page titles also
 * contained the brand themselves, so tabs, Google results and share cards read
 *
 *     Pricing · Setnayan · Setnayan
 *
 * MEASURED LIVE before the fix, not inferred from the config — `/pricing`,
 * `/terms` and `/explore` all rendered the doubled form on www.setnayan.com.
 *
 * 🔑 THE ROOT PAGE IS EXEMPT, AND ONLY MEASUREMENT SHOWS IT. `app/page.tsx`
 * shares the root SEGMENT with the layout that declares the template, so Next
 * does not apply the template to it: `/` rendered
 * "Setnayan · Plan your Filipino wedding free — …" with NO suffix while its
 * siblings doubled. Reasoning from the Next docs alone gets this backwards, and
 * a guard written from that reasoning would have demanded a "fix" that broke
 * the homepage title.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');

/** The root segment: its own metadata is not passed through the template. */
const ROOT_SEGMENT = new Set(['page.tsx', 'layout.tsx']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === 'page.tsx' || entry === 'layout.tsx') out.push(full);
  }
  return out;
}

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * The top-level `title:` of a metadata object — deliberately NOT any title
 * nested under openGraph/twitter. Those carry their own titles which the
 * template never touches, and several legitimately name the brand.
 */
function pageTitle(src: string): string | null {
  const m = /(?:export const metadata[^=]*=|return)\s*\{/.exec(src);
  if (!m) return null;
  const seg = src.slice(m.index + m[0].length, m.index + m[0].length + 2500);
  const cuts = ['openGraph', 'twitter', 'alternates']
    .map((k) => seg.indexOf(k))
    .filter((i) => i !== -1);
  const head = seg.slice(0, cuts.length ? Math.min(...cuts) : seg.length);
  const t = /\btitle:\s*(['"])(.*?)\1/.exec(head);
  return t ? (t[2] ?? null) : null;
}

/**
 * ⚠ THE FIRST CUT OF THIS RULE FORBADE THE BRAND ANYWHERE IN A TITLE, and it
 * flagged 57 titles that are completely correct: "Download Setnayan for Mac",
 * "How Setnayan works", "Claim your Setnayan profile", "Setnayan AI · Settings".
 * The brand as a WORD in a sentence is not the defect — obeying that rule would
 * have produced "How works". A guard that cries wolf on 57 correct files is one
 * somebody deletes in week two, so it matches only the two real shapes:
 *
 *   1. a redundant BRAND SUFFIX — "Pricing · Setnayan" → "Pricing · Setnayan · Setnayan"
 *   2. a title that is ONLY the brand — "Setnayan" → "Setnayan · Setnayan"
 *
 * Shape 2 has a legitimate use (the neutral title on a hidden profile, which
 * must not confirm the slug belongs to anyone) — those declare `absolute`, which
 * bypasses the template, and this rule only reads plain-string titles.
 */
const BRAND_SUFFIX = /[·—–-]\s*Setnayan\s*$/;

test('no page title re-appends the brand — the template already adds it', () => {
  const offenders: string[] = [];
  for (const file of walk(APP)) {
    const rel = file.slice(APP.length + 1);
    if (ROOT_SEGMENT.has(rel)) continue; // measured exempt, see the header
    const title = pageTitle(strip(readFileSync(file, 'utf8')));
    if (!title) continue;
    if (BRAND_SUFFIX.test(title) || title.trim() === 'Setnayan') {
      offenders.push(`${rel} → "${title}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'The root layout appends " · Setnayan" to every child title, so a title ending ' +
      'in the brand renders it twice. Drop the suffix — or, if the title must be ' +
      'exactly "Setnayan" for privacy reasons, use `title: { absolute: … }`. ' +
      `Found: ${offenders.join(' | ')}`,
  );
});

test('the template that makes this rule true is still there', () => {
  // POSITIVE CONTROL. The rule above passes vacuously if the template is ever
  // removed — at which point dropping the brand from 94 titles would be exactly
  // wrong, and every tab would lose it instead of showing it twice.
  const layout = strip(readFileSync(join(APP, 'layout.tsx'), 'utf8'));
  assert.match(
    layout,
    /template:\s*(['"`])%s · Setnayan\1/,
    'The rule above only makes sense while the root layout appends the brand. If ' +
      'this template is deliberately removed, DELETE the rule above in the same ' +
      'commit — do not leave it enforcing a premise that no longer holds.',
  );
});
