import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * NO "GALLERY" ON SCREEN — MEMORIES · PORTFOLIO · INSPIRATION.
 *
 * Owner, 2026-10-23 (DECISION_LOG "no 'gallery' in the UI"): *"check the rest of
 * the words in the app. remove gallery and use memories"*. Asked how to split the
 * concepts, he chose: an event's own photos and videos are **Memories**; a
 * supplier's own photos are **Portfolio**; the Mood Board library is
 * **Inspiration**. One word per concept, and "gallery" is none of them.
 *
 * 🔑 KEYED ON A PROPERTY, NOT ON THE OLD SENTENCES. Every string a source file
 * can put on screen — JSX text, string and template literals, attribute values —
 * is read through the TypeScript parser, so a comment is never mistaken for copy
 * and a REWORDED sentence that brings the word back is caught as surely as the
 * old one. A new file under app/, components/ or lib/ is covered the day it lands.
 *
 * WHAT IS NOT COPY, AND WHY IT MAY KEEP THE WORD
 *   · A token — one run with no whitespace that is all lower-case or carries
 *     code punctuation: a key, a route, an anchor, a CSS variable (`'gallery'`,
 *     `'/tour/gallery'`, `'#site-gallery'`, `'TYPE-GALLERY'`). The ruling renames
 *     what people read, never code identifiers or routes. A lone capitalised
 *     `'Gallery'` IS read as copy — it is how a tab label is written.
 *   · An argument to `console.*` — a log line never reaches a screen.
 *   · `lib/ugat/` — the engineering map; its notes name schema objects
 *     (`supplier_gallery`, `moodboard_library_assets_supplier_gallery_shape`).
 *   · The exact internal lines in INTERNAL below, each with its reason —
 *     including the SEO search keywords the owner kept (2026-10-23).
 */

const WEB = process.cwd();
const ROOTS = ['app', 'components', 'lib'];
const WORD = /\bgaller(y|ies)\b/i;

/** Internal strings that never render — file + an exact fragment + why. */
const INTERNAL: ReadonlyArray<{ file: string; has: string; why: string }> = [
  {
    file: 'lib/moodboard-gallery-screen.server.ts',
    has: 'gallery screen timed out after',
    why: 'a Promise.race timeout reason, caught and logged server-side',
  },
  // Owner 2026-10-23: "keep the SEO keyword as gallery" — search keywords are
  // page metadata (what people type into a search box), never drawn on screen.
  { file: 'app/page.tsx', has: 'wedding photo gallery app', why: 'SEO metadata keyword' },
  { file: 'app/(shell)/papic/page.tsx', has: 'guest photo gallery', why: 'SEO metadata keyword' },
  { file: 'app/(shell)/papic/page.tsx', has: 'shared wedding gallery', why: 'SEO metadata keyword' },
  { file: 'lib/feature-pages/day-memories.ts', has: 'wedding photo gallery', why: 'SEO metadata keyword (feature-pages/seo.ts)' },
  { file: 'lib/feature-pages/day-memories.ts', has: 'gallery ng kasal', why: 'SEO metadata keyword (feature-pages/seo.ts)' },
];

function walkDir(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
}

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const r of ROOTS) {
    try {
      walkDir(join(WEB, r), out);
    } catch {
      /* a root that does not exist is simply empty */
    }
  }
  return out.map((p) => relative(WEB, p)).filter((f) => !f.startsWith('lib/ugat/'));
}

/**
 * A token is one run with no whitespace that is either all lower-case (`'gallery'`,
 * a key) or carries code punctuation (`'/tour/gallery'`, `'#site-gallery'`,
 * `'TYPE-GALLERY'`, `'var(--ug-e-gallery)'`). A single CAPITALISED word —
 * `'Gallery'`, `'Galleries'` — is a label, and is read as copy.
 */
function isToken(t: string): boolean {
  if (/\s/.test(t)) return false;
  return t === t.toLowerCase() || /[#/._:\-[\]()=?&@]/.test(t);
}

function isInsideConsoleCall(n: ts.Node, sf: ts.SourceFile): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && /^console\.\w+$/.test(p.expression.getText(sf))) return true;
    if (ts.isBlock(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

/** Every piece of text in a file that could reach the screen, with its line. */
export function copyIn(file: string): { text: string; line: number }[] {
  const source = readFileSync(join(WEB, file), 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { text: string; line: number }[] = [];
  const push = (n: ts.Node, text: string) => {
    if (isToken(text.trim())) return; // a key, route, anchor or class is not copy
    if (isInsideConsoleCall(n, sf)) return;
    out.push({ text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
  };
  const walk = (n: ts.Node) => {
    if (ts.isJsxText(n)) push(n, n.text);
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const p = n.parent;
      // An import path is not copy.
      if (!ts.isImportDeclaration(p) && !ts.isExportDeclaration(p) && !(ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword)) push(n, n.text);
    } else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) push(n, n.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

const FILES = sourceFiles();

test('the anchor: the reader walks the whole app and finds the renamed copy', () => {
  assert.ok(FILES.length > 1000, `only ${FILES.length} source files found — a root moved?`);
  // The guest page's tab — the most-read instance of the old word — now reads Memories.
  const menu = copyIn('app/[slug]/_lib/site-menu.ts').map((c) => c.text);
  assert.ok(menu.includes('Memories'), 'the reader did not find the guest menu label');
  // …and a comment is not copy: the line's own comment names the retired word,
  // and the reader must see the source holds it while the copy does not.
  assert.match(readFileSync(join(WEB, 'app/[slug]/_lib/site-menu.ts'), 'utf8'), /never "Gallery"/);
  assert.ok(!menu.some((t) => WORD.test(t)), 'the reader took a comment for copy');
});

test('no user-visible string says "gallery" — Memories · Portfolio · Inspiration', () => {
  const hits: string[] = [];
  for (const f of FILES) {
    for (const { text, line } of copyIn(f)) {
      if (!WORD.test(text)) continue;
      if (INTERNAL.some((i) => i.file === f && text.includes(i.has))) continue;
      hits.push(`${f}:${line} — ${JSON.stringify(text.trim().replace(/\s+/g, ' ').slice(0, 110))}`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    'Owner 2026-10-23: no "gallery" in the UI. An event\'s photos are "Memories", a supplier\'s own photos are ' +
      '"Portfolio", the Mood Board library is "Inspiration":\n' +
      hits.join('\n'),
  );
});

test('every INTERNAL exemption still points at a real line — a dead exemption is removed', () => {
  for (const i of INTERNAL) {
    const found = copyIn(i.file).some((c) => c.text.includes(i.has)) || readFileSync(join(WEB, i.file), 'utf8').includes(i.has);
    assert.ok(found, `${i.file} no longer holds "${i.has}" — drop the exemption`);
  }
});
