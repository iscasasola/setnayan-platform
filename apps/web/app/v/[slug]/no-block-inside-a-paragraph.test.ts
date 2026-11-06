/**
 * A component whose root is a block element is never placed inside a <p>.
 *
 * ── THE DEFECT (live walk 2026-11-01, production 739140f) ──────────────────
 * Every load of `/setnaprod` and `/v/setnaprod` threw React error #418
 * (`args[]=HTML`: the server HTML did not match the client tree), in light and
 * dark, in Chromium and WebKit. The page still drew, so nothing looked broken.
 *
 * Cause: the shop footer wrapped `<ReportPageButton>` in `<p className="pt-1">`.
 * The button's root is a `<div>`. HTML forbids a <div> inside a <p>, so the
 * browser's parser CLOSES the <p> before the <div> — the DOM it builds from the
 * server HTML has an extra empty <p> and the button outside it, while the tree
 * React hydrates still has the button inside the <p>. Measured on the live
 * page: 12 `<p` tags in the HTML, 13 <p> elements in the DOM; rewriting only
 * that one <p> to a <div> (HTML and RSC payload together, through a Playwright
 * route) made the error disappear in all four engine × scheme runs.
 *
 * 🔑 NO TYPE CHECK, LINT RULE OR TEST SAW IT. JSX accepts any child in a <p>;
 * the error is only visible in a browser console, minified, on a page that
 * otherwise renders.
 *
 * WHAT THIS HOLDS — source, not a browser:
 *   1. each listed component's ROOT is still a block element (if it becomes a
 *      <span> the list is stale and this says so, rather than passing blind);
 *   2. no call site of a listed component sits inside an unclosed <p> in the
 *      same file (opening `<p` vs `</p>` counted up to the call, comments
 *      stripped).
 * It cannot see a <p> opened in a PARENT component and closed around a child
 * passed in as `children` — stated rather than implied.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Components that render a block root, and the file that defines each. */
const BLOCK_ROOTED: ReadonlyArray<{ name: string; file: string }> = [
  { name: 'ReportPageButton', file: 'app/_components/report-page-button.tsx' },
];

const BLOCK_TAGS = new Set(['div', 'section', 'ul', 'ol', 'form', 'h1', 'h2', 'h3', 'table', 'dl', 'figure', 'aside', 'nav', 'header', 'footer']);

function tsxFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.tsx')) out.push(p);
    }
  };
  walk(join(WEB, root));
  return out;
}

/** How many <p> elements are open at `at` — openings minus closings before it. */
function openParagraphsAt(src: string, at: number): number {
  const before = src.slice(0, at);
  const opens = (before.match(/<p(?=[\s>])/g) ?? []).length;
  const selfClosed = (before.match(/<p\b[^<>]*\/>/g) ?? []).length;
  const closes = (before.match(/<\/p>/g) ?? []).length;
  return opens - selfClosed - closes;
}

test('each listed component still renders a block root', () => {
  for (const { name, file } of BLOCK_ROOTED) {
    const src = stripComments(readFileSync(join(WEB, file), 'utf8'));
    const fn = src.indexOf(`export function ${name}`);
    assert.ok(fn >= 0, `${file} no longer defines ${name}`);
    const root = /return \(\s*<([a-z][a-z0-9]*)/.exec(src.slice(fn))?.[1];
    assert.ok(
      root && BLOCK_TAGS.has(root),
      `${name}'s root is now <${root}> — if it is no longer a block element, drop it from BLOCK_ROOTED`,
    );
  }
});

test('the counter sees a <p> left open — proven on samples', () => {
  const inside = '<p className="pt-1">\n  <ReportPageButton targetType="vendor" />\n</p>';
  assert.equal(openParagraphsAt(inside, inside.indexOf('<ReportPageButton')), 1);
  const outside = '<p>Powered by</p>\n<div className="pt-1">\n  <ReportPageButton />\n</div>';
  assert.equal(openParagraphsAt(outside, outside.indexOf('<ReportPageButton')), 0);
  const pre = '<pre>x</pre><path d="" /><p className="a" /><ReportPageButton />';
  assert.equal(openParagraphsAt(pre, pre.indexOf('<ReportPageButton')), 0, '<pre>, <path> and a self-closed <p /> are not open paragraphs');
});

test('no block-rooted component is placed inside a <p>', () => {
  const bad: string[] = [];
  let calls = 0;
  for (const file of [...tsxFiles('app'), ...tsxFiles('components')]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const { name } of BLOCK_ROOTED) {
      for (const m of src.matchAll(new RegExp(`<${name}\\b`, 'g'))) {
        calls += 1;
        if (openParagraphsAt(src, m.index!) > 0) bad.push(`${relative(WEB, file)} — <${name}> inside a <p>`);
      }
    }
  }
  console.log(`[no-block-inside-p] ${calls} call site(s) of ${BLOCK_ROOTED.length} block-rooted component(s) checked`);
  assert.ok(calls >= 4, `only ${calls} call sites found — the scan has gone blind`);
  assert.deepEqual(
    bad,
    [],
    'A <div>-rooted component inside a <p> makes the browser close the <p> early, so the server HTML no longer ' +
      'matches the tree React hydrates (React #418 on every load). Wrap it in a <div> instead:\n  ' +
      bad.join('\n  '),
  );
});
