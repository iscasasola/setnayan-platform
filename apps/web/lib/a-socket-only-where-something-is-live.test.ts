/**
 * A LIVE SOCKET ONLY WHERE SOMETHING IS LIVE (2026-10-21).
 *
 * 🔌 Every Supabase Realtime channel keeps the tab's websocket open, and a `postgres_changes` channel also makes the
 * database evaluate every matching write for that tab. Until today the unread bell and the Messages envelope — drawn by
 * EVERY signed-in layout — each held one, so every plain page (a guest list, a budget, a settings form) held a socket
 * open all day in every tab. Measured in the lab before the change: the budget page joined three channels (envelope,
 * bell, budget) and held one socket; after it, none (PR body, `census-*.json`).
 *
 * What this holds — properties, not phrasings:
 *
 *   1 · THE CENSUS. Every source file that opens a channel (`.channel(` in code, comments stripped) is named in
 *       `LIVE` with the reason it is live. A new socket is a deliberate act: a file not in the list fails, and a listed
 *       file that no longer opens one fails too, so the list cannot rot into a permission slip.
 *   2 · NOTHING A LAYOUT DRAWS HOLDS A SOCKET. Walking every `layout.tsx`'s imports (static, re-export and dynamic,
 *       transitively, through `app/` `lib/` `components/`), no file that opens a channel is reachable — except the
 *       ones in `LAYOUT_MAY_REACH`, each with why. This is the property the bell broke: it was not a page, it was the
 *       chrome around every page.
 *   3 · ONE BROWSER CLIENT PER TAB. `createBrowserClient` is called in exactly one file (`lib/supabase/client.ts`,
 *       which @supabase/ssr keeps a singleton in the browser), and no `'use client'` file builds a second client from
 *       `@supabase/supabase-js` — a second client would be a second socket.
 *   4 · THE CHROME READS THROUGH THE POLL. The bell and the envelope re-ask through `startCountPoll`, and the budget
 *       re-reads through `onTabReturn` (lib/tab-return.ts, whose own test holds "a failed read changes nothing").
 *
 * Sabotage (2026-10-21, each on the real file, restored by `git checkout`): see the PR body's table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { resolveImport, WEB_ROOT } from './rsc-function-props';
import { stripComments } from './strip-comments';

const ROOTS = ['app', 'lib', 'components'];

/** Every file that opens a Realtime channel, and why it is live. Keys are paths from apps/web. */
const LIVE: Record<string, string> = {
  'app/_components/chat-message-stream.tsx': 'an open chat thread streams its messages (lets go after 45 s hidden)',
  'app/_components/thread-call-launcher.tsx': 'an incoming call rings on an open thread — only when calling is unlocked',
  'app/_components/appointment-join.tsx': 'Join on a confirmed online appointment, inside its join window',
  'lib/call-webrtc.ts': 'call signalling, only while in a call',
  'app/_components/run-of-show-header.tsx': 'the day-of now / next header (lets go after 45 s hidden)',
  'app/[slug]/_components/day-of-announcement.tsx':
    "the coordinator's announcement to guests, mounted only once one was sent (lets go after 45 s hidden)",
  'app/dashboard/[eventId]/_actions/day-of-broadcast.ts': 'SERVER: sends one announcement ping — no browser socket',
  'app/dashboard/[eventId]/seating/_components/use-seating-live-refresh.ts':
    "a view-only seat plan follows the editor's changes (lets go after 45 s hidden)",
  'app/dashboard/[eventId]/seating/_components/use-seating-presence.ts': 'co-planners on the seat plan — presence',
  'app/_components/plan3d/use-plan3d-room.ts': 'the 3D plan room — presence',
  'app/_components/demo-session/use-demo-channel.ts': 'a Papic demo pairing, only once a phone has paired',
  'lib/demo-webrtc.ts': 'Papic demo camera signalling',
  'app/vendor-dashboard/messages/[threadId]/_components/vendor-payment-live.tsx':
    "the supplier's payments-to-confirm, on the thread and the Payments tab (lets go after 45 s hidden)",
  'app/vendor-dashboard/on-the-day/_components/live-reviews.tsx': "the supplier's on-the-day console — reviews arriving",
  'app/wall/[eventId]/_components/wall-projection.tsx': 'the live photo wall on a projector',
  'lib/panood-webrtc.ts': 'Panood / Live Studio camera signalling',
  'lib/panood-guest-webrtc.ts': 'Panood guest-pick camera signalling',
  'app/admin/connection-logs/connection-logs-client.tsx': 'admin only — the live connection log',
};

/**
 * Live files a layout may reach, why that is still "only where live", and the GATE that keeps it so — a file and a
 * pattern that must still be there. Reachable is not subscribed: each of these opens its channel only behind the gate.
 */
const LAYOUT_MAY_REACH: Record<string, { why: string; gateFile: string; gate: RegExp }> = {
  'app/[slug]/_components/day-of-announcement.tsx': {
    why: "the guests' tree layout mounts it only once a coordinator announcement exists",
    gateFile: 'app/[slug]/layout.tsx',
    gate: /\{broadcast && eventId \? \(/,
  },
  'app/_components/demo-session/use-demo-channel.ts': {
    why: "the home page's Papic demo overlay — a channel only while the overlay is open with a paired session",
    gateFile: 'app/_components/home/papic-demo-overlay.tsx',
    gate: /useDemoChannel\(\s*current === 'papic-demo' && pair \? pair\.sessionId : ''/,
  },
  'lib/demo-webrtc.ts': {
    why: "the home page's Panood demo overlay — cameras only while the overlay is open with a minted session",
    gateFile: 'app/_components/home/panood-demo-overlay.tsx',
    gate: /if \(!open \|\| !pair\) return;\s*let viewer/,
  },
};

/** Files that must never open a channel: the chrome on every page, and pages where nothing is live. */
const NEVER_LIVE = [
  'app/_components/unread-bell-badge.tsx',
  'app/_components/unread-messages-badge.tsx',
  'app/dashboard/[eventId]/budget/_components/budget-summary.tsx',
];

const CHANNEL = /\.channel\(|postgres_changes/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (abs: string) => path.relative(WEB_ROOT, abs).split(path.sep).join('/');
const codeCache = new Map<string, string>();
const code = (abs: string) => {
  let c = codeCache.get(abs);
  if (c === undefined) {
    c = stripComments(fs.readFileSync(abs, 'utf8'));
    codeCache.set(abs, c);
  }
  return c;
};

const FILES = ROOTS.flatMap((r) => walk(path.join(WEB_ROOT, r)));
const OPENS = new Set(FILES.filter((f) => CHANNEL.test(code(f))).map(rel));

test('the census reads the tree — a blank cannot pass', () => {
  assert.ok(FILES.length > 1000, `only ${FILES.length} source files found — the walk is broken`);
  assert.ok(OPENS.has('app/_components/chat-message-stream.tsx'), 'the scan no longer sees the chat stream open its channel');
  assert.ok(OPENS.size >= 10, `only ${OPENS.size} files open a channel — the match broke`);
});

test('every file that opens a channel is named, with why it is live', () => {
  const unnamed = [...OPENS].filter((f) => !(f in LIVE));
  assert.deepEqual(
    unnamed,
    [],
    'A NEW REALTIME CHANNEL. Every channel holds the tab’s websocket open. If this surface is genuinely live (a ' +
      'conversation, a call, the day, presence, the wall, Panood), add it to LIVE with the reason; if it only needs ' +
      'to be current when looked at, use startCountPoll / onTabReturn (lib/tab-return.ts) instead.',
  );
  const stale = Object.keys(LIVE).filter((f) => !OPENS.has(f));
  assert.deepEqual(stale, [], 'LIVE names a file that no longer opens a channel — take it off the list');
});

test('the chrome on every page, and the budget, hold no socket', () => {
  for (const f of NEVER_LIVE) {
    assert.ok(fs.existsSync(path.join(WEB_ROOT, f)), `${f} moved — point this guard at its new home`);
    assert.doesNotMatch(code(path.join(WEB_ROOT, f)), /\.channel\(|postgres_changes|removeChannel/, `${f} opens a Realtime channel again`);
  }
  const bell = code(path.join(WEB_ROOT, 'app/_components/unread-bell-badge.tsx'));
  const envelope = code(path.join(WEB_ROOT, 'app/_components/unread-messages-badge.tsx'));
  const budget = code(path.join(WEB_ROOT, 'app/dashboard/[eventId]/budget/_components/budget-summary.tsx'));
  assert.match(bell, /startCountPoll\(\{[\s\S]*?readUnreadNotificationCount\(/, 'the bell re-asks through the poll, with the read that can say "unknown"');
  assert.match(envelope, /startCountPoll\(\{[\s\S]*?readUnreadMessageThreads\(/, 'the envelope re-asks through the poll, with the read that can say "unknown"');
  for (const [name, src] of [['bell', bell], ['envelope', envelope]] as const) {
    assert.doesNotMatch(src, /\bcountUnread(Messages)?\(/, `the ${name} re-asks with a read that answers 0 on failure — a false 0`);
  }
  assert.match(budget, /onTabReturn\(/, 'the budget re-reads when the tab is looked at again');
});

function importsOf(abs: string): string[] {
  const sf = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const specs: string[] = [];
  const visit = (n: ts.Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      if (!(ts.isImportDeclaration(n) && n.importClause?.isTypeOnly)) specs.push(n.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      specs.push(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return specs.map((s) => resolveImport(abs, s)).filter((x): x is string => !!x);
}

test('nothing a layout draws holds a socket — the chrome is not live', () => {
  const layouts = FILES.filter((f) => /\/app\/.*layout\.tsx$/.test(f) || f === path.join(WEB_ROOT, 'app', 'layout.tsx'));
  assert.ok(layouts.length >= 10, `only ${layouts.length} layouts found`);
  const reached = new Map<string, string>(); // live file -> the layout that reaches it
  const seen = new Set<string>();
  for (const layout of layouts) {
    const stack = [layout];
    while (stack.length) {
      const f = stack.pop()!;
      if (seen.has(`${layout}|${f}`)) continue;
      seen.add(`${layout}|${f}`);
      if (!ROOTS.some((r) => f.startsWith(path.join(WEB_ROOT, r) + path.sep))) continue;
      if (OPENS.has(rel(f)) && !reached.has(rel(f))) reached.set(rel(f), rel(layout));
      stack.push(...importsOf(f));
    }
  }
  assert.ok(seen.size > 500, `the import walk reached only ${seen.size} files — it is not following imports`);
  const bad = [...reached].filter(([f]) => !(f in LAYOUT_MAY_REACH)).map(([f, l]) => `${l} → … → ${f}`);
  assert.deepEqual(
    bad,
    [],
    'A LAYOUT REACHES A LIVE CHANNEL. A layout is drawn around every page under it, so this would hold a socket ' +
      'open on all of them. Mount the live piece on the page that is live, or read through lib/tab-return.ts.',
  );
  const stale = Object.keys(LAYOUT_MAY_REACH).filter((f) => !reached.has(f));
  assert.deepEqual(stale, [], 'LAYOUT_MAY_REACH names a file no layout reaches any more — take it off the list');
  for (const [f, { gateFile, gate }] of Object.entries(LAYOUT_MAY_REACH)) {
    assert.match(
      code(path.join(WEB_ROOT, gateFile)),
      gate,
      `${f} is reachable from a layout, and the gate that keeps its channel shut (${gateFile}) is gone — every page under it would hold a socket`,
    );
  }
  const demo = code(path.join(WEB_ROOT, 'app/_components/demo-session/use-demo-channel.ts'));
  assert.match(demo, /if \(!sessionId\) return;\s*const supabase = createClient\(\);\s*const channel = supabase\.channel\(/, 'useDemoChannel must open nothing without a session');
});

test('one browser Supabase client per tab', () => {
  const builders = FILES.filter((f) => /\bcreateBrowserClient\s*\(/.test(code(f))).map(rel);
  assert.deepEqual(builders, ['lib/supabase/client.ts'], 'a second createBrowserClient is a second client — and a second socket');
  const client = code(path.join(WEB_ROOT, 'lib/supabase/client.ts'));
  assert.doesNotMatch(client, /isSingleton\s*:\s*false/, 'the browser client must stay the @supabase/ssr singleton');
  const secondClients = FILES.filter((f) => {
    const src = code(f);
    return /^\s*['"]use client['"]/.test(src) && /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*['"]@supabase\/supabase-js['"]/.test(src);
  }).map(rel);
  assert.deepEqual(secondClients, [], 'a client file builds its own supabase-js client — use createClient from @/lib/supabase/client');
});
