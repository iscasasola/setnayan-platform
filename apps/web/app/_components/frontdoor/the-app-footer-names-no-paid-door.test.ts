import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { isStoreShellWebOnlyPath, WEB_ONLY_ATTR } from '@/lib/store-shell';

/**
 * THE RAIL'S LINKS OPEN ONLY DOORS THE iPHONE APP OPENS (2026-10-25).
 *
 * The rail's small print showed Pricing, Download and For suppliers inside the
 * iPhone app. /pricing and /for-suppliers are refused doorways there
 * (`STORE_SHELL_WEB_ONLY_DOORWAYS`), and /download offers the Mac and Windows
 * apps to someone already in this one — owner ruling #6729, "the app names no
 * paid service" (App Review 3.1.1 / 2.3.10). The marketing header had hidden
 * the same three since 2026-10-19; the rail, built later, never did.
 *
 * 🔑 THE PROPERTY, NOT THE THREE LINKS. Every JSX element in the rail with a
 * literal `href` that the store shell refuses (asked of `isStoreShellWebOnlyPath`
 * itself, so a newly refused door is covered with no edit here) — plus the
 * pages listed in STEERS_OUT_OF_THE_APP — must sit inside a `data-web-only`
 * element, which app/globals.css hides before first paint in the store shell.
 * The web is unchanged: the attribute does nothing there.
 *
 * Run: cd apps/web && npx tsx --test app/_components/frontdoor/the-app-footer-names-no-paid-door.test.ts
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const SHELL = 'app/_components/frontdoor/front-door-shell.tsx';

/** Open in the app, but they send its reader to another app or to the web. */
const STEERS_OUT_OF_THE_APP: ReadonlyMap<string, string> = new Map([
  ['/download', 'offers the Mac and Windows apps (2.3.10)'],
]);

function mustHide(href: string): boolean {
  return isStoreShellWebOnlyPath(href) || STEERS_OUT_OF_THE_APP.has(href);
}

function hrefsNotHidden(source: string): { href: string; line: number }[] {
  const sf = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attrs = (n: ts.Node) =>
    ts.isJsxElement(n) ? n.openingElement.attributes : ts.isJsxSelfClosingElement(n) ? n.attributes : null;
  const hasWebOnly = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n; p; p = p.parent) {
      const a = attrs(p);
      if (a?.properties.some((x) => ts.isJsxAttribute(x) && x.name.getText(sf) === WEB_ONLY_ATTR)) return true;
    }
    return false;
  };
  const out: { href: string; line: number }[] = [];
  const visit = (n: ts.Node) => {
    if (
      ts.isJsxAttribute(n) &&
      n.name.getText(sf) === 'href' &&
      n.initializer &&
      ts.isStringLiteral(n.initializer) &&
      mustHide(n.initializer.text) &&
      !hasWebOnly(n.parent.parent)
    ) {
      out.push({ href: n.initializer.text, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

test('every rail link to a door the app refuses or steers out of is data-web-only', () => {
  const bad = hrefsNotHidden(readFileSync(join(WEB, SHELL), 'utf8'));
  assert.deepEqual(
    bad.map((b) => `${SHELL}:${b.line} — ${b.href}`),
    [],
    'Shown inside the iPhone app. Add data-web-only="" to the link (hidden before first paint there; the web is unchanged).',
  );
});

test('the rail still links those doors on the web — the guard has something to hold', () => {
  const src = readFileSync(join(WEB, SHELL), 'utf8');
  for (const href of ['/pricing', '/download', '/for-suppliers']) {
    assert.ok(src.includes(`href="${href}"`), `${href} left the rail — re-check this guard's premise`);
  }
});

test('the checker catches a bare link and passes a hidden one', () => {
  assert.equal(hrefsNotHidden('const a = <Link href="/pricing">Pricing</Link>;').length, 1);
  assert.equal(hrefsNotHidden('const a = <Link href="/download">Download</Link>;').length, 1);
  assert.equal(hrefsNotHidden('const a = <Link href="/pricing" data-web-only="">Pricing</Link>;').length, 0);
  assert.equal(hrefsNotHidden('const a = <div data-web-only=""><a href="/for-suppliers">x</a></div>;').length, 0);
  assert.equal(hrefsNotHidden('const a = <Link href="/help">Help</Link>;').length, 0);
});

test('the store shell really hides data-web-only before first paint', () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(css, /html\[data-store-shell\]\s*\[data-web-only\]\s*\{\s*display:\s*none\s*!important;/);
});
