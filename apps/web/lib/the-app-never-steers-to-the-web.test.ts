/**
 * 🧭 THE APP NEVER STEERS TO THE WEB — a PROPERTY of the tree (controller 2026-10-23, the Apple build-6 blocker;
 * owner 2026-10-08, DECISION_LOG "APPLY + PRO: THE OWNER'S RULE" — in the app: "NO price and NO 'buy on the website'
 * wording (anti-steering, 3.1.1)", and "HELD PRO CHANGES: KEEP, MARKED" — "◆ N waiting for Pro" + "Remove Pro changes").
 *
 * Every string a person can read — JSX text, a string literal, a template — in every `.ts` / `.tsx` under `app/` and
 * `lib/` is read. One that points out of the app to the web ("can be applied on the web", "only on the web", "on our
 * website", "buy at setnayan.com") fails, unless the app can never show it:
 *
 *   · the file lives under a route the app refuses (`isStoreShellWebOnlyPath`, gate OFF — what build 5 and a 1.1 with
 *     the switch off see), or under admin / api / dev, or is a brochure route middleware bounces;
 *   · the string sits inside a `data-web-only` element (hidden before first paint in the store shell);
 *   · its file is listed in `NEVER_IN_THE_APP` below WITH the reason and the gate that keeps it out — asserted to be
 *     still there, so a reason cannot rot.
 *
 * 🔑 UNLIKE the sells-scan in store-shell.test.ts, "the function asks storeShell" is NOT an excuse here: the words
 * that broke this rule (`hub-draft-bar.tsx`, `apply-pro-sheet.tsx`) sat exactly in the store-shell branch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isStoreShellWebOnlyPath } from './store-shell';

const WEB = join(__dirname, '..');
const src = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Words that send a reader out of the app to buy or finish something. */
export const STEERS =
  /\b(?:on|from|via) the web(?:site)?\b|\bon (?:our|the Setnayan) website\b|\bonly on the web\b|\b(?:buy|pay|unlock|purchase|apply|price|rate)\b[^.]{0,40}\b(?:at|on) setnayan\.com\b|setnayan\.com\/pricing/i;

type Why = { why: string; gate: { file: string; re: RegExp } };
const NEVER_IN_THE_APP = new Map<string, Why>([
  [
    'lib/iap/where-bought.ts',
    {
      why: '"On · bought on the web" is a STATUS (where an owned Live Watch was bought, owner 2026-10-21), drawn on Home only inside the Apple branch — where the same item IS sold in the app; it asks nobody to go anywhere',
      gate: { file: 'app/dashboard/[eventId]/page.tsx', re: /getIapGate\(\)\.then\(async \(\{ iap \}\) => \{\s*if \(!iap\) return null;/ },
    },
  ],
  [
    'lib/vendor-deep-search.ts',
    { why: 'Deep Search reads a supplier’s own website; its route is refused in the app (/vendor-dashboard/deep-search)', gate: { file: 'lib/store-shell.ts', re: /vendor-dashboard\\\/deep-search/ } },
  ],
  [
    'app/vendor-dashboard/deep-search/_components/dossier-view.tsx',
    { why: '"Prices we found on the web" — a Deep Search result, under its refused route', gate: { file: 'lib/store-shell.ts', re: /vendor-dashboard\\\/deep-search/ } },
  ],
  [
    'app/(shell)/alaala/page.tsx',
    { why: 'the public /alaala brochure — a doorway the app refuses', gate: { file: 'lib/store-shell.ts', re: /'\/alaala',/ } },
  ],
  [
    'app/(shell)/panood/page.tsx',
    { why: 'the public /panood brochure — a doorway the app refuses', gate: { file: 'lib/store-shell.ts', re: /'\/panood',/ } },
  ],
  [
    'lib/help.ts',
    {
      why: 'each article’s web answer (`body`) is shown in the app ONLY when it has no `appBody` (`helpBodyFor`) — and the test below reads every answer the app shows through that same function',
      gate: { file: 'lib/help.ts', re: /return storeShell && article\.appBody !== undefined \? article\.appBody : article\.body;/ },
    },
  ],
  [
    'app/llms.txt/route.ts',
    { why: '/llms.txt is a plain-text file for crawlers (a GET route, no page) — nothing in the app links to or draws it', gate: { file: 'app/llms.txt/route.ts', re: /export async function GET\(\): Promise<Response>/ } },
  ],
  [
    'app/download/page.tsx',
    { why: '/download is the brochure middleware bounces out of the app (APP_EXCLUDED_MARKETING_PATHS)', gate: { file: 'middleware.ts', re: /APP_EXCLUDED_MARKETING_PATHS = new Set\(\[[^\]]*'\/download'/ } },
  ],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** The route a file under app/ serves (groups dropped, `[x]` → x); null for a shared `_folder` file or lib/. */
function routeOf(rel: string): string | null {
  if (!rel.startsWith('app/')) return null;
  const segs: string[] = [];
  for (const s of rel.slice(4).split('/').slice(0, -1)) {
    if (s.startsWith('_')) return null;
    if (s.startsWith('(') && s.endsWith(')')) continue;
    segs.push(s.startsWith('[') ? 'x' : s);
  }
  return '/' + segs.join('/');
}

test('no string the app can show steers to the web (every app/ and lib/ file read)', () => {
  const ts = require('typescript') as typeof import('typescript');
  const mw = src('middleware.ts').match(/APP_EXCLUDED_MARKETING_PATHS = new Set\(\[([^\]]*)\]/);
  assert.ok(mw, 'APP_EXCLUDED_MARKETING_PATHS moved out of middleware.ts');
  const bounced = new Set([...mw![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!));

  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  assert.ok(files.length > 2000, `read only ${files.length} files — the walker is blind`);
  const offenders: string[] = [];
  let strings = 0;
  let listedHits = 0;
  for (const abs of files) {
    const rel = abs.slice(WEB.length + 1);
    if (/^app\/(admin|api|dev)\//.test(rel)) continue;
    const route = routeOf(rel);
    if (route && (isStoreShellWebOnlyPath(route) || bounced.has(route))) continue;
    const text = readFileSync(abs, 'utf8');
    if (!/web|setnayan\.com/i.test(text)) continue;
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const hiddenInApp = (n: import('typescript').Node) => {
      for (let p = n.parent; p; p = p.parent) {
        const o = ts.isJsxElement(p) ? p.openingElement : ts.isJsxSelfClosingElement(p) ? p : null;
        if (o && o.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'data-web-only')) return true;
      }
      return false;
    };
    const visit = (n: import('typescript').Node) => {
      let words: string | null = null;
      if (ts.isJsxText(n)) words = n.getText(sf);
      else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) words = n.text;
      else if (ts.isTemplateExpression(n)) words = n.head.text + n.templateSpans.map((s) => ' ' + s.literal.text).join('');
      if (words !== null) {
        strings++;
        // Imports and module paths are not words anyone reads.
        const isModulePath = ts.isStringLiteral(n) && (ts.isImportDeclaration(n.parent) || ts.isExportDeclaration(n.parent) || (ts.isCallExpression(n.parent) && /^(?:import|require)$/.test(n.parent.expression.getText(sf))));
        if (!isModulePath && STEERS.test(words.replace(/\s+/g, ' ')) && !hiddenInApp(n)) {
          if (NEVER_IN_THE_APP.has(rel)) listedHits++;
          else {
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
            offenders.push(`${rel}:${line + 1} "${words.trim().replace(/\s+/g, ' ').slice(0, 80)}"`);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  console.log(`[never-steers] ${files.length} files · ${strings} strings read · ${listedHits} listed hits · ${offenders.length} open`);
  assert.ok(strings > 20_000, `only ${strings} strings read — the reader is blind`);
  assert.deepEqual(
    offenders,
    [],
    'Words that send the app’s reader to the web. Say it neutrally (the held Pro line: "◆ N waiting for Pro"), mark it data-web-only, or — only if the app truly can never show it — list it in NEVER_IN_THE_APP with its gate:\n  ' +
      offenders.join('\n  '),
  );
  for (const [rel, { gate }] of NEVER_IN_THE_APP) {
    assert.match(src(rel), /web|setnayan\.com/i, `${rel} no longer says it — drop it from NEVER_IN_THE_APP`);
    assert.match(src(gate.file), gate.re, `${rel}: the gate it relies on moved out of ${gate.file}`);
  }
});

test('every Help answer the app shows (helpBodyFor · store shell) steers nowhere', async () => {
  const { ALL_HELP_ARTICLES, helpBodyFor } = await import('./help');
  assert.ok(ALL_HELP_ARTICLES.length > 50, 'the help list is empty — the anchor moved');
  const steer = ALL_HELP_ARTICLES.filter(({ article }) => STEERS.test(helpBodyFor(article, true))).map(({ article }) => article.slug);
  assert.deepEqual(steer, [], 'a Help answer shown in the app sends the reader to the web — give it an `appBody`');
});

test('the pattern catches the shapes it exists for, and passes the words that are only facts', () => {
  for (const bad of [
    'One change can be applied on the web.',
    '3 changes can be applied on the web — it stays in your draft',
    'This is only on the web',
    'Buy it on our website',
    'Unlock Pro at setnayan.com',
    'Finish from the website',
  ]) {
    assert.ok(STEERS.test(bad), `missed: ${bad}`);
  }
  for (const ok of ['◆ 2 waiting for Pro', 'Remove Pro changes', 'Your Event Hub', 'is waiting for Pro — it stays in your draft', 'hello@setnayan.com']) {
    assert.ok(!STEERS.test(ok), `false hit: ${ok}`);
  }
});

test('the held Pro line in the app is the ruled one — "◆ N waiting for Pro" + "Remove Pro changes"', () => {
  const sheet = src('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.match(sheet, /\{formatCount\(heldForPro\)\} waiting for Pro/);
  assert.match(sheet, /onClick=\{onRemoveHeld\}[\s\S]{0,300}Remove Pro changes/);
  const bar = src('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /heldForPro=\{storeShell \? summary\.proCount : 0\}/);
  assert.match(bar, /onRemoveHeld=\{storeShell \? \(\) => run\(\{ intent: 'drop', effect: HUB_DROP_ALL_PRO \}\) : undefined\}/);
  assert.match(bar, /\{formatCount\(summary\.proCount\)\} waiting for Pro/);
  assert.match(bar, /waits_for_pro: 'is waiting for Pro — it stays in your draft'/);
  // The action takes every held Pro effect off in one step, recomputed on the draft as the write lands.
  const action = src('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /if \(id === HUB_DROP_ALL_PRO\) \{[\s\S]{0,400}hubDraftProEffects\(next, live, false\)/);
  assert.match(action, /reason: storeShell \? 'waits_for_pro' : 'needs_pro',/);
});
