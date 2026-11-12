/**
 * ONE CHAT LOOK ON EVERY THREAD (owner 2026-10-28, verbatim: *"Same as our chatbox"* — and before it, *"When i press
 * chat on supplier, this must be full screen"*; and 2026-10-29, *"event dashboard chat is full screen. supplier chat not
 * same?"*). The couple's thread and the supplier's thread are the SAME chatbox: each route mounts the one frame, head,
 * stream and composer from `app/_components/chat/` — never a page-local copy — and the kit (`thread-kit.ts`) names
 * exactly those pieces for the next chat surface (the group chatroom).
 *
 * 🔑 WHY THIS GUARD PASSED WHILE THE TWO PAGES STILL DIFFERED (2026-10-29). It checked that each route IMPORTS and
 * MOUNTS the shared pieces — and both did. It never looked at what each page drew BESIDE the box, which is where the two
 * came apart: the supplier's page docked a 19rem customer column next to the chat from 1024 (the couple's chat had that
 * width), used its own narrower measure, and drew the answer to a booking ask ABOVE the box — where on a phone the
 * full-screen takeover covered it and its Pay door (measured: the door's centre hit the takeover's head). Same pieces,
 * different page. So the property guarded now is the PAGE: a thread route returns `ChatThreadFrame` holding exactly
 * one `ChatBox`, and nothing else is drawn — read from each route's own returned tree (TypeScript AST, not a regex of
 * a phrasing), and the frame itself RENDERED, so "nothing beside the box" is what the markup says.
 *
 * (The routes themselves cannot render here: each reads a signed-in session and the database before it returns.
 * `/dev/chat-lab/t/<id>` — couple shell, and `?side=vendor` in the supplier's real shell — and `/dev/supplier-chat-lab`
 * draw the same frame in each side's real chrome for a browser walk.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const ROUTES = ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx'];
const PIECES = [
  ['ChatBox', "@/app/_components/chat/chat-box"],
  ['ChatThreadHead', "@/app/_components/chat/chat-thread-head"],
  ['ChatMessageStream', "@/app/_components/chat-message-stream"],
  ['ChatSendForm', "@/app/_components/chat-send-form"],
] as const;

/**
 * True when `rel` takes `piece` from its own `_components/on-demand.tsx`, and that file loads it from the ONE shared
 * source under the same name (code split, not a copy). Anything else is false — the direct import must then hold.
 */
function onDemand(rel: string, piece: string, from: string): boolean {
  const s = read(rel);
  if (!new RegExp(`import \\{[^}]*\\b${piece}\\b[^}]*\\} from '\\./_components/on-demand';`).test(s)) return false;
  const wrap = read(rel.replace(/page\.tsx$/, '_components/on-demand.tsx'));
  const esc = from.replace(/[/.]/g, '\\$&');
  assert.match(
    wrap,
    new RegExp(`export const ${piece} = dynamic\\(\\s*\\(\\) => import\\(\\s*(?:\\/\\*[^*]*\\*\\/\\s*)?'${esc}'\\)\\.then\\(\\(m\\) => m\\.${piece}\\)`),
    `${rel}: the on-demand ${piece} is not the shared one`,
  );
  return true;
}

test('both thread routes mount the SAME shared pieces, once each, imported from the one source', () => {
  for (const rel of ROUTES) {
    const s = read(rel);
    assert.ok(s.length > 10_000, `${rel} read short`);
    for (const [piece, from] of PIECES) {
      assert.equal((s.match(new RegExp(`<${piece}\\b`, 'g')) ?? []).length, 1, `${rel}: <${piece}> is not mounted exactly once`);
      // ⚡ The supplier thread loads its heavy parts on demand: the SAME shared component, re-exported under its own name
      // by the page's `_components/on-demand.tsx` (`dynamic(() => import('<the one source>').then((m) => m.<piece>))`).
      if (onDemand(rel, piece, from)) continue;
      assert.match(s, new RegExp(`import \\{[^}]*\\b${piece}\\b[^}]*\\} from '${from.replace(/[/.]/g, '\\$&')}';`), `${rel}: ${piece} is not the shared one`);
    }
    // Nothing page-local draws a head or bubbles beside them.
    assert.doesNotMatch(s, /aria-label="Back to (Chats|Messages)"/, `${rel}: draws its own ‹ instead of the shared head`);
    assert.doesNotMatch(s, /rounded-2xl px-3 py-2 text-\[15px\]/, `${rel}: draws its own bubbles`);
  }
});

/* ── THE RETURNED TREE ─────────────────────────────────────────────────────────────────────────────────────────── */

type El = { tag: string; attrs: Map<string, ts.Expression | null>; kids: El[] };

/** A JSX node as tag · attributes · its ELEMENT children (whitespace and `{ comment }` children are not drawn). */
function el(node: ts.Node, sf: ts.SourceFile): El | null {
  if (ts.isParenthesizedExpression(node)) return el(node.expression, sf);
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
    const open = ts.isJsxElement(node) ? node.openingElement : node;
    const attrs = new Map<string, ts.Expression | null>();
    for (const a of open.attributes.properties) {
      if (!ts.isJsxAttribute(a)) continue;
      const init = a.initializer;
      attrs.set(a.name.getText(sf), init && ts.isJsxExpression(init) ? (init.expression ?? null) : null);
    }
    const kids: El[] = [];
    if (ts.isJsxElement(node)) {
      for (const c of node.children) {
        if (ts.isJsxText(c)) {
          assert.equal(c.text.trim(), '', `text "${c.text.trim().slice(0, 40)}" is drawn beside the chat`);
          continue;
        }
        if (ts.isJsxExpression(c)) {
          if (c.expression) kids.push({ tag: `{${c.expression.getText(sf).slice(0, 60)}}`, attrs: new Map(), kids: [] });
          continue;
        }
        const k = el(c, sf);
        if (k) kids.push(k);
      }
    }
    return { tag: open.tagName.getText(sf), attrs, kids };
  }
  if (ts.isJsxFragment(node)) {
    return { tag: '<>', attrs: new Map(), kids: node.children.map((c) => el(c, sf)).filter((x): x is El => x !== null) };
  }
  return null;
}

/**
 * A `{name}` child that is a `const name = (<…/>)` of the SAME page function, expanded to its element. THE ONE BUILD
 * (8 Nov 2026, v111 "Chat lives in the client"): the supplier's page defines its ONE `<ChatBox>` once as `chatBox` and
 * draws it in the frame (full screen) or, inside the picked client, without the frame — so the frame's child is read
 * through that one const, never two boxes.
 */
function expandConst(k: El, fn: ts.FunctionDeclaration, sf: ts.SourceFile): El {
  const m = /^\{([A-Za-z_$][\w$]*)\}$/.exec(k.tag);
  if (!m) return k;
  for (const st of fn.body!.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === m[1] && d.initializer) {
        const e = el(d.initializer, sf);
        if (e) return e;
      }
    }
  }
  return k;
}

/** The JSX the route's default export returns LAST — its normal render, after every early `redirect` / `notFound`. */
function returnedTree(rel: string): { tree: El; sf: ts.SourceFile; fn: ts.FunctionDeclaration } {
  const sf = ts.createSourceFile(rel, raw(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = sf.statements.find(
    (s): s is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(s) && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) && !!s.body,
  );
  assert.ok(fn?.body, `${rel}: no default-exported page function`);
  /*
    Build 2 · B2-D (8 Nov 2026): the supplier page's default export routes to ONE draw, `drawVendorThread`, which
    returns every node it drew — `full` for the full-screen route, `chat` / `quotation` / `decisions` for the picked
    client's embeds (one draw per open). The full-screen route's tree is that draw's `full`.
  */
  const draw = sf.statements.find(
    (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'drawVendorThread' && !!s.body,
  );
  const body = (draw ?? fn).body!;
  const last = [...body.statements].reverse().find((s): s is ts.ReturnStatement => ts.isReturnStatement(s) && !!s.expression);
  assert.ok(last?.expression, `${rel}: the page function has no final return`);
  let returned: ts.Expression = last.expression;
  if (draw && ts.isObjectLiteralExpression(returned)) {
    const full = returned.properties.find(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'full',
    );
    assert.ok(full, `${rel}: the draw returns no \`full\` tree`);
    returned = full.initializer;
  }
  const tree = el(returned, sf);
  assert.ok(tree, `${rel}: the page's final return is not JSX`);
  return { tree, sf, fn: draw ?? fn };
}

test('🔒 each thread route RETURNS the one thread frame holding one ChatBox — nothing drawn beside it', () => {
  for (const rel of ROUTES) {
    const { tree, sf, fn } = returnedTree(rel);
    let t = tree;
    // At most ONE plain gutter around it (the supplier tree has no event-layout column, so its page draws that column).
    if (t.tag === 'div') {
      assert.deepEqual(t.kids.map((k) => k.tag), ['ChatThreadFrame'], `${rel}: the page's column holds more than the thread frame`);
      t = t.kids[0]!;
    }
    assert.equal(t.tag, 'ChatThreadFrame', `${rel}: the page returns <${t.tag}>, not the one thread frame`);
    assert.deepEqual(
      t.kids.map((k) => expandConst(k, fn, sf).tag),
      ['ChatBox'],
      `${rel}: the thread frame holds more than one ChatBox — everything a side adds belongs INSIDE the box's slots`,
    );
    assert.deepEqual([...t.attrs.keys()].filter((k) => k !== 'list'), [], `${rel}: the frame takes only the list`);
    const list = t.attrs.get('list');
    if (list) assert.equal(el(list, sf)?.tag, 'ConversationColumn', `${rel}: the frame's list is not the shared ConversationColumn`);
  }
});

test('🔒 THE ONE BUILD · inside the picked client the supplier page draws the SAME box — no frame, no list, nothing beside it', () => {
  // v111 (owner 8 Nov 2026): Chat lives in the client. The supplier's page returns early for `embed === 'chat'` with
  // the one `chatBox` and nothing else — the client's pinned row is the head, so no frame (a phone takeover) and no
  // conversation list. Still ONE <ChatBox> in the file (test 1), and the frame's child is that same const.
  const rel = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
  const src = read(rel);
  assert.equal((src.match(/<ChatBox\b/g) ?? []).length, 1, 'a second ChatBox was drawn for the client page');
  assert.match(src, /const chatBox = \(\s*<ChatBox\b/, 'the one box is no longer the shared const');
  // Build 2 · B2-D: the picked client's ONE draw builds its Chat node as `const chat = (…)` beside Quotation + Decisions.
  // Comments are blanked first (a JSX `{/* … */}` note sits inside the node); `{ }` left by a blanked JSX comment is allowed.
  const bare = stripComments(src);
  const embed = bare.slice(bare.indexOf('const chat = ('), bare.indexOf('const chat = (') + 600);
  // The read marker rides beside the box but DRAWS NOTHING (it renders null — asserted below), so the page still shows
  // only the box: the chat is marked read when this node is on screen, never from Details or Quotation.
  assert.match(embed, /^const chat = \(\s*<div data-picked-client-page="chat"[^>]*>\s*(?:\{\s*\}\s*)?(?:<MarkReadWhenShown threadId=\{threadId\} \/>\s*)?\{chatBox\}\s*<\/div>\s*\);/, 'the client chat draws something beside the box');
  const marker = stripComments(readFileSync(join(WEB, 'app', 'vendor-dashboard', 'messages', '[threadId]', '_components', 'mark-read-when-shown.tsx'), 'utf8'));
  assert.match(marker, /return null;/, 'the read marker must draw nothing');
  assert.doesNotMatch(marker, /return\s*\(?\s*</, 'the read marker must draw nothing');
  assert.doesNotMatch(embed, /ChatThreadFrame|ConversationColumn/, 'the client chat must not draw the full-screen frame or the list');
});

test('the frame, RENDERED: one takeover, and the page column holds nothing but the list and the box', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ChatThreadFrame } = await import('@/app/_components/chat/chat-thread-frame');
  const { ChatBox } = await import('@/app/_components/chat/chat-box');
  const { ChatThreadHead } = await import('@/app/_components/chat/chat-thread-head');
  const h = React.createElement;
  // `children` goes in the props object (both components REQUIRE it in their prop types — the 3rd-argument form does
  // not satisfy `createElement`'s overloads under tsc).
  const html = renderToStaticMarkup(
    h(ChatThreadFrame, {
      list: h('aside', { 'data-test-list': '' }),
      children: h(ChatBox, {
          header: h(ChatThreadHead, {
            back: h('a', { 'data-test-back': '' }),
            name: 'Ana’s Wedding (Dec 12)',
            initials: 'AM',
            actions: h('button', { 'data-test-menu': '' }),
          }),
          notice: h('p', { 'data-test-notice': '' }),
          composer: h('form', { 'data-test-composer': '' }),
          children: h('ul', { 'data-test-stream': '' }),
        }),
    }),
  );
  assert.equal((html.match(/data-chat-takeover=""/g) ?? []).length, 1, 'the frame does not draw exactly one takeover');
  // Frame → [list, section → takeover]. Nothing else at the frame's level (the hash reveal draws nothing).
  const body = html.replace(/^<div[^>]*data-chat-thread-frame=""[^>]*>/, '').replace(/<\/div>$/, '');
  assert.notEqual(body, html, 'the frame root is not the thread frame');
  assert.match(body, /^<aside data-test-list=""><\/aside><section class="[^"]*\bflex-1\b[^"]*"><div data-chat-box="[^"]*" data-chat-takeover=""/, 'something is drawn between the list and the box');
  assert.match(body, /<\/section>$/, 'something is drawn after the box');
  // Inside the takeover: the head (with ‹ and the menu), the notice band, the stream and the composer.
  const box = body.slice(body.indexOf('data-chat-takeover'));
  for (const mark of ['data-test-back', 'data-chat-head-name', 'data-test-menu', 'data-test-notice', 'data-test-stream', 'data-test-composer']) {
    assert.ok(box.includes(mark), `${mark} is not inside the takeover`);
  }
});

test('the kit names exactly the shared pieces, for the next chat surface', () => {
  const kit = read('app/_components/chat/thread-kit.ts');
  for (const piece of [...PIECES.map(([p]) => p), 'ChatThreadFrame']) {
    assert.match(kit, new RegExp(`export \\{ ${piece} \\} from `), `the kit does not export ${piece}`);
  }
});

test('the frame is the full-screen takeover on a phone — the top bar and the bottom tabs are covered', () => {
  const box = read('app/_components/chat/chat-box.tsx');
  assert.match(box, /data-chat-takeover=""/);
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const at = css.indexOf('AN OPEN CHAT THREAD IS FULL SCREEN ON A PHONE');
  assert.ok(at > 0, 'the takeover rule is gone');
  const rule = css.slice(at, css.indexOf('@media (min-width: 701px)', at));
  assert.match(rule, /\[data-chat-takeover\] \{\s*position: fixed;\s*inset: 0;\s*z-index: 45;/);
  // Above the bottom dock (z 30) and the shell's top bar; below the sheets (z 50) that open over it.
  assert.ok(45 > 30 && 45 < 50);
  // The route rise is a transform, and a transformed ancestor captures a fixed child: on a phone the thread does not rise.
  const still = css.indexOf('.sn-page-enter:has([data-chat-takeover])');
  assert.ok(still > 0, 'the route rise draws the thread inside the page first');
  const media = css.lastIndexOf('@media', still);
  // A phone is below 701, the system's line (owner 2026-11-13, D3 — it was 1024, which gave a 768 tablet the phone's thread).
  assert.match(css.slice(media, still + 80), /^@media \(max-width: 700\.98px\) \{\s*\.sn-page-enter:has\(\[data-chat-takeover\]\) \{ animation: none; \}/, 'the thread still rises on a phone');
});
