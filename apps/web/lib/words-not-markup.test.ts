/**
 * GUARD — an HTML entity in a plain JS string reaches the user as raw markup.
 *
 * 🚨 THIS SHIPPED, TWICE. The first line of every invitation read
 * `You&rsquo;re invited`, and a couple choosing their ceremony was offered
 * `Jehovah&apos;s Witnesses`. Both were correct-looking code producing wrong
 * words, which is why no test caught either.
 *
 * ── THE RULE IS ABOUT POSITION, NOT ABOUT THE FILE ──────────────────────────
 * One file holds both safe and broken entities, so "is this an HTML file?" is
 * the wrong question. What decides it is whether the string passes through the
 * JSX transform. Measured by rendering, not assumed:
 *
 *   <p>a &amp; b</p>                → "a & b"          ✅ JSX child, decoded
 *   <Shell label="a &middot; b"/>   → "a · b"          ✅ JSX attribute, decoded
 *   <Shell label={'a &middot; b'}/> → "a &middot; b"   🔴 plain string, ESCAPED
 *   {cond ? <>x</> : 'a &amp; b'}   → "a &amp; b"      🔴 same — an expression
 *
 * ⚠ ITS SUBJECT LIST IS DERIVED, NOT ENUMERATED — it walks every .ts/.tsx under
 * app/ lib/ components/. A hand-written list of files to check is a list of the
 * files somebody thought of, and the next screen is never on it.
 *
 * ── 🪤 THE FIRST VERSION OF THIS GUARD WAS DECORATION, AND FAILED IN THE ONE
 * WAY THAT MATTERS MOST: it exempted any file containing
 * `dangerouslySetInnerHTML` anywhere. Both files carrying real bugs contain one
 * — so it exempted exactly the code it was written to police. Reintroducing the
 * Jehovah's Witnesses defect left it GREEN. **A per-FILE signal cannot answer a
 * per-STRING question.**
 *
 * It now asks per PROPERTY: which property names does this file actually feed
 * to `__html`? In four-question-flow that was `hint` and never `label`, which
 * is precisely the distinction the old rule flattened.
 *
 * ── THE LEGITIMATE USES, EACH RECOGNISED BY SHAPE ───────────────────────────
 * so a new instance is exempt automatically and nobody edits this file:
 *   1. JSX attribute value — the transform decodes it;
 *   2. the string IS an entity (`'&amp;'`) — an escape map's value;
 *   3. the string CONTAINS a tag — it is markup being assembled;
 *   4. the property is fed to `__html` in this file — it is HTML by contract;
 *   5. the module escapes HTML (`esc(` / `escapeHtml(`) — it emits markup.
 *      `weave-story.ts` is the live example: every interpolation goes through
 *      `esc()` and the result is injected as HTML;
 *   6. a property a library documents as HTML (Leaflet's `attribution`).
 *
 * ⛔ NEVER "FIX" AN ESCAPE MAP. `{'&':'&amp;','<':'&lt;',…}` is XSS protection
 * on markup built from guest-supplied names. Turning those into literal
 * characters opens an injection hole; it is not a copy change.
 *
 * ⚖ AND PREFER FIXING THE DATA TO WORKING AROUND IT AT THE RENDER SITE. This
 * repo had both workarounds in one file — a `.replace(/&apos;/g, "'")` and a
 * `dangerouslySetInnerHTML` added so an apostrophe would show. The second buys
 * a permanent injection surface for a punctuation mark. Both are now deleted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'lib', 'components'];

const ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]{1,9}|#\d{1,6});/;
const IS_ONLY_AN_ENTITY = /^&(?:[a-zA-Z][a-zA-Z0-9]{1,9}|#\d{1,6});$/;
const CONTAINS_A_TAG = /<\/?[a-zA-Z][a-zA-Z0-9]*[\s/>]/;

/** A module whose JOB is emitting HTML — entities are its output format. */
const ESCAPES_HTML = /\besc\(|\bescapeHtml\b|\bescapeXml\b/;

/**
 * Object properties a third-party library documents as HTML. Keyed by property
 * NAME, so a second map elsewhere is exempt automatically.
 * `attribution` — Leaflet injects it into the attribution control as HTML.
 */
const HTML_BY_LIBRARY_CONTRACT = new Set(['attribution', 'html']);

/**
 * Files whose HTML contract is declared in a DIFFERENT file, so the per-property
 * rule below cannot see it — and which are covered by a sharper guard instead.
 *
 * ⚠ THE OBVIOUS ALTERNATIVE IS WRONG. Collecting `__html`-fed property names
 * across the whole repo would exempt `body` here — and would also exempt
 * `label`, because one marketing mock feeds a `label` to `__html`. `label` is
 * exactly where the Jehovah's Witnesses defect lived. A global property set is
 * too coarse to be safe, so the narrow exemption goes here instead.
 *
 * Keep this list at one entry if you possibly can, and never add a file just to
 * make this test pass — the whole point is that it fails.
 */
const COVERED_ELSEWHERE: Record<string, string> = {
  // Slide BODIES are rendered by guided-tour.tsx through dangerouslySetInnerHTML
  // (two admin slides carry real <code> tags). Slide TITLES are plain text and
  // are policed by lib/tour-titles-are-text.test.ts, which is stricter than this
  // guard: it rejects named AND numeric entities and tags, and asserts the
  // renderer still splits the two fields that way.
  'lib/tours.ts': 'titles guarded by lib/tour-titles-are-text.test.ts; bodies are HTML by contract',
};

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next') continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(full);
  }
  return out;
}

/**
 * Which property names does this file hand to `__html`? `{ __html: opt.hint }`
 * marks `hint` as HTML; `label` stays text even in the same object.
 *
 * When `__html` is fed a bare identifier (a local we cannot follow without real
 * dataflow), we give up on that FILE and exempt it — a false negative is a
 * missed apostrophe, a false positive is a guard nobody trusts.
 */
function htmlContract(sf: ts.SourceFile): { props: Set<string>; opaque: boolean } {
  const props = new Set<string>();
  let opaque = false;
  const visit = (n: ts.Node): void => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === '__html') {
      let e: ts.Expression = n.initializer;
      while (ts.isCallExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) {
        e = ts.isCallExpression(e) ? (e.arguments[0] ?? e.expression) : e.expression;
      }
      if (ts.isPropertyAccessExpression(e)) props.add(e.name.text);
      else if (ts.isElementAccessExpression(e) || ts.isIdentifier(e)) opaque = true;
      else opaque = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { props, opaque };
}

type Hit = { file: string; line: number; text: string };

function scan(): { bugs: Hit[]; scanned: number; classified: number } {
  const bugs: Hit[] = [];
  let scanned = 0;
  let classified = 0;

  for (const root of ROOTS) {
    for (const file of walk(join(WEB, root))) {
      const src = readFileSync(file, 'utf8');
      scanned += 1;
      if (!ENTITY.test(src)) continue;
      if (COVERED_ELSEWHERE[relative(WEB, file)]) continue;

      const sf = ts.createSourceFile(
        file,
        src,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const { props: htmlProps, opaque } = htmlContract(sf);
      const emitsHtml = ESCAPES_HTML.test(src);

      const visit = (node: ts.Node): void => {
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          ENTITY.test(node.text)
        ) {
          classified += 1;
          const p = node.parent;
          const propName =
            ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
              ? p.name.text
              : null;

          const safe =
            ts.isJsxAttribute(p) ||
            IS_ONLY_AN_ENTITY.test(node.text.trim()) ||
            CONTAINS_A_TAG.test(node.text) ||
            (propName !== null && htmlProps.has(propName)) ||
            (propName !== null && HTML_BY_LIBRARY_CONTRACT.has(propName)) ||
            opaque ||
            emitsHtml;

          if (!safe) {
            bugs.push({
              file: relative(WEB, file),
              line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
              text: node.text.slice(0, 70),
            });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }
  return { bugs, scanned, classified };
}

test('no HTML entity sits in a string the user reads as text', () => {
  const { bugs, scanned, classified } = scan();

  // Both counts are asserted so this can never quietly become a test of
  // nothing. A broken walk, a renamed directory, or a regex that stops matching
  // would otherwise sweep zero files and report a clean pass.
  assert.ok(scanned > 500, `expected to scan 500+ source files, saw ${scanned}`);
  assert.ok(
    classified > 20,
    `expected 20+ entity-bearing string literals to classify, saw ${classified} — has the detection drifted?`,
  );

  assert.deepEqual(
    bugs.map((b) => `${b.file}:${b.line}  ${b.text}`),
    [],
    'these render the raw entity to a person; type the real character instead (’ “ ” — · &)',
  );
});
