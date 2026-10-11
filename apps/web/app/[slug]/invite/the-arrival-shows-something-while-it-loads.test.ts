/**
 * the-arrival-shows-something-while-it-loads.test.ts — the guest's landing and
 * reply pages draw the door as soon as the routing is decided, and still answer
 * a real 404. (`_components/arrival-loading.tsx` has the story.)
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `/[slug]/invite/enter` and `/[slug]/invite/reply` each ran a dozen-plus
 * awaits in a row with no boundary under them: nothing was drawn until the last
 * one answered (measured: a 2.9 s blank; on the small database plan's first
 * call after a quiet gap, longer). Every personal link and QR lands on the
 * first of them.
 *
 * ── The property (read from the syntax tree) ───────────────────────────────
 * For each of the two pages:
 *   1 · the page function ENDS by returning `<Suspense fallback={<ArrivalLoading
 *       …/>}>` around ONE async body part;
 *   2 · inside that body part there is NO `notFound()`, `redirect()`,
 *       `permanentRedirect()` or `leaveForTheHub()` — the status is settled
 *       before the first flush, so an unknown address is still a real 404 and
 *       a redirect is still a real redirect;
 *   3 · the routing decisions are still there, above the boundary
 *       (anti-vacuity), and the slow work is below it — `wearTheHub(` is called
 *       inside the body part and nowhere above it;
 *   4 · no `loading.tsx` exists anywhere under `app/[slug]` (the file that was
 *       deleted on purpose — it turns a 404 into a 200).
 * And the fallback itself, rendered:
 *   5 · it is the door with the couple's names, says "Loading your invitation…"
 *       to a screen reader, carries "Made with Setnayan" at the foot (never
 *       Setnayan's bar on top), and holds no control a guest could press.
 *
 * ── Caveats — read before trusting a green run ─────────────────────────────
 *   · Nothing here measures time. HOW SOON the door appears is the guest
 *     layout's reads plus this page's routing reads (the event, the pass, the
 *     guest row) — those still come first, and on a stalled database the wait
 *     is theirs. Only a real run on a real phone shows the seconds.
 *   · That the fallback WEARS the couple's look depends on `loadGuestLook`
 *     answering what the layout's own call answered (`cache()`); the look scope
 *     is rendered here with no look (the house door), because the theme faces
 *     are `next/font` and cannot load in Node.
 *   · § 2 names four calls. A helper that redirects under another name would
 *     pass it — today none exists in either body (`leaveForTheHub` is the one
 *     such helper, and it is named).
 *   · A notFound()/redirect() INSIDE a component the body renders is not seen.
 *   · What the Maker's canvas shows while this fallback is up was not walked.
 *
 * Sabotage (2026-10-11, each on the real file, restored by hash):
 *   enter: return the body bare (no Suspense) ............... § 1 red
 *   reply: a `redirect()` moved inside the body ............. § 2 red
 *   enter: `wearTheHub` hoisted above the boundary .......... § 3 red
 *   a `loading.tsx` added under app/[slug]/invite/enter ..... § 4 red
 *   the fallback loses its status line ...................... § 5 red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* `server-only` is a bundler assertion; `next/font` is a build-time loader. Neither exists in Node. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/font/local' || request === 'next/font/google') {
      const face = () => ({ className: '', variable: '', style: {} });
      return new Proxy({ __esModule: true, default: face } as Record<string | symbol, unknown>, {
        get: (t, k) => (k in t ? t[k] : face),
      });
    }
    return load.call(this, request, ...rest);
  };
}

const HERE = __dirname;
const SLUG = join(HERE, '..');
const PAGES = [
  { file: 'enter/page.tsx', page: 'InviteEnterPage', body: 'InviteEnterBody' },
  { file: 'reply/page.tsx', page: 'InviteReplyPage', body: 'InviteReplyBody' },
] as const;

const LEAVES = new Set(['notFound', 'redirect', 'permanentRedirect', 'leaveForTheHub']);

function read(p: (typeof PAGES)[number]) {
  const text = readFileSync(join(HERE, p.file), 'utf8');
  const sf = ts.createSourceFile(p.file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fn: ts.FunctionDeclaration | undefined;
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === p.page) fn = n;
  });
  assert.ok(fn?.body, `${p.file}: ${p.page} is gone or renamed — update this test`);
  const statements = fn!.body!.statements;
  // `const <Body> = async () => { … }` — a direct statement of the page function.
  let bodyFn: ts.ArrowFunction | undefined;
  let bodyAt = -1;
  statements.forEach((s, i) => {
    if (!ts.isVariableStatement(s)) return;
    for (const d of s.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === p.body && d.initializer && ts.isArrowFunction(d.initializer)) {
        bodyFn = d.initializer;
        bodyAt = i;
      }
    }
  });
  const calls = (root: ts.Node, names: Set<string>): string[] => {
    const out: string[] = [];
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text)) out.push(n.expression.text);
      ts.forEachChild(n, walk);
    };
    walk(root);
    return out;
  };
  const awaits = (root: ts.Node): number => {
    let n = 0;
    const walk = (x: ts.Node) => {
      if (ts.isAwaitExpression(x)) n += 1;
      ts.forEachChild(x, walk);
    };
    walk(root);
    return n;
  };
  return { sf, statements, bodyFn, bodyAt, calls, awaits };
}

for (const p of PAGES) {
  test(`1 · ${p.file}: the page ends by returning the door's fallback around ONE async body`, () => {
    const { sf, statements, bodyFn, bodyAt } = read(p);
    assert.ok(bodyFn, `${p.file}: there is no \`const ${p.body} = async () => …\` — the body is not one part a boundary can hold`);
    assert.ok(bodyFn!.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword), `${p.body} is not async`);
    const last = statements[statements.length - 1]!;
    assert.equal(bodyAt, statements.length - 2, `${p.file}: something stands between the body and the page's return`);
    assert.ok(ts.isReturnStatement(last) && last.expression, `${p.file}: the page does not end in a return`);
    let jsx: ts.Node = (last as ts.ReturnStatement).expression!;
    while (ts.isParenthesizedExpression(jsx)) jsx = jsx.expression;
    assert.ok(ts.isJsxElement(jsx), `${p.file}: the page's last return is not an element`);
    const el = jsx as ts.JsxElement;
    assert.equal(el.openingElement.tagName.getText(sf), 'Suspense', `${p.file}: the body is returned bare — nothing is drawn until its last await`);
    const fallback = el.openingElement.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'fallback');
    assert.ok(fallback, `${p.file}: the boundary has no fallback`);
    assert.match(fallback!.getText(sf), /^fallback=\{\s*<ArrivalLoading\b/, `${p.file}: the fallback is not the door's own loading state`);
    const kids = el.children.filter((c) => !ts.isJsxText(c) || c.getText(sf).trim() !== '');
    assert.equal(kids.length, 1);
    assert.equal(kids[0]!.getText(sf), `<${p.body} />`, `${p.file}: the boundary does not hold the body`);
  });

  test(`2 · ${p.file}: nothing below the boundary can change the status — no notFound(), no redirect()`, () => {
    const { bodyFn, calls } = read(p);
    assert.ok(bodyFn);
    assert.deepEqual(
      calls(bodyFn!, LEAVES),
      [],
      `${p.file}: the body calls a routing exit after the page has started streaming with HTTP 200. ` +
        'Decide it above the boundary — that is what keeps an unknown address a real 404.',
    );
  });

  test(`3 · ${p.file}: the routing is above the boundary, the slow work below it`, () => {
    const { statements, bodyFn, bodyAt, calls, awaits } = read(p);
    assert.ok(bodyFn);
    const above = statements.slice(0, bodyAt);
    const aboveCalls = above.flatMap((s) => calls(s, LEAVES));
    assert.ok(aboveCalls.includes('notFound'), `anti-vacuity: ${p.file} no longer decides notFound() above the boundary`);
    assert.ok(aboveCalls.some((c) => c === 'redirect' || c === 'leaveForTheHub'), `anti-vacuity: ${p.file} no longer redirects above the boundary`);
    const slow = new Set(['wearTheHub']);
    assert.deepEqual(above.flatMap((s) => calls(s, slow)), [], `${p.file}: the Event Hub's look and background are read ABOVE the boundary — the door waits for them again`);
    assert.equal(calls(bodyFn!, slow).length, 1, `anti-vacuity: ${p.file}'s body no longer wears the hub`);
    // (reply gathers seven reads in ONE `Promise.all`, so the count of awaits is small there by design)
    assert.ok(awaits(bodyFn!) >= 2, `anti-vacuity: ${p.file}'s body holds ${awaits(bodyFn!)} awaits — the slow work moved`);
  });
}

test('4 · there is no loading.tsx anywhere under app/[slug] — it turns a real 404 into a 200', () => {
  const found: string[] = [];
  let seen = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        seen += 1;
        if (/^loading\.(tsx|ts|jsx|js)$/.test(name)) found.push(relative(SLUG, p));
      }
    }
  };
  walk(SLUG);
  assert.ok(seen > 100 && existsSync(join(SLUG, 'page.tsx')), 'anti-vacuity: the walk did not reach the guest tree');
  assert.deepEqual(
    found,
    [],
    'A route-level loading file commits HTTP 200 before the page decides anything (app/[slug]/page.tsx, "THE BLANK WHITE SCREEN"). ' +
      'Use a <Suspense> inside the page, after its last notFound()/redirect().',
  );
});

test('5 · the fallback is the door, loading: the names, the words, the foot — and nothing to press', async () => {
  const { ArrivalLoading } = await import('./_components/arrival-loading');
  const { hubDoorSkin } = await import('./_components/hub-door-skin');
  const html = renderToStaticMarkup(
    React.createElement(ArrivalLoading, {
      look: null,
      door: {
        eyebrow: 'You’re invited',
        title: 'Maria & Jose',
        titleIsNames: true,
        width: 'lg',
        skin: hubDoorSkin({ mark: null, monogram: 'M&J', animate: false }),
      },
    }),
  );
  assert.match(html, /<h1[^>]*>Maria &amp; Jose<\/h1>/, 'the door does not say whose event this is');
  assert.match(html, /<p role="status" class="sr-only">Loading your invitation…<\/p>/, 'a screen reader is not told it is loading');
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Made with Setnayan/, 'the couple\'s door lost its foot line');
  assert.doesNotMatch(html, /aria-label="Setnayan home"/, 'Setnayan\'s bar is drawn on top of a couple\'s page');
  assert.doesNotMatch(html, /<(button|input|form|select|textarea)\b/, 'a loading door holds a control');
  // The placeholders are hidden from assistive tech and give up instead of lingering.
  assert.match(html, /class="sn-skeleton-gives-up[^"]*"/);
  assert.ok((html.match(/<span aria-hidden="true" class="skeleton /g) ?? []).length >= 3);
});
